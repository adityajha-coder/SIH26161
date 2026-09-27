'use client'

import { useMemo, useState } from 'react'
import { GitCompare, ArrowLeftRight } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice, EmptyState } from '@/components/common/panel'
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
        title="Cross-Solver Validation"
        description="Hydrodynamic benchmark comparing Eulerian finite-volume (Delft3D FM) against Lagrangian particle hydrodynamics (DualSPHysics)."
      />

      {/* Solver Selector */}
      <div className="glass-panel flex flex-col sm:flex-row items-center gap-4 rounded-xl p-4">
        <SolverPicker label="Reference" value={leftSolver} options={solverPairs} onChange={setLeftSolver} />
        <div className="size-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
          <ArrowLeftRight className="size-4 text-[#7983f5]" />
        </div>
        <SolverPicker label="Comparative" value={rightSolver} options={solverPairs} onChange={setRightSolver} />
      </div>

      {!metrics ? (
        <EmptyState
          title="Awaiting solver execution"
          description="Both solvers require simulation passes to calculate differential hydrodynamics. Analytical Manning data is active."
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
              label="SPH Reach Extent"
              value={`${(metrics.reachCoverageRatio * 100).toFixed(0)}%`}
              hint={`${SPH_DOMAIN_KM} km of 105 km total`}
            />
          </div>

          {/* Side-by-side station comparison */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`${SOLVERS[leftSolver].name} — Reach Stations`}>
              {leftResult ? (
                <StationTable stations={leftResult.stations} />
              ) : (
                <p className="text-xs text-muted-foreground">No data available</p>
              )}
            </Panel>
            <Panel title={`${SOLVERS[rightSolver].name} — Reach Stations`}>
              {rightResult ? (
                <StationTable stations={rightResult.stations} />
              ) : (
                <p className="text-xs text-muted-foreground">No data available</p>
              )}
            </Panel>
          </div>

          {/* Diagnostics */}
          <Panel title="Solver Engine Configuration">
            <dl className="grid grid-cols-2 gap-3 text-xs pt-1 sm:grid-cols-4">
              <div className="glass-panel-subtle p-3 rounded-lg">
                <dt className="text-[#949ba4]">Reference Engine</dt>
                <dd className="mt-1 font-mono text-white font-semibold">{SOLVERS[leftSolver].name} {SOLVERS[leftSolver].version}</dd>
              </div>
              <div className="glass-panel-subtle p-3 rounded-lg">
                <dt className="text-[#949ba4]">Comparative Engine</dt>
                <dd className="mt-1 font-mono text-[#7983f5] font-semibold">{SOLVERS[rightSolver].name} {SOLVERS[rightSolver].version}</dd>
              </div>
              <div className="glass-panel-subtle p-3 rounded-lg">
                <dt className="text-[#949ba4]">Discretization A</dt>
                <dd className="mt-1 font-mono text-white font-semibold">{leftResult?.method ?? 'Eulerian Finite Volume'}</dd>
              </div>
              <div className="glass-panel-subtle p-3 rounded-lg">
                <dt className="text-[#949ba4]">Discretization B</dt>
                <dd className="mt-1 font-mono text-white font-semibold">{rightResult?.method ?? 'Lagrangian SPH Particles'}</dd>
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
      <p className="mb-2 text-xs font-semibold text-[#dbdee1]">{label} solver</p>
      <div className="flex gap-1.5">
        {options.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer',
              value === s
                ? 'border-[#5865f2] bg-[#5865f2]/15 text-[#7983f5] shadow-[0_0_12px_rgba(88,101,242,0.2)]'
                : 'border-white/[0.08] bg-white/[0.02] text-[#949ba4] hover:bg-white/[0.05] hover:text-white',
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
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-[#949ba4]">
            <th className="py-2 text-left font-medium">Chainage</th>
            <th className="py-2 text-right font-medium">Depth</th>
            <th className="py-2 text-right font-medium">Velocity</th>
            <th className="py-2 text-right font-medium">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {sampled.map((s, i) => (
            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-2 font-mono text-white">{s.chainageKm.toFixed(1)} km</td>
              <td className="py-2 text-right font-mono text-[#7983f5]">{s.peakDepthM.toFixed(2)} m</td>
              <td className="py-2 text-right font-mono text-white">{s.velocityMs.toFixed(2)} m/s</td>
              <td className="py-2 text-right font-mono text-[#949ba4]">{formatDuration(s.arrivalS)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
