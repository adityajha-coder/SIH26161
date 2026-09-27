'use client'

import { useMemo, useState } from 'react'
import { GitCompare, ArrowLeftRight } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice, EmptyState } from '@/components/common/panel'
import { Badge } from '@/components/ui/badge'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, SPH_DOMAIN_KM } from '@/lib/use-flood'
import { SOLVERS, type SolverId } from '@/lib/types'
import { formatNumber, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ComparisonMetrics {
  floodedAreaDiffPct: number
  maxDepthDiffM: number
  arrivalTimeDiffS: number
  reachCoverageRatio: number
  eulerianAreaKm2: number
  sphAreaKm2: number
}

function computeComparison(
  eulerianResult: { floodedAreaKm2: number; maxArrivalS: number; stations: { peakDepthM: number }[] } | null,
  sphResult: { floodedAreaKm2: number; maxArrivalS: number; stations: { peakDepthM: number }[] } | null,
): ComparisonMetrics | null {
  if (!eulerianResult || !sphResult) return null
  const eArea = eulerianResult.floodedAreaKm2
  const sArea = sphResult.floodedAreaKm2
  const eMaxDepth = Math.max(...eulerianResult.stations.map((s) => s.peakDepthM))
  const sMaxDepth = Math.max(...sphResult.stations.map((s) => s.peakDepthM))
  return {
    floodedAreaDiffPct: eArea > 0 ? ((sArea - eArea) / eArea) * 100 : 0,
    maxDepthDiffM: sMaxDepth - eMaxDepth,
    arrivalTimeDiffS: sphResult.maxArrivalS - eulerianResult.maxArrivalS,
    reachCoverageRatio: SPH_DOMAIN_KM / 105,
    eulerianAreaKm2: eArea,
    sphAreaKm2: sArea,
  }
}

export default function ComparePage() {
  const { activeScenario, activeRun } = usePlatform()
  const [leftSolver, setLeftSolver] = useState<SolverId>('delft3d')
  const [rightSolver, setRightSolver] = useState<SolverId>('sph')

  const { result: leftResult, isPreview: leftPreview } = useFloodResult(activeScenario, leftSolver, activeRun)
  const { result: rightResult, isPreview: rightPreview } = useFloodResult(activeScenario, rightSolver, activeRun)

  const metrics = useMemo(() => computeComparison(leftResult, rightResult), [leftResult, rightResult])

  const solverPairs: SolverId[] = ['delft3d', 'sph', 'lisflood']

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Compare & Validate"
        description="Cross-validate solver outputs. Compare Eulerian (Delft3D FM) vs Lagrangian (DualSPHysics) on common grids and metrics."
        actions={
          <Badge variant="outline" className="font-mono text-[10px]">
            <GitCompare className="mr-1 size-3" />
            Solver Comparison
          </Badge>
        }
      />

      {/* Solver Selector */}
      <div className="flex flex-col sm:flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
        <SolverPicker label="Left" value={leftSolver} options={solverPairs} onChange={setLeftSolver} />
        <ArrowLeftRight className="size-5 text-muted-foreground shrink-0" />
        <SolverPicker label="Right" value={rightSolver} options={solverPairs} onChange={setRightSolver} />
      </div>

      {!metrics ? (
        <EmptyState
          title="Awaiting results"
          description="Both solvers need completed runs to generate comparison metrics. Currently using analytical preview data."
        />
      ) : (
        <>
          {/* Metrics Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Flooded Area Δ"
              value={`${metrics.floodedAreaDiffPct >= 0 ? '+' : ''}${metrics.floodedAreaDiffPct.toFixed(1)}%`}
              tone={Math.abs(metrics.floodedAreaDiffPct) < 15 ? 'success' : 'warning'}
              hint={`E: ${formatNumber(metrics.eulerianAreaKm2, 1)} km² · S: ${formatNumber(metrics.sphAreaKm2, 1)} km²`}
            />
            <StatTile
              label="Max Depth Δ"
              value={`${metrics.maxDepthDiffM >= 0 ? '+' : ''}${metrics.maxDepthDiffM.toFixed(2)}`}
              unit="m"
              tone={Math.abs(metrics.maxDepthDiffM) < 1 ? 'success' : 'warning'}
            />
            <StatTile
              label="Arrival Time Δ"
              value={formatDuration(Math.abs(metrics.arrivalTimeDiffS))}
              tone={Math.abs(metrics.arrivalTimeDiffS) < 600 ? 'success' : 'warning'}
              hint={metrics.arrivalTimeDiffS > 0 ? 'SPH slower' : 'SPH faster'}
            />
            <StatTile
              label="SPH Domain Coverage"
              value={`${(metrics.reachCoverageRatio * 100).toFixed(0)}%`}
              hint={`${SPH_DOMAIN_KM} km of 105 km reach`}
            />
          </div>

          {/* Side-by-side station comparison */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`${SOLVERS[leftSolver].name} — Stations`}>
              {leftResult ? (
                <StationTable stations={leftResult.stations} />
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </Panel>
            <Panel title={`${SOLVERS[rightSolver].name} — Stations`}>
              {rightResult ? (
                <StationTable stations={rightResult.stations} />
              ) : (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
            </Panel>
          </div>

          {/* Diagnostics */}
          <Panel title="Diagnostics">
            <dl className="grid grid-cols-2 gap-4 text-xs pt-1 sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Left Solver</dt>
                <dd className="mt-0.5 font-mono text-foreground">{SOLVERS[leftSolver].name} {SOLVERS[leftSolver].version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Right Solver</dt>
                <dd className="mt-0.5 font-mono text-foreground">{SOLVERS[rightSolver].name} {SOLVERS[rightSolver].version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Left Method</dt>
                <dd className="mt-0.5 font-mono text-foreground">{leftResult?.method ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Right Method</dt>
                <dd className="mt-0.5 font-mono text-foreground">{rightResult?.method ?? '—'}</dd>
              </div>
            </dl>
          </Panel>
        </>
      )}

      {(leftPreview || rightPreview) && (
        <PreviewNotice>
          Comparison uses analytical Manning preview data. Real solver outputs will replace these once API runs complete.
        </PreviewNotice>
      )}
    </div>
  )
}

function SolverPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: SolverId
  options: SolverId[]
  onChange: (v: SolverId) => void
}) {
  return (
    <div className="flex-1 w-full">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        {options.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer',
              value === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {SOLVERS[s].name}
          </button>
        ))}
      </div>
    </div>
  )
}

function StationTable({ stations }: { stations: { chainageKm: number; peakDepthM: number; velocityMs: number; arrivalS: number }[] }) {
  const sampled = stations.filter((_, i) => i % Math.max(1, Math.floor(stations.length / 12)) === 0)
  return (
    <div className="overflow-x-auto pt-1">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1.5 text-left font-medium">Chainage</th>
            <th className="py-1.5 text-right font-medium">Depth</th>
            <th className="py-1.5 text-right font-medium">Velocity</th>
            <th className="py-1.5 text-right font-medium">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {sampled.map((s, i) => (
            <tr key={i} className="border-b border-border/40">
              <td className="py-1.5 font-mono">{s.chainageKm.toFixed(1)} km</td>
              <td className="py-1.5 text-right font-mono">{s.peakDepthM.toFixed(2)} m</td>
              <td className="py-1.5 text-right font-mono">{s.velocityMs.toFixed(2)} m/s</td>
              <td className="py-1.5 text-right font-mono">{formatDuration(s.arrivalS)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
