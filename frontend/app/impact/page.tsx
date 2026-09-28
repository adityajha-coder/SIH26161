'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import {
  Building2,
  GraduationCap,
  Route,
  Search,
  Clock,
  Waves,
  ShieldAlert,
  Download,
  ChevronDown,
  Check,
  X,
} from 'lucide-react'
import { EmptyState, PreviewNotice } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, useImpact } from '@/lib/use-flood'
import { formatNumber, formatDuration } from '@/lib/format'
import { CASES } from '@/lib/case-study'
import type { ExposedAsset } from '@/lib/flood-model'
import { cn } from '@/lib/utils'

const DAM_IMAGES: Record<string, string> = {
  'tehri-dam': '/Images/tehri_dam.jpg',
  'sardar-sarovar-dam': '/Images/sardar_sarovar_dam.jpg',
  'bhakra-dam': '/Images/bakhra_dam.jpg',
  'idukki-dam': '/Images/idukki_dam.jpg',
}

export default function ImpactPage() {
  const { activeScenario, activeRun, activeCase, activeCaseId, setActiveCaseId } = usePlatform()
  const { result, isPreview } = useFloodResult(activeScenario, activeRun?.solver ?? 'delft3d', activeRun)
  const impact = useImpact(result, Infinity, activeCase.id)

  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [assetCategory, setAssetCategory] = useState<'all' | 'settlement' | 'hospital' | 'school'>('all')
  const [isDamMenuOpen, setIsDamMenuOpen] = useState(false)
  const damMenuRef = useRef<HTMLDivElement>(null)

  // Interactive Inspector State
  const [selectedSettlement, setSelectedSettlement] = useState<ExposedAsset | null>(null)
  const [showRightPanel, setShowRightPanel] = useState(false)

  const damPhoto = DAM_IMAGES[activeCaseId] || '/Images/tehri_dam.jpg'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (damMenuRef.current && !damMenuRef.current.contains(event.target as Node)) {
        setIsDamMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Dynamic Evacuation Zones calculated from active case geometry and simulation stations
  const evacuationZones = useMemo(() => {
    const towns = activeCase.downstreamTowns || []
    const reachKm = activeCase.reachKm || 100
    const stations = result?.stations || []

    const z1Max = Math.max(10, Math.round(reachKm * 0.24))
    const z2Max = Math.max(z1Max + 15, Math.round(reachKm * 0.62))

    const z1Towns = towns.filter((t) => t.chainageKm <= z1Max)
    const z2Towns = towns.filter((t) => t.chainageKm > z1Max && t.chainageKm <= z2Max)
    const z3Towns = towns.filter((t) => t.chainageKm > z2Max)

    const z1Name =
      z1Towns.length > 0
        ? `Zone 1 · Dam Toe – ${z1Towns[z1Towns.length - 1].name}`
        : 'Zone 1 · Dam Toe Reach'
    const z2Name =
      z2Towns.length > 0
        ? `Zone 2 · ${z2Towns.map((t) => t.name).join(' – ')}`
        : 'Zone 2 · Intermediate Valley'
    const z3Name =
      z3Towns.length > 0
        ? `Zone 3 · ${z3Towns.map((t) => t.name).join(' – ')}`
        : 'Zone 3 · Estuary / Downstream Plains'

    // Stations lookup for exact hydraulic metrics
    const z1St = stations.find((s) => s.chainageKm >= Math.min(10, z1Max * 0.5)) || stations[0]
    const z2St = stations.find((s) => s.chainageKm >= (z1Max + z2Max) / 2) || stations[Math.floor(stations.length / 2)]
    const z3St = stations.find((s) => s.chainageKm >= z2Max + (reachKm - z2Max) * 0.5) || stations[stations.length - 1]

    return [
      {
        id: 'zone-1',
        title: z1Name,
        range: `0–${z1Max} km`,
        leadTime: z1St ? formatDuration(z1St.arrivalS) : '< 20 min',
        depthM: z1St ? z1St.peakDepthM : 18.2,
        action: 'Immediate Evacuation',
        tone: 'danger',
      },
      {
        id: 'zone-2',
        title: z2Name,
        range: `${z1Max}–${z2Max} km`,
        leadTime: z2St ? formatDuration(z2St.arrivalS) : '54 min',
        depthM: z2St ? z2St.peakDepthM : 14.6,
        action: 'Highway Diversion',
        tone: 'warning',
      },
      {
        id: 'zone-3',
        title: z3Name,
        range: `${z2Max}–${reachKm} km`,
        leadTime: z3St ? formatDuration(z3St.arrivalS) : '2h 12m',
        depthM: z3St ? z3St.peakDepthM : 8.9,
        action: 'Barrage Regulation',
        tone: 'success',
      },
    ]
  }, [activeCase, result?.stations])

  // Unified Exposed Assets (Settlements, Hospitals, Schools) sorted downstream chronologically by wave arrival
  const allAssets = useMemo(() => {
    if (!impact) return []
    const settlements = impact.villages.map((v) => ({ ...v, assetCategory: 'settlement' as const }))
    const hospitals = impact.hospitals.map((h) => ({ ...h, assetCategory: 'hospital' as const }))
    const schools = impact.schools.map((s) => ({ ...s, assetCategory: 'school' as const }))
    return [...settlements, ...hospitals, ...schools].sort((a, b) => a.arrivalS - b.arrivalS)
  }, [impact])

  // Filtered Assets by category, severity, and search
  const filteredAssets = useMemo(() => {
    return allAssets.filter((a) => {
      if (assetCategory !== 'all' && a.assetCategory !== assetCategory) return false

      const severity = a.depthM > 2 ? 'high' : a.depthM > 0.5 ? 'medium' : 'low'
      if (severityFilter !== 'all' && severity !== severityFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return a.name.toLowerCase().includes(q) || a.kind.toLowerCase().includes(q)
      }

      return true
    })
  }, [allAssets, assetCategory, severityFilter, searchQuery])

  const highRiskCount = allAssets.filter((a) => a.depthM > 2).length
  const medRiskCount = allAssets.filter((a) => a.depthM > 0.5 && a.depthM <= 2).length

  const settlementCount = impact?.villages.length ?? 0
  const hospitalCount = impact?.hospitals.length ?? 0
  const schoolCount = impact?.schools.length ?? 0

  // Export CSV handler for all unified assets
  const handleExportCsv = () => {
    if (filteredAssets.length === 0) return
    const headers = ['Name', 'Category', 'Type', 'Population', 'Arrival_Time_sec', 'Arrival_Duration', 'Peak_Depth_m', 'Chainage_km', 'Severity']
    const rows = filteredAssets.map((a) => [
      `"${a.name}"`,
      a.assetCategory,
      a.kind,
      a.population || '',
      a.arrivalS,
      formatDuration(a.arrivalS),
      a.depthM.toFixed(2),
      a.chainageKm ? a.chainageKm.toFixed(1) : '',
      a.depthM > 2 ? 'Critical' : a.depthM > 0.5 ? 'Moderate' : 'Low',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `exposed_assets_${activeCase.id}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download Individual Settlement Dossier JSON
  const downloadSettlementDossier = (asset: ExposedAsset) => {
    const payload = {
      dam: activeCase.name,
      river: activeCase.river,
      state: activeCase.state,
      settlement_name: asset.name,
      kind: asset.kind,
      chainage_km: asset.chainageKm ?? null,
      coordinates: asset.lngLat,
      population: asset.population ?? null,
      wave_arrival_seconds: asset.arrivalS,
      wave_arrival_duration: formatDuration(asset.arrivalS),
      peak_depth_m: Number(asset.depthM.toFixed(2)),
      severity: asset.depthM > 2 ? 'Critical' : asset.depthM > 0.5 ? 'Moderate' : 'Low',
      recommended_action:
        asset.depthM > 2
          ? 'Immediate vertical and horizontal evacuation to high ridge line'
          : asset.depthM > 0.5
          ? 'Pre-emptive evacuation of vulnerable populations and livestock'
          : 'Monitor local emergency broadcast and secure ground-floor infrastructure',
      timestamp: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${asset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_evacuation_dossier.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 4 Core KPI Metrics (switches between 4-col full width and 2x2 grid when inspector opens)
  const renderMetricCards = (isSplit: boolean) => {
    if (!impact) return null
    return (
      <div className={cn('grid gap-3', isSplit ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        {/* Metric 1: Settlements */}
        <div className="glass-panel rounded-xl p-3.5 border border-white/8">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
            Settlements Inundated
          </p>
          <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
            {impact.villages.length}
          </p>
          <p className="text-[11px] text-white/50 mt-1 truncate">
            {highRiskCount} Critical · {medRiskCount} Moderate
          </p>
        </div>

        {/* Metric 2: Population */}
        <div className="glass-panel rounded-xl p-3.5 border border-white/8">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
            Population at Risk
          </p>
          <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
            {impact.populationKnown ? formatNumber(impact.populationKnown) : '—'}
          </p>
          <p className="text-[11px] text-white/50 mt-1 truncate">
            Along {activeCase.reachKm} km corridor
          </p>
        </div>

        {/* Metric 3: Critical Facilities */}
        <div className="glass-panel rounded-xl p-3.5 border border-white/8">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
            Critical Facilities
          </p>
          <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
            {impact.hospitals.length + impact.schools.length}
          </p>
          <p className="text-[11px] text-white/50 mt-1 truncate">
            {impact.hospitals.length} Hospitals · {impact.schools.length} Schools
          </p>
        </div>

        {/* Metric 4: Submerged Roadways */}
        <div className="glass-panel rounded-xl p-3.5 border border-white/8">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
            Submerged Roadways
          </p>
          <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
            {formatNumber(impact.roadKm, 1)} <span className="text-xs text-white/50 font-normal">km</span>
          </p>
          <p className="text-[11px] text-white/50 mt-1 truncate">
            Critical evacuation arteries
          </p>
        </div>
      </div>
    )
  }

  // Reusable Evacuation Zones Cards
  const renderEvacuationZones = () => (
    <div className="grid gap-3 sm:grid-cols-3">
      {evacuationZones.map((z) => {
        const isDanger = z.tone === 'danger'
        const isWarning = z.tone === 'warning'
        return (
          <div
            key={z.id}
            className="glass-panel rounded-xl p-3.5 border border-white/8 flex flex-col justify-between gap-2.5 hover:border-white/16 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white truncate">{z.title}</span>
              <span className="px-2 py-0.5 text-[10px] font-mono text-white/40 bg-white/4 rounded border border-white/6 shrink-0">
                {z.range}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-0.5">
              <div>
                <span className="text-[10px] text-white/40 block">Lead Time</span>
                <span className="font-mono text-white font-medium">{z.leadTime}</span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Peak Depth</span>
                <span className="font-mono text-white font-medium">
                  {typeof z.depthM === 'number' ? `${z.depthM.toFixed(1)} m` : z.depthM}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/6 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                {isDanger ? (
                  <ShieldAlert className="size-3.5 text-rose-400" />
                ) : isWarning ? (
                  <Route className="size-3.5 text-amber-400" />
                ) : (
                  <Waves className="size-3.5 text-sky-400" />
                )}
                <span className="text-white/70">{z.action}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )

  // Reusable Depth Distribution Card (Clean Linear Summary)
  const renderDepthDistribution = () => {
    if (!impact) return null
    const maxCount = Math.max(...impact.depthBands.map((d) => d.count), 1)

    return (
      <div className="glass-panel rounded-xl p-3.5 border border-white/8 space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/6">
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            Inundation Depth Distribution
          </span>
          <span className="text-[11px] font-mono text-white/40">Locations by Peak Crest</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-0.5">
          {impact.depthBands.map((db) => {
            const pct = (db.count / maxCount) * 100
            return (
              <div key={db.band} className="p-2.5 rounded-lg bg-white/2 border border-white/4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/50">{db.band}</span>
                  <span className={cn('font-semibold', db.count > 0 ? 'text-white' : 'text-white/30')}>
                    {db.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/4 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      db.band.includes('> 10')
                        ? 'bg-red-500'
                        : db.band.includes('5-10')
                        ? 'bg-red-500/80'
                        : db.band.includes('2-5')
                        ? 'bg-amber-500/80'
                        : 'bg-white/40'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Unified Exposed Assets & Critical Facilities Table
  const renderAssetsTable = () => (
    <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
      <div className="p-3.5 border-b border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Title & Category Filter Tabs */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-xs font-semibold text-white uppercase tracking-wider">
            Exposed Assets
          </span>

          <div className="flex items-center rounded-lg bg-white/4 p-0.5 border border-white/6 text-[11px]">
            <button
              type="button"
              onClick={() => setAssetCategory('all')}
              className={cn(
                'px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer',
                assetCategory === 'all' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              All ({allAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setAssetCategory('settlement')}
              className={cn(
                'px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer',
                assetCategory === 'settlement' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              Settlements ({settlementCount})
            </button>
            <button
              type="button"
              onClick={() => setAssetCategory('hospital')}
              className={cn(
                'px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer',
                assetCategory === 'hospital' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              Hospitals ({hospitalCount})
            </button>
            <button
              type="button"
              onClick={() => setAssetCategory('school')}
              className={cn(
                'px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer',
                assetCategory === 'school' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              Schools ({schoolCount})
            </button>
          </div>
        </div>

        {/* Filter, Search Bar, and CSV Export */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/4 border border-white/8 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 w-28 sm:w-36 transition-colors"
            />
          </div>

          <div className="flex items-center rounded-lg bg-white/4 p-0.5 border border-white/6 text-[11px]">
            <button
              type="button"
              onClick={() => setSeverityFilter('all')}
              className={cn(
                'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                severityFilter === 'all' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              All
            </button>
            {highRiskCount > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('high')}
                className={cn(
                  'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                  severityFilter === 'high' ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white/70'
                )}
              >
                Critical
              </button>
            )}
            {medRiskCount > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('medium')}
                className={cn(
                  'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                  severityFilter === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/70'
                )}
              >
                Moderate
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Export CSV of exposed assets and facilities"
            className="p-1 rounded-lg bg-white/4 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <Download className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Unified Table Content */}
      <div className="w-full overflow-x-auto max-h-125 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 bg-[#0C0C0C]/95 backdrop-blur-md z-10">
            <tr className="border-b border-white/6 text-white/40 text-[11px]">
              <th className="py-2.5 pl-4 sm:pl-5 pr-3 text-left font-medium whitespace-nowrap">Asset / Location</th>
              <th className="py-2.5 px-3 text-left font-medium whitespace-nowrap">Type</th>
              <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Arrival</th>
              <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Peak Depth</th>
              <th className="py-2.5 pl-3 pr-4 sm:pr-5 text-right font-medium whitespace-nowrap">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-white/30">
                  No assets matching filter
                </td>
              </tr>
            ) : (
              filteredAssets.map((v, i) => {
                const isSelected = showRightPanel && selectedSettlement?.name === v.name
                const isHigh = v.depthM > 2
                const isMed = v.depthM > 0.5 && v.depthM <= 2
                return (
                  <tr
                    key={i}
                    onClick={() => {
                      setSelectedSettlement(v)
                      setShowRightPanel(true)
                    }}
                    className={cn(
                      'transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-white/8 text-white'
                        : 'hover:bg-white/3 text-white/80'
                    )}
                  >
                    <td className="py-3 pl-4 sm:pl-5 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {v.assetCategory === 'hospital' ? (
                          <Building2 className="size-3.5 text-rose-400 shrink-0" />
                        ) : v.assetCategory === 'school' ? (
                          <GraduationCap className="size-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <span
                            className={cn(
                              'size-1.5 rounded-full shrink-0',
                              isSelected
                                ? 'bg-emerald-400'
                                : isHigh
                                ? 'bg-red-400'
                                : isMed
                                ? 'bg-amber-400'
                                : 'bg-emerald-400/60'
                            )}
                          />
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-white truncate">{v.name}</span>
                          {v.population ? (
                            <span className="text-[10px] font-mono text-white/35 font-normal">
                              ({formatNumber(v.population)})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 capitalize text-white/50 text-[11px] whitespace-nowrap">
                      {v.kind}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white/70 text-[11px] whitespace-nowrap">
                      {formatDuration(v.arrivalS)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-white whitespace-nowrap">
                      {v.depthM.toFixed(1)} <span className="text-[10px] text-white/40 font-normal">m</span>
                    </td>
                    <td className="py-3 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium',
                          isHigh && 'bg-red-500/10 text-red-400 border border-red-500/20',
                          isMed && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                          !isHigh && !isMed && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        )}
                      >
                        {isHigh ? 'Critical' : isMed ? 'Moderate' : 'Low'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )


  // Selected Settlement Dossier Inspector Panel
  const renderSettlementInspector = () => {
    if (!selectedSettlement) return null
    const isHigh = selectedSettlement.depthM > 2
    const isMed = selectedSettlement.depthM > 0.5 && selectedSettlement.depthM <= 2

    return (
      <div className="glass-panel rounded-2xl p-4 border border-white/10 shadow-2xl space-y-3.5 bg-[#0c0f14]/98">
        {/* Header with Close Action */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white tracking-tight">
            Selected Asset Dossier
          </h3>
          <button
            type="button"
            onClick={() => {
              setShowRightPanel(false)
              setSelectedSettlement(null)
            }}
            className="size-6 rounded-md hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close panel"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Authentic Dam Photograph & Caption */}
        <div className="relative w-full h-44 rounded-xl overflow-hidden border border-white/10 bg-black shadow-inner">
          <Image
            src={damPhoto}
            alt={activeCase.name}
            fill
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, 420px"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/35 to-transparent p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-white drop-shadow-md">
              {activeCase.dam.name}
            </span>
            <span className="text-[10px] font-mono text-white/70 drop-shadow-md">
              {activeCase.river} Basin Corridor
            </span>
          </div>
        </div>

        {/* Asset Title, Subtitle, and JSON Download Button */}
        <div className="flex items-start justify-between gap-2 pt-0.5">
          <div className="min-w-0 pr-1">
            <h4 className="text-base font-semibold text-white truncate">
              {selectedSettlement.name}
            </h4>
            <p className="text-xs text-white/50 mt-0.5 capitalize">
              {selectedSettlement.kind} · {activeCase.state}
            </p>
          </div>

          <button
            type="button"
            onClick={() => downloadSettlementDossier(selectedSettlement)}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-sm"
            title="Download Settlement Evacuation Dossier JSON"
          >
            <Download className="size-4" />
          </button>
        </div>

        {/* Key Specifications List */}
        <div className="space-y-1.5 pt-2 text-xs border-t border-white/6">
          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Corridor Chainage</span>
            <span className="text-white font-mono text-[11px] text-right">
              {selectedSettlement.chainageKm ? `${selectedSettlement.chainageKm.toFixed(1)} km downstream` : 'River reach'}
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Wave Arrival Lead Time</span>
            <span className="text-white font-mono text-[11px] text-right">
              {formatDuration(selectedSettlement.arrivalS)}
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Peak Inundation Depth</span>
            <span
              className={cn(
                'font-mono font-bold text-[11px] text-right',
                isHigh ? 'text-red-400' : isMed ? 'text-amber-400' : 'text-emerald-400'
              )}
            >
              {selectedSettlement.depthM.toFixed(2)} m
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Population at Risk</span>
            <span className="text-white font-mono text-[11px] text-right">
              {selectedSettlement.population ? formatNumber(selectedSettlement.population) : 'Sparse / Unlisted'}
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Vulnerability Tier</span>
            <span
              className={cn(
                'text-[11px] text-right font-medium',
                isHigh ? 'text-red-400' : isMed ? 'text-amber-400' : 'text-emerald-400'
              )}
            >
              {isHigh ? 'Tier-1 Critical Hazard' : isMed ? 'Tier-2 Moderate Hazard' : 'Tier-3 Low Hazard'}
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Geo Coordinates</span>
            <span className="text-white font-mono text-[10px] text-right">
              {selectedSettlement.lngLat[1].toFixed(4)}°N, {selectedSettlement.lngLat[0].toFixed(4)}°E
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Action Protocol</span>
            <span className="text-white text-[11px] text-right font-medium">
              {isHigh ? 'Immediate Evacuation' : isMed ? 'Highway Diversion' : 'Monitor Flow'}
            </span>
          </div>

          <div className="flex items-start justify-between py-1">
            <span className="text-white/40 text-[11px]">Safe Escape Route</span>
            <span className="text-white text-[11px] text-right">
              {isHigh ? 'Valley Ridge Line NH Corridor' : 'Local Elevated Relief Center'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header: Clean, professional, with dynamic Dam Selector Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Downstream Impact & Vulnerability
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative" ref={damMenuRef}>
            <button
              type="button"
              onClick={() => setIsDamMenuOpen((prev) => !prev)}
              aria-expanded={isDamMenuOpen}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/6 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer shadow-sm backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              <span className="font-semibold text-white">{activeCase.name}</span>
              <span className="text-[11px] text-white/50 hidden sm:inline">({activeCase.state})</span>
              <ChevronDown
                className={cn(
                  'size-3.5 text-white/50 transition-transform duration-200 shrink-0',
                  isDamMenuOpen && 'rotate-180 text-white'
                )}
              />
            </button>

            {isDamMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#121212]/98 border border-white/12 p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                  Select Benchmark Dam
                </div>
                <div className="space-y-1">
                  {CASES.map((c) => {
                    const isSelected = c.id === activeCaseId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveCaseId(c.id)
                          setIsDamMenuOpen(false)
                        }}
                        className={cn(
                          'w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-white/12 text-white border border-white/10'
                            : 'text-white/70 hover:bg-white/6 hover:text-white'
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-white truncate">{c.name}</p>
                          <p className="text-[11px] text-white/40 truncate">
                            {c.river} · {c.state}
                          </p>
                        </div>
                        {isSelected && <Check className="size-4 text-emerald-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!impact ? (
        <EmptyState
          title="No impact data available"
          description="Select an active benchmark dam or run a simulation to generate vulnerability metrics."
        />
      ) : !showRightPanel ? (
        /* State 1: Full-Width Layout */
        <div className="space-y-4 animate-in fade-in duration-150">
          {renderMetricCards(false)}
          {renderEvacuationZones()}
          {renderDepthDistribution()}
          {renderAssetsTable()}
        </div>
      ) : (
        /* State 2: Split Inspector Layout (Right card covers full right side; metrics adapt on left!) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-150">
          {/* Left Column (7 cols): 2x2 metrics, zones, depth distribution, and merged assets table */}
          <div className="lg:col-span-7 space-y-3.5">
            {renderMetricCards(true)}
            {renderEvacuationZones()}
            {renderDepthDistribution()}
            {renderAssetsTable()}
          </div>

          {/* Right Column (5 cols): Starts at top and covers full right side */}
          <div className="lg:col-span-5 sticky top-4">
            {renderSettlementInspector()}
          </div>
        </div>
      )}

      {isPreview && (
        <PreviewNotice>
          Preliminary estimates based on Manning hydraulic preview extents.
        </PreviewNotice>
      )}
    </div>
  )
}
