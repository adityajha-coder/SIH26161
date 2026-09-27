'use client'

import { useState } from 'react'
import { Mountain, MapPin, Compass, Database, CheckCircle2, Clock } from 'lucide-react'
import { Panel } from '@/components/common/panel'
import { Badge } from '@/components/ui/badge'
import { CASES, type CaseStudy, type CaseDataset, type DatasetStatus } from '@/lib/case-study'

export default function CaseStudyPage() {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case-tehri-bhagirathi')
  const activeCase: CaseStudy = CASES.find((c: CaseStudy) => c.id === selectedCaseId) ?? CASES[0]

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
        <div>
          <div className="flex items-center gap-2">
            <Mountain className="size-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">Case Study Dossier</h1>
            <Badge variant="outline" className="font-mono text-[10px]">
              {activeCase.role === 'primary' ? 'Primary Benchmark Case' : 'Regression Sanity Case'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Authoritative river reach geometry, structural dam specifications, and downstream exposure inventory
          </p>
        </div>

        {/* Case Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
          {CASES.map((cs: CaseStudy) => (
            <button
              key={cs.id}
              onClick={() => setSelectedCaseId(cs.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                cs.id === selectedCaseId
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cs.name} ({cs.state})
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Dam Engineering Specs */}
        <div className="lg:col-span-6 space-y-4">
          <Panel
            title="Structural Dam Specifications"
            actions={
              <span className="font-mono text-[11px] text-muted-foreground">
                {activeCase.dam.source}
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Structural Height
                </span>
                <span className="text-lg font-bold font-mono text-primary block mt-0.5">
                  {activeCase.dam.heightM > 0 ? `${activeCase.dam.heightM} m` : 'River Blockage'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  {activeCase.dam.type}
                </span>
              </div>

              <div className="rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Crest Length
                </span>
                <span className="text-lg font-bold font-mono text-primary block mt-0.5">
                  {activeCase.dam.crestLengthM > 0 ? `${activeCase.dam.crestLengthM} m` : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Crest El: {activeCase.dam.crestElevationM > 0 ? `${activeCase.dam.crestElevationM} m a.s.l` : '—'}
                </span>
              </div>

              <div className="rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Gross Storage
                </span>
                <span className="text-lg font-bold font-mono text-success block mt-0.5">
                  {activeCase.dam.grossStorageMcm > 0 ? `${activeCase.dam.grossStorageMcm} MCM` : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Live: {activeCase.dam.liveStorageMcm > 0 ? `${activeCase.dam.liveStorageMcm} MCM` : '—'}
                </span>
              </div>

              <div className="rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Catchment Area
                </span>
                <span className="text-lg font-bold font-mono text-warning block mt-0.5">
                  {activeCase.dam.catchmentKm2 > 0 ? `${activeCase.dam.catchmentKm2} km²` : '—'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Commissioned: {activeCase.dam.commissioned > 0 ? activeCase.dam.commissioned : '—'}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="River Reach & Geography">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">River</span>
                <span className="text-sm font-bold text-foreground block mt-0.5">{activeCase.river}</span>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Reach</span>
                <span className="text-sm font-bold font-mono text-foreground block mt-0.5">{activeCase.reachKm} km</span>
              </div>
              <div className="col-span-2 rounded-md border border-border bg-background/50 p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Bounding Box</span>
                <span className="text-xs font-mono text-foreground block mt-0.5">
                  [{activeCase.bbox.join(', ')}]
                </span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Column: Downstream & Datasets */}
        <div className="lg:col-span-6 space-y-4">
          <Panel title="Downstream Chainage Towns" actions={<Badge variant="outline" className="text-[10px]">{activeCase.downstreamTowns.length} stations</Badge>}>
            <div className="space-y-1.5 pt-1">
              {activeCase.downstreamTowns.map((town: { name: string; lngLat: [number, number]; chainageKm: number }, idx: number) => (
                <div
                  key={town.name}
                  className="flex items-center gap-3 rounded-md border border-border bg-background/50 px-3 py-2.5"
                >
                  <div className="flex size-6 items-center justify-center rounded-full border border-border text-[10px] font-mono text-muted-foreground">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{town.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {town.chainageKm} km · [{town.lngLat[0].toFixed(4)}, {town.lngLat[1].toFixed(4)}]
                    </p>
                  </div>
                  <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Dataset Manifest" actions={<Badge variant="outline" className="text-[10px]">{activeCase.datasets.length} datasets</Badge>}>
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1.5 text-left font-medium">Dataset</th>
                    <th className="py-1.5 text-left font-medium">Source</th>
                    <th className="py-1.5 text-left font-medium">Res</th>
                    <th className="py-1.5 text-left font-medium">CRS</th>
                    <th className="py-1.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCase.datasets.map((ds: CaseDataset) => (
                    <tr key={ds.id} className="border-b border-border/40">
                      <td className="py-1.5 font-medium text-foreground">{ds.name}</td>
                      <td className="py-1.5 text-muted-foreground">{ds.source}</td>
                      <td className="py-1.5 font-mono text-muted-foreground">{ds.resolution}</td>
                      <td className="py-1.5 font-mono text-muted-foreground">{ds.crs}</td>
                      <td className="py-1.5 text-right">
                        {ds.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle2 className="size-3" /> Ready
                          </span>
                        ) : ds.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-warning">
                            <Clock className="size-3" /> Processing
                          </span>
                        ) : (
                          <span className="text-destructive">Missing</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
