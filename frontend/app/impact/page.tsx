'use client'

import { ShieldAlert, Users, Building2, GraduationCap, Route } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice, EmptyState } from '@/components/common/panel'
import { Badge } from '@/components/ui/badge'
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
        title="Impact Assessment"
        description="Exposure and loss analysis — settlements, critical infrastructure, population at risk, and depth-band breakdown from the active scenario run."
        actions={
          <Badge variant="outline" className="font-mono text-[10px]">
            <ShieldAlert className="mr-1 size-3" />
            Exposure Analysis
          </Badge>
        }
      />

      {!impact ? (
        <EmptyState
          title="No impact data"
          description="Run a simulation to generate impact results. Impact is computed by intersecting flood layers with downstream asset inventories."
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile
              label="Villages Affected"
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
              label="Road Length"
              value={formatNumber(impact.roadKm, 1)}
              unit="km"
              tone="warning"
            />
            <StatTile
              label="Flooded Area"
              value={formatNumber(result?.floodedAreaKm2 ?? 0, 1)}
              unit="km²"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {/* Settlements Table */}
            <div className="lg:col-span-7">
              <Panel title="Affected Settlements" actions={<Badge variant="outline" className="text-[10px]">{impact.villages.length} settlements</Badge>}>
                <div className="overflow-x-auto pt-1 max-h-[400px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-1.5 text-left font-medium">Settlement</th>
                        <th className="py-1.5 text-left font-medium">Type</th>
                        <th className="py-1.5 text-right font-medium">Arrival</th>
                        <th className="py-1.5 text-right font-medium">Depth</th>
                        <th className="py-1.5 text-right font-medium">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {impact.villages.map((v, i) => (
                        <tr key={i} className="border-b border-border/40">
                          <td className="py-1.5 font-medium text-foreground">{v.name}</td>
                          <td className="py-1.5 capitalize text-muted-foreground">{v.kind}</td>
                          <td className="py-1.5 text-right font-mono">{formatDuration(v.arrivalS)}</td>
                          <td className="py-1.5 text-right font-mono">{v.depthM.toFixed(2)} m</td>
                          <td className="py-1.5 text-right">
                            <span className={cn(
                              'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold',
                              v.depthM > 2 && 'bg-destructive/10 text-destructive',
                              v.depthM > 0.5 && v.depthM <= 2 && 'bg-warning/10 text-warning',
                              v.depthM <= 0.5 && 'bg-success/10 text-success',
                            )}>
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
              <Panel title="Depth Band Breakdown">
                <div className="space-y-2 pt-1">
                  {impact.depthBands.map((db) => {
                    const maxCount = Math.max(...impact.depthBands.map((d) => d.count))
                    const pct = maxCount > 0 ? (db.count / maxCount) * 100 : 0
                    return (
                      <div key={db.band} className="flex items-center gap-3">
                        <span className="w-20 text-[11px] text-muted-foreground font-mono shrink-0">{db.band}</span>
                        <div className="flex-1 h-4 rounded-sm bg-background border border-border overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-sm transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] font-mono text-foreground">{db.count}</span>
                      </div>
                    )
                  })}
                </div>
              </Panel>

              {/* Critical Infrastructure */}
              <Panel title="Critical Infrastructure">
                <div className="space-y-2 pt-1">
                  <InfraRow icon={Building2} label="Hospitals" items={impact.hospitals} />
                  <InfraRow icon={GraduationCap} label="Schools" items={impact.schools} />
                  <div className="flex items-center gap-2.5 rounded-md border border-border bg-background/40 px-3 py-2.5">
                    <Route className="size-4 text-warning shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">Roads Affected</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{formatNumber(impact.roadKm, 1)} km submerged</p>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Population */}
              <Panel title="Population at Risk">
                <div className="rounded-md border border-border bg-background/40 px-3 py-3 text-center">
                  <Users className="mx-auto size-5 text-destructive" />
                  <p className="mt-2 text-2xl font-bold font-mono text-foreground">
                    {impact.populationKnown != null ? formatNumber(impact.populationKnown) : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Estimated exposed population (WorldPop 100m grid intersection)
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}

      {isPreview && (
        <PreviewNotice>
          Impact analysis uses analytical Manning preview flood extents. Real solver results from the API will produce authoritative figures.
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
    <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-destructive shrink-0" />
        <p className="text-xs font-medium text-foreground">{label}</p>
        <Badge variant="outline" className="ml-auto text-[10px]">{items.length}</Badge>
      </div>
      {items.length > 0 && (
        <div className="mt-2 space-y-1">
          {items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-baseline justify-between text-[10px]">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-mono text-foreground">
                {item.depthM.toFixed(1)}m · {formatDuration(item.arrivalS)}
              </span>
            </div>
          ))}
          {items.length > 5 && (
            <p className="text-[10px] text-muted-foreground">+{items.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  )
}
