'use client'

import { ShieldAlert, Users, Building2, GraduationCap, Route } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice, EmptyState } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, useImpact } from '@/lib/use-flood'
import { formatNumber, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function ImpactPage() {
  const { activeScenario, activeRun } = usePlatform()
  const { result, isPreview } = useFloodResult(activeScenario, activeRun?.solver ?? 'delft3d', activeRun)
  const impact = useImpact(result)

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Impact & Vulnerability Assessment"
        description="Downstream vulnerability exposure inventory — human settlements, healthcare, educational infrastructure, and road transport networks intersecting flood wavefronts."
      />

      {!impact ? (
        <EmptyState
          title="No impact data generated"
          description="Execute a simulation run to compute geospatial vulnerability metrics by intersecting hydrodynamic depth bands with local infrastructure databases."
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile
              label="Villages Impacted"
              value={impact.villages.length}
              tone="danger"
            />
            <StatTile
              label="Hospitals at Risk"
              value={impact.hospitals.length}
              tone="danger"
            />
            <StatTile
              label="Schools at Risk"
              value={impact.schools.length}
              tone="warning"
            />
            <StatTile
              label="Submerged Roads"
              value={formatNumber(impact.roadKm, 1)}
              unit="km"
              tone="warning"
            />
            <StatTile
              label="Inundated Footprint"
              value={formatNumber(result?.floodedAreaKm2 ?? 0, 1)}
              unit="km²"
              tone="neutral"
            />
          </div>

          {/* HADR Incident Command Evacuation Priority Matrix */}
          <div className="glass-panel rounded-xl p-4 border border-white/[0.12]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-white" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  HADR Incident Command · Evacuation Lead-Time Matrix
                </h3>
              </div>
              <span className="text-[11px] font-mono text-white/60">NDMA Guidelines (National Disaster Management Authority)</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="glass-panel-subtle p-3 rounded-lg border-l-2 border-l-[#f23f43]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Zone 1: Dam Toe to Koteshwar</span>
                  <span className="text-[10px] font-mono font-bold text-[#f23f43] bg-[#f23f43]/10 px-1.5 py-0.5 rounded">0–25 km</span>
                </div>
                <p className="text-[11px] text-white/70 mt-1">Lead Time: &lt; 22 min · Peak Depth: 18.2m</p>
                <p className="text-[11px] text-[#f23f43] font-semibold mt-1">Action: Immediate siren sound; full riverbank evacuation.</p>
              </div>

              <div className="glass-panel-subtle p-3 rounded-lg border-l-2 border-l-[#f0b232]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Zone 2: Devprayag Confluence</span>
                  <span className="text-[10px] font-mono font-bold text-[#f0b232] bg-[#f0b232]/10 px-1.5 py-0.5 rounded">25–60 km</span>
                </div>
                <p className="text-[11px] text-white/70 mt-1">Lead Time: 54 min · Peak Depth: 14.6m</p>
                <p className="text-[11px] text-[#f0b232] font-semibold mt-1">Action: NH-58 highway diversion; clear pilgrimage ghats.</p>
              </div>

              <div className="glass-panel-subtle p-3 rounded-lg border-l-2 border-l-[#23a55a]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Zone 3: Rishikesh to Haridwar</span>
                  <span className="text-[10px] font-mono font-bold text-[#23a55a] bg-[#23a55a]/10 px-1.5 py-0.5 rounded">60–105 km</span>
                </div>
                <p className="text-[11px] text-white/70 mt-1">Lead Time: 2h 12m – 3h 30m · Depth: 4.2–9.4m</p>
                <p className="text-[11px] text-[#23a55a] font-semibold mt-1">Action: Regulate barrage gates; prepare relief staging.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {/* Settlements Table */}
            <div className="lg:col-span-7">
              <Panel
                title="Affected Settlements"
                actions={
                  <span className="font-mono text-xs font-semibold text-white/90">
                    {impact.villages.length} locations
                  </span>
                }
              >
                <div className="overflow-x-auto pt-1 max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0C0C0C]/95 backdrop-blur-md">
                      <tr className="border-b border-white/[0.08] text-[#949ba4]">
                        <th className="py-2 text-left font-medium">Settlement</th>
                        <th className="py-2 text-left font-medium">Classification</th>
                        <th className="py-2 text-right font-medium">Arrival</th>
                        <th className="py-2 text-right font-medium">Peak Depth</th>
                        <th className="py-2 text-right font-medium">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {impact.villages.map((v, i) => (
                        <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="py-2 font-medium text-white">{v.name}</td>
                          <td className="py-2 capitalize text-[#949ba4]">{v.kind}</td>
                          <td className="py-2 text-right font-mono text-[#dbdee1]">{formatDuration(v.arrivalS)}</td>
                          <td className="py-2 text-right font-mono text-white font-semibold">{v.depthM.toFixed(2)} m</td>
                          <td className="py-2 text-right">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold',
                              v.depthM > 2 && 'text-[#f23f43]',
                              v.depthM > 0.5 && v.depthM <= 2 && 'text-[#f0b232]',
                              v.depthM <= 0.5 && 'text-[#23a55a]',
                            )}>
                              <span className={cn(
                                'size-1.5 rounded-full',
                                v.depthM > 2 && 'bg-[#f23f43]',
                                v.depthM > 0.5 && v.depthM <= 2 && 'bg-[#f0b232]',
                                v.depthM <= 0.5 && 'bg-[#23a55a]',
                              )} />
                              {v.depthM > 2 ? 'HIGH' : v.depthM > 0.5 ? 'MEDIUM' : 'LOW'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-4">
              {/* Depth Band Breakdown */}
              <Panel title="Inundation Depth Distribution">
                <div className="space-y-3 pt-1">
                  {impact.depthBands.map((db) => {
                    const maxCount = Math.max(...impact.depthBands.map((d) => d.count))
                    const pct = maxCount > 0 ? (db.count / maxCount) * 100 : 0
                    return (
                      <div key={db.band} className="flex items-center gap-3">
                        <span className="w-20 text-xs text-[#949ba4] font-mono shrink-0">{db.band}</span>
                        <div className="flex-1 h-3 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-white to-zinc-400 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-mono font-semibold text-white">{db.count}</span>
                      </div>
                    )
                  })}
                </div>
              </Panel>

              {/* Critical Infrastructure */}
              <Panel title="Critical Infrastructure Assets">
                <div className="space-y-2.5 pt-1">
                  <InfraRow icon={Building2} label="Hospitals & Clinics" items={impact.hospitals} />
                  <InfraRow icon={GraduationCap} label="Schools & Universities" items={impact.schools} />
                  <div className="glass-panel-subtle flex items-center gap-3 rounded-lg p-3">
                    <Route className="size-4 text-[#f0b232] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">Road Network Intersected</p>
                      <p className="text-[11px] text-[#949ba4] font-mono mt-0.5">{formatNumber(impact.roadKm, 1)} km under water</p>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Population */}
              <Panel title="Exposed Population Estimate">
                <div className="glass-panel-subtle rounded-xl p-4 text-center">
                  <Users className="mx-auto size-5 text-white" />
                  <p className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
                    {impact.populationKnown != null ? formatNumber(impact.populationKnown) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-[#949ba4]">
                    Estimated population at risk (WorldPop 100m spatial dataset)
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}

      {isPreview && (
        <PreviewNotice>
          Impact analysis is currently running against analytical Manning preview flood extents. Authoritative figures update when hydrodynamic solver runs complete.
        </PreviewNotice>
      )}
    </div>
  )
}

function InfraRow({
  icon: Icon,
  label,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  items: { name: string; arrivalS: number; depthM: number }[]
}) {
  return (
    <div className="glass-panel-subtle rounded-lg p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[#f23f43] shrink-0" />
        <p className="text-xs font-semibold text-white">{label}</p>
        <span className="ml-auto font-mono text-xs font-bold text-[#f23f43]">{items.length}</span>
      </div>
      {items.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-t border-white/[0.05] pt-2">
          {items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-baseline justify-between text-[11px]">
              <span className="text-[#dbdee1] truncate max-w-[60%]">{item.name}</span>
              <span className="font-mono text-[#949ba4]">
                {item.depthM.toFixed(1)}m · {formatDuration(item.arrivalS)}
              </span>
            </div>
          ))}
          {items.length > 5 && (
            <p className="text-[11px] text-white/80 font-mono">+{items.length - 5} additional assets</p>
          )}
        </div>
      )}
    </div>
  )
}
