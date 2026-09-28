'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Check, Waves, Layers } from 'lucide-react'
import { PageHeader, EmptyState, PreviewNotice } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, SPH_DOMAIN_KM } from '@/lib/use-flood'
import { SOLVERS, type SolverId } from '@/lib/types'
import { formatNumber, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function ComparePage() {
  const { activeScenario, activeRun } = usePlatform()
  const [leftSolver, setLeftSolver] = useState<SolverId>('delft3d')
  const [rightSolver, setRightSolver] = useState<SolverId>('sph')

  const { result: leftResult, isPreview: leftPreview } = useFloodResult(activeScenario, leftSolver, activeRun)
  const { result: rightResult, isPreview: rightPreview } = useFloodResult(activeScenario, rightSolver, activeRun)

  const solverPairs: SolverId[] = ['delft3d', 'sph']

  // Delta calculations
  const comparison = useMemo(() => {
    if (!leftResult || !rightResult) return null

    const leftArea = leftResult.floodedAreaKm2
    const rightArea = rightResult.floodedAreaKm2
    const areaDiffPct = leftArea > 0 ? ((rightArea - leftArea) / leftArea) * 100 : 0

    const leftMaxDepth = Math.max(...leftResult.stations.map((s) => s.peakDepthM))
    const rightMaxDepth = Math.max(...rightResult.stations.map((s) => s.peakDepthM))
    const depthDiffM = rightMaxDepth - leftMaxDepth

    const arrivalDiffS = rightResult.maxArrivalS - leftResult.maxArrivalS

    // Build unified station comparison rows (sampling evenly along reach)
    const sampledLeft = leftResult.stations.filter(
      (_, i) => i % Math.max(1, Math.floor(leftResult.stations.length / 10)) === 0
    )

    const tableRows = sampledLeft.map((ls) => {
      const matchRight = rightResult.stations.find(
        (rs) => Math.abs(rs.chainageKm - ls.chainageKm) < 2.5
      )
      return {
        chainageKm: ls.chainageKm,
        leftDepth: ls.peakDepthM,
        leftVelocity: ls.velocityMs,
        leftArrival: ls.arrivalS,
        rightDepth: matchRight?.peakDepthM,
        rightVelocity: matchRight?.velocityMs,
        rightArrival: matchRight?.arrivalS,
        depthDiff: matchRight ? matchRight.peakDepthM - ls.peakDepthM : undefined,
      }
    })

    return {
      leftArea,
      rightArea,
      areaDiffPct,
      leftMaxDepth,
      rightMaxDepth,
      depthDiffM,
      arrivalDiffS,
      tableRows,
    }
  }, [leftResult, rightResult])

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Clean Header - No subheadings */}
      <PageHeader
        title="Cross-Solver Validation"
        actions={
          activeScenario ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/8 text-white/80">
              <span className="size-1.5 rounded-full bg-white/70" />
              {activeScenario.name}
            </span>
          ) : undefined
        }
      />

      {/* Solver Selectors */}
      <div className="glass-panel rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
        {/* Left Solver */}
        <div className="flex-1 w-full">
          <span className="text-[11px] font-medium text-white/40 block mb-2">Reference Model</span>
          <div className="grid grid-cols-2 gap-2">
            {solverPairs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeftSolver(id)}
                className={cn(
                  'px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  leftSolver === id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/2 border-white/6 text-white/50 hover:bg-white/4 hover:text-white/80'
                )}
              >
                <div className="text-xs font-semibold">{SOLVERS[id].name}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{SOLVERS[id].kind}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center Divider Icon */}
        <div className="size-8 rounded-full bg-white/4 border border-white/8 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="size-3.5 text-white/60" />
        </div>

        {/* Right Solver */}
        <div className="flex-1 w-full">
          <span className="text-[11px] font-medium text-white/40 block mb-2">Comparative Model</span>
          <div className="grid grid-cols-2 gap-2">
            {solverPairs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightSolver(id)}
                className={cn(
                  'px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  rightSolver === id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/2 border-white/6 text-white/50 hover:bg-white/4 hover:text-white/80'
                )}
              >
                <div className="text-xs font-semibold">{SOLVERS[id].name}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{SOLVERS[id].kind}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!comparison ? (
        <EmptyState
          title="Awaiting solver execution"
          description="Simulation output required for cross-solver comparison."
        />
      ) : (
        <>
          {/* Key Delta Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass-panel rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-white/50">Flooded Footprint Δ</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {comparison.areaDiffPct >= 0 ? '+' : ''}
                  {comparison.areaDiffPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono">
                {formatNumber(comparison.leftArea, 1)} vs {formatNumber(comparison.rightArea, 1)} km²
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-white/50">Peak Water Depth Δ</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {comparison.depthDiffM >= 0 ? '+' : ''}
                  {comparison.depthDiffM.toFixed(2)} m
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono">
                {comparison.leftMaxDepth.toFixed(1)} vs {comparison.rightMaxDepth.toFixed(1)} m max
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-white/50">Arrival Time Offset</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {formatDuration(Math.abs(comparison.arrivalDiffS))}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono">
                {comparison.arrivalDiffS > 0 ? `${SOLVERS[rightSolver].name} lagging` : 'Consistent leading edge'}
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5">
              <span className="text-[11px] font-medium text-white/50">SPH Domain Extent</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-white tabular-nums">
                  {SPH_DOMAIN_KM} km
                </span>
                <span className="text-xs text-white/40 font-mono">/ 105 km</span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono">
                Near-field dam-break reach
              </div>
            </div>
          </div>

          {/* Unified Station Comparison Table */}
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-3.5 border-b border-white/6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-white" />
                <span className="text-xs font-semibold text-white">Reach Station Hydrodynamics</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-white/40">
                <span>{SOLVERS[leftSolver].name} (Ref)</span>
                <span>vs</span>
                <span>{SOLVERS[rightSolver].name}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/6 text-white/40 text-[11px]">
                    <th className="py-2.5 px-4 text-left font-medium">Chainage</th>
                    <th className="py-2.5 px-3 text-right font-medium">{SOLVERS[leftSolver].name} Depth</th>
                    <th className="py-2.5 px-3 text-right font-medium">{SOLVERS[rightSolver].name} Depth</th>
                    <th className="py-2.5 px-3 text-right font-medium">Depth Δ</th>
                    <th className="py-2.5 px-3 text-right font-medium">Velocity (Ref)</th>
                    <th className="py-2.5 px-4 text-right font-medium">Arrival (Ref)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {comparison.tableRows.map((row, i) => {
                    const hasRight = row.rightDepth !== undefined
                    const diff = row.depthDiff ?? 0
                    return (
                      <tr key={i} className="hover:bg-white/2 transition-colors font-mono">
                        <td className="py-2.5 px-4 text-white font-medium">
                          {row.chainageKm.toFixed(1)} km
                        </td>
                        <td className="py-2.5 px-3 text-right text-white">
                          {row.leftDepth.toFixed(2)} m
                        </td>
                        <td className="py-2.5 px-3 text-right text-white">
                          {hasRight ? `${row.rightDepth!.toFixed(2)} m` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {hasRight ? (
                            <span
                              className={cn(
                                'text-[11px] font-semibold',
                                Math.abs(diff) < 0.5 ? 'text-white/60' : diff > 0 ? 'text-amber-400' : 'text-blue-400'
                              )}
                            >
                              {diff >= 0 ? '+' : ''}
                              {diff.toFixed(2)} m
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/30">Past domain</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-white/70">
                          {row.leftVelocity.toFixed(1)} m/s
                        </td>
                        <td className="py-2.5 px-4 text-right text-white/60">
                          {formatDuration(row.leftArrival)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Method Specifications */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">{SOLVERS.delft3d.name}</span>
                <span className="text-[10px] font-mono text-white/40">{SOLVERS.delft3d.version}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-white/6">
                <div>
                  <span className="text-[10px] text-white/40 block">Formulation</span>
                  <span className="text-white text-[11px]">Eulerian Shallow Water</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Domain Scale</span>
                  <span className="text-white text-[11px]">105 km Valley Basin</span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">{SOLVERS.sph.name}</span>
                <span className="text-[10px] font-mono text-white/40">{SOLVERS.sph.version}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-white/6">
                <div>
                  <span className="text-[10px] text-white/40 block">Formulation</span>
                  <span className="text-white text-[11px]">Lagrangian Particle SPH</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Domain Scale</span>
                  <span className="text-white text-[11px]">45 km Near-Field Surge</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {(leftPreview || rightPreview) && (
        <PreviewNotice>
          Comparison active on Manning hydraulic baseline. Solver output syncs upon simulation completion.
        </PreviewNotice>
      )}
    </div>
  )
}
