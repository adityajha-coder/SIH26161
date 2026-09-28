'use client'

import { useState, useMemo } from 'react'
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
} from 'lucide-react'
import { PageHeader, EmptyState, PreviewNotice } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, useImpact } from '@/lib/use-flood'
import { formatNumber, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function ImpactPage() {
  const { activeScenario, activeRun } = usePlatform()
  const { result, isPreview } = useFloodResult(activeScenario, activeRun?.solver ?? 'delft3d', activeRun)
  const impact = useImpact(result)

  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [facilityTab, setFacilityTab] = useState<'hospitals' | 'schools'>('hospitals')

  // Filtered settlements
  const filteredVillages = useMemo(() => {
    if (!impact) return []
    return impact.villages.filter((v) => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.kind.toLowerCase().includes(searchQuery.toLowerCase())
      const severity = v.depthM > 2 ? 'high' : v.depthM > 0.5 ? 'medium' : 'low'
      const matchesSeverity = severityFilter === 'all' || severity === severityFilter
      return matchesSearch && matchesSeverity
    })
  }, [impact, searchQuery, severityFilter])

  const highRiskCount = impact?.villages.filter((v) => v.depthM > 2).length ?? 0
  const medRiskCount = impact?.villages.filter((v) => v.depthM > 0.5 && v.depthM <= 2).length ?? 0
  const lowRiskCount = impact?.villages.filter((v) => v.depthM <= 0.5).length ?? 0

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Top Header - No subheadings */}
      <PageHeader
        title="Impact Assessment"
        actions={
          activeScenario ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/6 border border-white/8 text-white/90">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {activeScenario.name}
              </span>
            </div>
          ) : undefined
        }
      />

      {!impact ? (
        <EmptyState
          title="No impact data available"
          description="Run a simulation to generate vulnerability metrics."
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
              <div className="size-9 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center shrink-0">
                <Users className="size-4 text-white/80" />
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
              <div className="size-9 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center shrink-0">
                <Route className="size-4 text-white/80" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Roads Submerged</p>
                <p className="text-xl font-bold font-mono text-white tabular-nums leading-tight mt-0.5">
                  {formatNumber(impact.roadKm, 1)} <span className="text-xs text-white/50 font-normal">km</span>
                </p>
              </div>
            </div>
          </div>

          {/* Evacuation Zones - Minimal, visual, zero text-heavy paragraphs */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass-panel rounded-xl p-4 border border-white/8 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Zone 1 · Dam Toe</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  0–25 km
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-1">
                <div>
                  <span className="text-[10px] text-white/40 block">Lead Time</span>
                  <span className="font-mono font-semibold text-white">&lt; 22 min</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Peak Depth</span>
                  <span className="font-mono font-semibold text-red-400">18.2 m</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/6 flex items-center justify-between">
                <span className="text-[11px] font-medium text-red-400 flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5" /> Immediate Evacuation
                </span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-white/8 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Zone 2 · Devprayag</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  25–60 km
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-1">
                <div>
                  <span className="text-[10px] text-white/40 block">Lead Time</span>
                  <span className="font-mono font-semibold text-white">54 min</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Peak Depth</span>
                  <span className="font-mono font-semibold text-amber-400">14.6 m</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/6 flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5">
                  <Route className="size-3.5" /> Highway Diversion
                </span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-white/8 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Zone 3 · Rishikesh – Haridwar</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  60–105 km
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs py-1">
                <div>
                  <span className="text-[10px] text-white/40 block">Lead Time</span>
                  <span className="font-mono font-semibold text-white">2h 12m</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Peak Depth</span>
                  <span className="font-mono font-semibold text-emerald-400">9.4 m</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/6 flex items-center justify-between">
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
                  <Waves className="size-3.5" /> Barrage Regulation
                </span>
              </div>
            </div>
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

                {/* Filter and Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="size-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white/4 border border-white/8 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 w-36 transition-colors"
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
                        severityFilter === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/70'
                      )}
                    >
                      {medRiskCount}
                    </button>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-115 overflow-y-auto">
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
                            <td className="py-2 px-3.5 font-medium text-white">{v.name}</td>
                            <td className="py-2 px-3 capitalize text-white/50 text-[11px]">{v.kind}</td>
                            <td className="py-2 px-3 text-right font-mono text-white/70 text-[11px]">
                              {formatDuration(v.arrivalS)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                              {v.depthM.toFixed(1)} <span className="text-[10px] text-white/40 font-normal">m</span>
                            </td>
                            <td className="py-2 px-3.5 text-right">
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
                    const maxCount = Math.max(...impact.depthBands.map((d) => d.count))
                    const pct = maxCount > 0 ? (db.count / maxCount) * 100 : 0
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

                <div className="pt-2 max-h-55 overflow-y-auto space-y-1.5 divide-y divide-white/3">
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
                          <span className="text-red-400 font-semibold">{item.depthM.toFixed(1)}m</span>
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
