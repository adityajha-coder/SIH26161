'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  MapPin,
  Building2,
  GraduationCap,
  Route,
  Users,
  Search,
  Clock,
  Waves,
  ShieldAlert,
  Download,
  ChevronDown,
  Check,
} from 'lucide-react'
import { PageHeader, EmptyState, PreviewNotice } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, useImpact } from '@/lib/use-flood'
import { formatNumber, formatDuration } from '@/lib/format'
import { CASES } from '@/lib/case-study'
import { cn } from '@/lib/utils'

export default function ImpactPage() {
  const { activeScenario, activeRun, activeCase, activeCaseId, setActiveCaseId } = usePlatform()
  const { result, isPreview } = useFloodResult(activeScenario, activeRun?.solver ?? 'delft3d', activeRun)
  const impact = useImpact(result, Infinity, activeCase.id)

  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [facilityTab, setFacilityTab] = useState<'hospitals' | 'schools'>('hospitals')
  const [isDamMenuOpen, setIsDamMenuOpen] = useState(false)
  const damMenuRef = useRef<HTMLDivElement>(null)

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
        velocityMs: z1St ? z1St.velocityMs : 7.2,
        action: 'Immediate Evacuation',
        tone: 'danger',
      },
      {
        id: 'zone-2',
        title: z2Name,
        range: `${z1Max}–${z2Max} km`,
        leadTime: z2St ? formatDuration(z2St.arrivalS) : '54 min',
        depthM: z2St ? z2St.peakDepthM : 14.6,
        velocityMs: z2St ? z2St.velocityMs : 4.5,
        action: 'Highway Diversion',
        tone: 'warning',
      },
      {
        id: 'zone-3',
        title: z3Name,
        range: `${z2Max}–${reachKm} km`,
        leadTime: z3St ? formatDuration(z3St.arrivalS) : '2h 12m',
        depthM: z3St ? z3St.peakDepthM : 8.9,
        velocityMs: z3St ? z3St.velocityMs : 2.2,
        action: 'Barrage Regulation',
        tone: 'success',
      },
    ]
  }, [activeCase, result?.stations])

  // Filtered settlements
  const filteredVillages = useMemo(() => {
    if (!impact) return []
    return impact.villages.filter((v) => {
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.kind.toLowerCase().includes(searchQuery.toLowerCase())
      const severity = v.depthM > 2 ? 'high' : v.depthM > 0.5 ? 'medium' : 'low'
      const matchesSeverity = severityFilter === 'all' || severity === severityFilter
      return matchesSearch && matchesSeverity
    })
  }, [impact, searchQuery, severityFilter])

  const highRiskCount = impact?.villages.filter((v) => v.depthM > 2).length ?? 0
  const medRiskCount = impact?.villages.filter((v) => v.depthM > 0.5 && v.depthM <= 2).length ?? 0
  const lowRiskCount = impact?.villages.filter((v) => v.depthM <= 0.5).length ?? 0

  // Export CSV handler
  const handleExportCsv = () => {
    if (!impact || impact.villages.length === 0) return
    const headers = ['Location', 'Kind', 'Population', 'Arrival_Time_sec', 'Peak_Depth_m', 'Chainage_km', 'Severity']
    const rows = impact.villages.map((v) => [
      `"${v.name}"`,
      v.kind,
      v.population || '',
      v.arrivalS,
      v.depthM.toFixed(2),
      v.chainageKm ? v.chainageKm.toFixed(1) : '',
      v.depthM > 2 ? 'Critical' : v.depthM > 0.5 ? 'Moderate' : 'Low',
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `hadr_impact_${activeCase.id}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Top Header with Dam & Scenario Selector */}
      <PageHeader
        title="Impact Assessment"
        description={`Hydraulic vulnerability, settlement exposure, and emergency evacuation protocol along the ${activeCase.river} corridor.`}
        actions={
          <div className="relative" ref={damMenuRef}>
            <button
              type="button"
              onClick={() => setIsDamMenuOpen((prev) => !prev)}
              aria-expanded={isDamMenuOpen}
              aria-haspopup="listbox"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/6 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer shadow-sm backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            >
              <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
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
        }
      />

      {!impact ? (
        <EmptyState
          title="No impact data available"
          description="Select an active benchmark dam or run a simulation to generate vulnerability metrics."
        />
      ) : (
        <>
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="glass-panel rounded-xl p-3.5 border border-white/8 flex items-center gap-3.5">
              <div className="size-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <MapPin className="size-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Settlements</p>
                <p className="text-xl font-bold font-mono text-white tabular-nums leading-tight mt-0.5">
                  {impact.villages.length}
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8 flex items-center gap-3.5">
              <div className="size-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Users className="size-4 text-sky-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Population</p>
                <p className="text-xl font-bold font-mono text-white tabular-nums leading-tight mt-0.5">
                  {impact.populationKnown ? formatNumber(impact.populationKnown) : '—'}
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8 flex items-center gap-3.5">
              <div className="size-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Building2 className="size-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Hospitals</p>
                <p className="text-xl font-bold font-mono text-red-400 tabular-nums leading-tight mt-0.5">
                  {impact.hospitals.length}
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8 flex items-center gap-3.5">
              <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <GraduationCap className="size-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Schools</p>
                <p className="text-xl font-bold font-mono text-amber-400 tabular-nums leading-tight mt-0.5">
                  {impact.schools.length}
                </p>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8 flex items-center gap-3.5">
              <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Route className="size-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Roads Submerged</p>
                <p className="text-xl font-bold font-mono text-white tabular-nums leading-tight mt-0.5">
                  {formatNumber(impact.roadKm, 1)} <span className="text-xs text-white/50 font-normal">km</span>
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Evacuation Zones - Driven by active dam reach and stations */}
          <div className="grid gap-3 sm:grid-cols-3">
            {evacuationZones.map((z) => {
              const isDanger = z.tone === 'danger'
              const isWarning = z.tone === 'warning'
              return (
                <div
                  key={z.id}
                  className="glass-panel rounded-xl p-4 border border-white/8 flex flex-col justify-between gap-3 hover:border-white/16 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white truncate max-w-[70%]">{z.title}</span>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border shrink-0',
                        isDanger && 'bg-red-500/10 text-red-400 border-red-500/20',
                        isWarning && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                        !isDanger && !isWarning && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      )}
                    >
                      {z.range}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs py-1">
                    <div>
                      <span className="text-[10px] text-white/40 block">Lead Time</span>
                      <span className="font-mono font-semibold text-white">{z.leadTime}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/40 block">Peak Depth</span>
                      <span
                        className={cn(
                          'font-mono font-semibold',
                          isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                        )}
                      >
                        {typeof z.depthM === 'number' ? `${z.depthM.toFixed(1)} m` : z.depthM}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/6 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-[11px] font-medium flex items-center gap-1.5',
                        isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                      )}
                    >
                      {isDanger ? (
                        <ShieldAlert className="size-3.5" />
                      ) : isWarning ? (
                        <Route className="size-3.5" />
                      ) : (
                        <Waves className="size-3.5" />
                      )}
                      {z.action}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            {/* Settlements Table Card */}
            <div className="lg:col-span-7 glass-panel rounded-xl border border-white/8 overflow-hidden">
              <div className="p-3.5 border-b border-white/6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-white" />
                  <span className="text-xs font-semibold text-white">Affected Settlements</span>
                  <span className="text-[11px] font-mono text-white/40">({filteredVillages.length})</span>
                </div>

                {/* Filter, Search Bar, and CSV Export */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="size-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white/4 border border-white/8 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 w-32 sm:w-36 transition-colors"
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
                    <button
                      type="button"
                      onClick={() => setSeverityFilter('high')}
                      className={cn(
                        'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                        severityFilter === 'high' ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      {highRiskCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverityFilter('medium')}
                      className={cn(
                        'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                        severityFilter === 'medium'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      {medRiskCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeverityFilter('low')}
                      className={cn(
                        'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                        severityFilter === 'low'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      {lowRiskCount}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    title="Export CSV of affected settlements"
                    className="p-1 rounded-lg bg-white/4 border border-white/8 text-white/60 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                  >
                    <Download className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-125 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0C0C0C]/95 backdrop-blur-md z-10">
                    <tr className="border-b border-white/6 text-white/40 text-[11px]">
                      <th className="py-2.5 px-3.5 text-left font-medium">Location</th>
                      <th className="py-2.5 px-3 text-left font-medium">Type</th>
                      <th className="py-2.5 px-3 text-right font-medium">Arrival</th>
                      <th className="py-2.5 px-3 text-right font-medium">Peak Depth</th>
                      <th className="py-2.5 px-3.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {filteredVillages.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-white/30">
                          No settlements matching filter
                        </td>
                      </tr>
                    ) : (
                      filteredVillages.map((v, i) => {
                        const isHigh = v.depthM > 2
                        const isMed = v.depthM > 0.5 && v.depthM <= 2
                        return (
                          <tr key={i} className="hover:bg-white/2 transition-colors">
                            <td className="py-2.5 px-3.5 font-medium text-white">
                              <div className="flex items-center gap-1.5">
                                <span>{v.name}</span>
                                {v.population ? (
                                  <span className="text-[10px] font-mono text-white/30 font-normal">
                                    ({formatNumber(v.population)})
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 capitalize text-white/50 text-[11px]">{v.kind}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-white/70 text-[11px]">
                              {formatDuration(v.arrivalS)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                              {v.depthM.toFixed(1)} <span className="text-[10px] text-white/40 font-normal">m</span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium',
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

            {/* Right Column: Depth Distribution & Facilities */}
            <div className="lg:col-span-5 space-y-4">
              {/* Depth Bands Card */}
              <div className="glass-panel rounded-xl p-3.5 border border-white/8">
                <div className="flex items-center justify-between pb-3 border-b border-white/6">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-white" />
                    <span className="text-xs font-semibold text-white">Depth Distribution</span>
                  </div>
                  <span className="text-[11px] font-mono text-white/40">Locations</span>
                </div>

                <div className="space-y-2.5 pt-3">
                  {impact.depthBands.map((db) => {
                    const maxCount = Math.max(...impact.depthBands.map((d) => d.count), 1)
                    const pct = (db.count / maxCount) * 100
                    return (
                      <div key={db.band} className="flex items-center gap-3">
                        <span className="w-16 text-[11px] text-white/50 font-mono shrink-0">{db.band}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/4 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              db.band.includes('> 10') || db.band.includes('5-10')
                                ? 'bg-red-500/80'
                                : db.band.includes('2-5')
                                ? 'bg-amber-500/80'
                                : 'bg-white/40'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-xs font-mono font-semibold text-white">{db.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Critical Infrastructure Card */}
              <div className="glass-panel rounded-xl p-3.5 border border-white/8">
                <div className="flex items-center justify-between pb-3 border-b border-white/6">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-white" />
                    <span className="text-xs font-semibold text-white">Critical Facilities</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center rounded-lg bg-white/4 p-0.5 border border-white/6 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFacilityTab('hospitals')}
                      className={cn(
                        'px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer',
                        facilityTab === 'hospitals' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      Hospitals ({impact.hospitals.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacilityTab('schools')}
                      className={cn(
                        'px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer',
                        facilityTab === 'schools' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      Schools ({impact.schools.length})
                    </button>
                  </div>
                </div>

                <div className="pt-2 max-h-60 overflow-y-auto space-y-1.5 divide-y divide-white/3">
                  {(facilityTab === 'hospitals' ? impact.hospitals : impact.schools).length === 0 ? (
                    <p className="py-4 text-center text-xs text-white/30">No facilities in flooded zone</p>
                  ) : (
                    (facilityTab === 'hospitals' ? impact.hospitals : impact.schools).map((item, i) => (
                      <div key={i} className="flex items-center justify-between pt-1.5 text-xs">
                        <span className="text-white/80 truncate max-w-[55%] font-medium">{item.name}</span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-white/40 flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDuration(item.arrivalS)}
                          </span>
                          <span
                            className={cn(
                              'font-semibold',
                              item.depthM > 2 ? 'text-red-400' : 'text-amber-400'
                            )}
                          >
                            {item.depthM.toFixed(1)}m
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isPreview && (
        <PreviewNotice>
          Preliminary estimates based on Manning hydraulic preview extents.
        </PreviewNotice>
      )}
    </div>
  )
}
