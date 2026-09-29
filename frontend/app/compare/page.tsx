'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { ArrowLeftRight, Check, ChevronDown, Activity, Cpu } from 'lucide-react'
import { EmptyState, PreviewNotice } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, SPH_DOMAIN_KM } from '@/lib/use-flood'
import { CASES } from '@/lib/case-study'
import { SOLVERS, type SolverId } from '@/lib/types'
import { formatNumber, formatDuration } from '@/lib/format'
import { ProvenanceBadge } from '@/components/common/provenance-badge'
import { SphParticleViewer } from '@/components/sph/sph-particle-viewer'
import { cn } from '@/lib/utils'

export default function ComparePage() {
  const { activeScenario, activeRun, activeCaseId, activeCase, setActiveCaseId } = usePlatform()
  const [leftSolver, setLeftSolver] = useState<SolverId>('delft3d')
  const [rightSolver, setRightSolver] = useState<SolverId>('sph')
  const [isDamMenuOpen, setIsDamMenuOpen] = useState(false)
  const damMenuRef = useRef<HTMLDivElement>(null)

  // Interactive Chart Hover State
  const [hoveredKm, setHoveredKm] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Close dam menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (damMenuRef.current && !damMenuRef.current.contains(e.target as Node)) {
        setIsDamMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { result: leftResult, isPreview: leftPreview } = useFloodResult(activeScenario, leftSolver, activeRun)
  const { result: rightResult, isPreview: rightPreview } = useFloodResult(activeScenario, rightSolver, activeRun)

  const solverPairs: SolverId[] = ['delft3d', 'sph']
  const effectiveSphDomainKm = Math.min(SPH_DOMAIN_KM, activeCase.reachKm)

  const handleSwapSolvers = () => {
    setLeftSolver(rightSolver)
    setRightSolver(leftSolver)
  }

  // Cross-solver comparison calculations & metrics
  const comparison = useMemo(() => {
    if (!leftResult || !rightResult) return null

    const leftArea = leftResult.floodedAreaKm2
    const rightArea = rightResult.floodedAreaKm2
    const areaDiffPct = leftArea > 0 ? ((rightArea - leftArea) / leftArea) * 100 : 0

    const leftMaxDepth = Math.max(...(leftResult.stations.map((s) => s.peakDepthM) || [0]))
    const rightMaxDepth = Math.max(...(rightResult.stations.map((s) => s.peakDepthM) || [0]))
    const depthDiffM = rightMaxDepth - leftMaxDepth

    const baseStations =
      (leftResult.stations?.length ?? 0) >= (rightResult.stations?.length ?? 0)
        ? leftResult.stations
        : rightResult.stations

    if (!baseStations || baseStations.length === 0) return null

    // Overlapping stations in the near-field domain
    const overlappingStations: { leftDepth: number; rightDepth: number }[] = []
    baseStations.forEach((bs) => {
      const ls = leftResult.stations.find((s) => Math.abs(s.chainageKm - bs.chainageKm) < 1.0)
      const rs = rightResult.stations.find((s) => Math.abs(s.chainageKm - bs.chainageKm) < 1.0)
      if (ls && rs) {
        overlappingStations.push({ leftDepth: ls.peakDepthM, rightDepth: rs.peakDepthM })
      }
    })

    const n = overlappingStations.length
    const mae =
      n > 0
        ? overlappingStations.reduce((acc, s) => acc + Math.abs(s.rightDepth - s.leftDepth), 0) / n
        : 0
    const rmse =
      n > 0
        ? Math.sqrt(
            overlappingStations.reduce(
              (acc, s) => acc + Math.pow(s.rightDepth - s.leftDepth, 2),
              0
            ) / n
          )
        : 0

    // Sample ~12 evenly spaced stations for table inspection
    const step = Math.max(1, Math.floor(baseStations.length / 12))
    const sampledStations = baseStations.filter((_, i) => i % step === 0 || i === baseStations.length - 1)

    const tableRows = sampledStations.map((bs) => {
      const ls = leftResult.stations.find((s) => Math.abs(s.chainageKm - bs.chainageKm) < 1.5)
      const rs = rightResult.stations.find((s) => Math.abs(s.chainageKm - bs.chainageKm) < 1.5)
      const nearbyTown = activeCase.downstreamTowns?.find(
        (t) => Math.abs(t.chainageKm - bs.chainageKm) <= 2.5
      )

      const lDepth = ls?.peakDepthM ?? 0
      const rDepth = rs?.peakDepthM
      const lVel = ls?.velocityMs ?? 0
      const froudeL = lDepth > 0 ? lVel / Math.sqrt(9.81 * lDepth) : 0

      return {
        chainageKm: bs.chainageKm,
        townName: nearbyTown?.name,
        leftDepth: lDepth,
        leftVelocity: lVel,
        leftArrival: ls?.arrivalS ?? 0,
        rightDepth: rDepth,
        depthDiff: rDepth !== undefined ? rDepth - lDepth : undefined,
        froude: froudeL,
      }
    })

    return {
      leftArea,
      rightArea,
      areaDiffPct,
      leftMaxDepth,
      rightMaxDepth,
      depthDiffM,
      mae,
      rmse,
      overlapCount: n,
      tableRows,
      allStations: baseStations,
    }
  }, [leftResult, rightResult, activeCase])

  // Profile Chart Dimensions & Coordinate Mappers
  const chartConfig = useMemo(() => {
    if (!comparison || !comparison.allStations.length) return null

    const width = 860
    const height = 220
    const padding = { top: 20, right: 30, bottom: 35, left: 45 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    const maxReach = Math.max(activeCase.reachKm, 10)
    const maxDepth = Math.max(
      15,
      Math.ceil((Math.max(comparison.leftMaxDepth, comparison.rightMaxDepth) * 1.15) / 5) * 5
    )

    const getX = (km: number) => padding.left + (Math.min(km, maxReach) / maxReach) * plotWidth
    const getY = (depth: number) => padding.top + plotHeight - (Math.max(0, depth) / maxDepth) * plotHeight

    const createPath = (stations: { chainageKm: number; peakDepthM: number }[]) => {
      if (!stations.length) return ''
      return stations.reduce((acc, pt, idx) => {
        const x = getX(pt.chainageKm)
        const y = getY(pt.peakDepthM)
        return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      }, '')
    }

    const createArea = (stations: { chainageKm: number; peakDepthM: number }[]) => {
      if (!stations.length) return ''
      const line = createPath(stations)
      const firstX = getX(stations[0].chainageKm)
      const lastX = getX(stations[stations.length - 1].chainageKm)
      const zeroY = getY(0)
      return `${line} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${firstX.toFixed(1)} ${zeroY.toFixed(1)} Z`
    }

    const leftStations = leftResult?.stations || []
    const rightStations = rightResult?.stations || []

    const leftLine = createPath(leftStations)
    const leftArea = createArea(leftStations)
    const rightLine = createPath(rightStations)
    const rightArea = createArea(rightStations)

    const yTicks = Array.from({ length: 5 }, (_, i) => (maxDepth / 4) * i)

    const xStep = maxReach > 100 ? 25 : maxReach > 50 ? 15 : 10
    const xTicks: number[] = []
    for (let k = 0; k <= maxReach; k += xStep) {
      xTicks.push(k)
    }
    if (xTicks[xTicks.length - 1] < maxReach - 5) {
      xTicks.push(maxReach)
    }

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      maxReach,
      getX,
      getY,
      leftLine,
      leftArea,
      rightLine,
      rightArea,
      yTicks,
      xTicks,
    }
  }, [comparison, activeCase, leftResult, rightResult])

  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartConfig || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * chartConfig.width

    if (svgX < chartConfig.padding.left || svgX > chartConfig.width - chartConfig.padding.right) {
      setHoveredKm(null)
      return
    }

    const relX = svgX - chartConfig.padding.left
    const km = (relX / chartConfig.plotWidth) * chartConfig.maxReach
    setHoveredKm(Math.max(0, Math.min(km, chartConfig.maxReach)))
  }

  const hoveredData = useMemo(() => {
    if (hoveredKm === null || !comparison) return null
    const ls = leftResult?.stations.find((s) => Math.abs(s.chainageKm - hoveredKm) < 1.5)
    const rs = rightResult?.stations.find((s) => Math.abs(s.chainageKm - hoveredKm) < 1.5)
    const town = activeCase.downstreamTowns?.find(
      (t) => Math.abs(t.chainageKm - hoveredKm) < 2.5
    )
    return {
      km: hoveredKm,
      leftDepth: ls?.peakDepthM,
      rightDepth: rs?.peakDepthM,
      townName: town?.name,
    }
  }, [hoveredKm, comparison, leftResult, rightResult, activeCase])

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header: Clean, professional, with dynamic Dam Selector Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Cross-Solver Validation
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <ProvenanceBadge type="numerical_swe_2d" variant="compact" />
          <ProvenanceBadge type="sph_trajectory_precomputed" variant="compact" />

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

      {/* Solver Selectors Bar */}
      <div className="glass-panel rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 border border-white/8">
        <div className="flex-1 w-full">
          <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider block mb-2">
            Reference Model (Baseline)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {solverPairs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLeftSolver(id)}
                className={cn(
                  'px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  leftSolver === id
                    ? 'bg-white/10 border-white/20 text-white shadow-sm'
                    : 'bg-white/2 border-white/6 text-white/50 hover:bg-white/4 hover:text-white/80'
                )}
              >
                <div className="text-xs font-semibold">{SOLVERS[id].name}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{SOLVERS[id].kind}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSwapSolvers}
          className="size-8 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-sm my-1 sm:my-0"
          title="Swap reference and comparative models"
        >
          <ArrowLeftRight className="size-3.5 text-white/70" />
        </button>

        <div className="flex-1 w-full">
          <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider block mb-2">
            Comparative Model (Evaluated)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {solverPairs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightSolver(id)}
                className={cn(
                  'px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer',
                  rightSolver === id
                    ? 'bg-white/10 border-white/20 text-white shadow-sm'
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
          {/* Key Validation Delta Statistics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass-panel rounded-xl p-3.5 border border-white/8">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                Flooded Footprint Δ
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-white tabular-nums">
                  {comparison.areaDiffPct >= 0 ? '+' : ''}
                  {comparison.areaDiffPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono truncate">
                {formatNumber(comparison.leftArea, 1)} vs {formatNumber(comparison.rightArea, 1)} km²
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                Peak Crest Depth Δ
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-white tabular-nums">
                  {comparison.depthDiffM >= 0 ? '+' : ''}
                  {comparison.depthDiffM.toFixed(2)} m
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono truncate">
                {comparison.leftMaxDepth.toFixed(1)} vs {comparison.rightMaxDepth.toFixed(1)} m max
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                Near-Field RMSE (Overlap)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-white tabular-nums">
                  {comparison.rmse.toFixed(2)} m
                </span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono truncate">
                MAE: {comparison.mae.toFixed(2)} m (N={comparison.overlapCount})
              </div>
            </div>

            <div className="glass-panel rounded-xl p-3.5 border border-white/8">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                SPH Domain Boundary
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-bold font-mono text-white tabular-nums">
                  {effectiveSphDomainKm} km
                </span>
                <span className="text-xs text-white/40 font-mono">/ {activeCase.reachKm} km</span>
              </div>
              <div className="mt-1 text-[11px] text-white/40 font-mono truncate">
                Near-field dam surge domain
              </div>
            </div>
          </div>

          {/* Interactive Longitudinal Water Depth Profile Chart */}
          {chartConfig && (
            <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-white/6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="size-3.5 text-white/60" />
                    Longitudinal Water Depth Profile (h vs x)
                  </h2>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Wave crest comparison along the {activeCase.reachKm} km {activeCase.river} corridor
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-cyan-400" />
                    <span className="text-white/80">{SOLVERS[leftSolver].name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-400" />
                    <span className="text-white/80">{SOLVERS[rightSolver].name}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1.5 text-white/40">
                    <span className="border-t border-dashed border-white/40 w-4 inline-block" />
                    <span>SPH Boundary</span>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-5 relative select-none">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                  className="w-full h-auto overflow-visible cursor-crosshair"
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={() => setHoveredKm(null)}
                >
                  <defs>
                    <linearGradient id="grad-left" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="grad-right" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines & Y-Axis Labels */}
                  {chartConfig.yTicks.map((yVal, idx) => {
                    const y = chartConfig.getY(yVal)
                    return (
                      <g key={idx}>
                        <line
                          x1={chartConfig.padding.left}
                          y1={y}
                          x2={chartConfig.width - chartConfig.padding.right}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.06)"
                          strokeDasharray={idx === 0 ? 'none' : '3 3'}
                        />
                        <text
                          x={chartConfig.padding.left - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="fill-white/40 text-[10px] font-mono"
                        >
                          {yVal.toFixed(0)}m
                        </text>
                      </g>
                    )
                  })}

                  {/* SPH Domain Boundary Vertical Line */}
                  {effectiveSphDomainKm < chartConfig.maxReach && (
                    <g>
                      <line
                        x1={chartConfig.getX(effectiveSphDomainKm)}
                        y1={chartConfig.padding.top}
                        x2={chartConfig.getX(effectiveSphDomainKm)}
                        y2={chartConfig.height - chartConfig.padding.bottom}
                        stroke="rgba(245, 158, 11, 0.45)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartConfig.getX(effectiveSphDomainKm) + 4}
                        y={chartConfig.padding.top + 12}
                        className="fill-amber-400/70 text-[9px] font-mono"
                      >
                        SPH Limit ({effectiveSphDomainKm} km)
                      </text>
                    </g>
                  )}

                  {/* Town Markers along X Axis */}
                  {activeCase.downstreamTowns?.map((town, idx) => {
                    if (town.chainageKm > chartConfig.maxReach) return null
                    const x = chartConfig.getX(town.chainageKm)
                    return (
                      <g key={idx}>
                        <line
                          x1={x}
                          y1={chartConfig.height - chartConfig.padding.bottom - 4}
                          x2={x}
                          y2={chartConfig.height - chartConfig.padding.bottom + 4}
                          stroke="rgba(255, 255, 255, 0.3)"
                        />
                        <text
                          x={x}
                          y={chartConfig.height - chartConfig.padding.bottom + 16}
                          textAnchor="middle"
                          className="fill-white/50 text-[9px] font-medium"
                        >
                          {town.name}
                        </text>
                      </g>
                    )
                  })}

                  <path d={chartConfig.leftArea} fill="url(#grad-left)" />
                  <path
                    d={chartConfig.leftLine}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <path d={chartConfig.rightArea} fill="url(#grad-right)" />
                  <path
                    d={chartConfig.rightLine}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* X-Axis Ticks & Base Line */}
                  <line
                    x1={chartConfig.padding.left}
                    y1={chartConfig.height - chartConfig.padding.bottom}
                    x2={chartConfig.width - chartConfig.padding.right}
                    y2={chartConfig.height - chartConfig.padding.bottom}
                    stroke="rgba(255, 255, 255, 0.15)"
                  />
                  {chartConfig.xTicks.map((xVal, idx) => {
                    const x = chartConfig.getX(xVal)
                    return (
                      <g key={idx}>
                        <text
                          x={x}
                          y={chartConfig.height - chartConfig.padding.bottom + 28}
                          textAnchor="middle"
                          className="fill-white/40 text-[10px] font-mono"
                        >
                          {xVal} km
                        </text>
                      </g>
                    )
                  })}

                  {/* Interactive Cursor Tracking Line & Dots */}
                  {hoveredKm !== null && hoveredData && (
                    <g>
                      <line
                        x1={chartConfig.getX(hoveredKm)}
                        y1={chartConfig.padding.top}
                        x2={chartConfig.getX(hoveredKm)}
                        y2={chartConfig.height - chartConfig.padding.bottom}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeDasharray="2 2"
                      />
                      {hoveredData.leftDepth !== undefined && (
                        <circle
                          cx={chartConfig.getX(hoveredKm)}
                          cy={chartConfig.getY(hoveredData.leftDepth)}
                          r="4"
                          className="fill-cyan-400 stroke-[#0C0C0C] stroke-2"
                        />
                      )}
                      {hoveredData.rightDepth !== undefined && (
                        <circle
                          cx={chartConfig.getX(hoveredKm)}
                          cy={chartConfig.getY(hoveredData.rightDepth)}
                          r="4"
                          className="fill-amber-400 stroke-[#0C0C0C] stroke-2"
                        />
                      )}
                    </g>
                  )}
                </svg>

                {/* Floating Interactive Hover Tooltip */}
                {hoveredData && (
                  <div
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 pointer-events-none rounded-xl bg-[#121214]/95 border border-white/12 p-3 shadow-2xl backdrop-blur-md text-xs font-mono z-20 space-y-1.5 animate-in fade-in duration-100"
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-1.5">
                      <span className="font-semibold text-white">
                        Chainage {hoveredData.km.toFixed(1)} km
                      </span>
                      {hoveredData.townName && (
                        <span className="text-[10px] text-white/50 bg-white/6 px-1.5 py-0.5 rounded">
                          📍 {hoveredData.townName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 text-cyan-300">
                      <span>{SOLVERS[leftSolver].name}:</span>
                      <span className="font-bold">
                        {hoveredData.leftDepth !== undefined
                          ? `${hoveredData.leftDepth.toFixed(2)} m`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-amber-300">
                      <span>{SOLVERS[rightSolver].name}:</span>
                      <span className="font-bold">
                        {hoveredData.rightDepth !== undefined
                          ? `${hoveredData.rightDepth.toFixed(2)} m`
                          : 'Past domain'}
                      </span>
                    </div>
                    {hoveredData.leftDepth !== undefined && hoveredData.rightDepth !== undefined && (
                      <div className="flex items-center justify-between gap-4 text-white/60 border-t border-white/6 pt-1 text-[11px]">
                        <span>Depth Δ:</span>
                        <span
                          className={cn(
                            'font-bold',
                            hoveredData.rightDepth - hoveredData.leftDepth >= 0
                              ? 'text-amber-400'
                              : 'text-cyan-400'
                          )}
                        >
                          {hoveredData.rightDepth - hoveredData.leftDepth >= 0 ? '+' : ''}
                          {(hoveredData.rightDepth - hoveredData.leftDepth).toFixed(2)} m
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DualSPHysics 3D Particle Flume Benchmark Visualizer */}
          <SphParticleViewer />

          {/* Unified Station Hydrodynamics Table */}
          <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-white/6 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Reach Station Hydrodynamics
                </h2>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Point-by-point wave crest, velocity, and hydraulic flow regime
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-white/40">
                <span className="text-cyan-400">{SOLVERS[leftSolver].name}</span>
                <span>vs</span>
                <span className="text-amber-400">{SOLVERS[rightSolver].name}</span>
              </div>
            </div>

            <div className="w-full overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/6 text-white/40 text-[11px]">
                    <th className="py-2.5 pl-4 sm:pl-5 pr-3 font-medium whitespace-nowrap">
                      Station / Chainage
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                      {SOLVERS[leftSolver].name} Depth
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                      {SOLVERS[rightSolver].name} Depth
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                      Depth Δ
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                      Peak Velocity
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                      Wave Arrival
                    </th>
                    <th className="py-2.5 pl-3 pr-4 sm:pr-5 text-right font-medium whitespace-nowrap">
                      Flow Regime (Fr)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {comparison.tableRows.map((row, i) => {
                    const hasRight = row.rightDepth !== undefined
                    const diff = row.depthDiff ?? 0
                    return (
                      <tr key={i} className="hover:bg-white/3 transition-colors font-mono">
                        <td className="py-3 pl-4 sm:pl-5 pr-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {row.chainageKm.toFixed(1)} km
                            </span>
                            {row.townName && (
                              <span className="text-[10px] font-sans font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                📍 {row.townName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-cyan-300 font-semibold whitespace-nowrap">
                          {row.leftDepth.toFixed(2)} m
                        </td>
                        <td className="py-3 px-3 text-right text-amber-300 font-semibold whitespace-nowrap">
                          {hasRight ? `${row.rightDepth!.toFixed(2)} m` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {hasRight ? (
                            <span
                              className={cn(
                                'text-[11px] font-semibold',
                                Math.abs(diff) < 0.4
                                  ? 'text-white/60'
                                  : diff > 0
                                  ? 'text-amber-400'
                                  : 'text-cyan-400'
                              )}
                            >
                              {diff >= 0 ? '+' : ''}
                              {diff.toFixed(2)} m
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/30 font-sans">
                              Past SPH domain
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-white/80 whitespace-nowrap">
                          {row.leftVelocity.toFixed(1)} m/s
                        </td>
                        <td className="py-3 px-3 text-right text-white/60 whitespace-nowrap">
                          {formatDuration(row.leftArrival)}
                        </td>
                        <td className="py-3 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded font-sans',
                              row.froude >= 1.0
                                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            )}
                          >
                            {row.froude >= 1.0 ? 'Supercritical' : 'Subcritical'} (Fr {row.froude.toFixed(1)})
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Solver Formulation & Capability Specifications */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel rounded-xl p-4 border border-white/8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">
                    {SOLVERS.delft3d.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ProvenanceBadge type="numerical_swe_2d" variant="compact" />
                  <span className="text-[10px] font-mono text-white/40">
                    {SOLVERS.delft3d.version}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-white/6">
                <div>
                  <span className="text-[10px] text-white/40 block">Formulation</span>
                  <span className="text-white text-[11px] font-medium">
                    Eulerian 2D Shallow Water (SWE)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Spatial Reach</span>
                  <span className="text-white text-[11px] font-medium">
                    {activeCase.reachKm} km Full River Basin
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] text-white/40 block">Mesh Architecture</span>
                  <span className="text-white text-[11px]">Unstructured Flexible Mesh</span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] text-white/40 block">Primary Application</span>
                  <span className="text-white text-[11px]">Far-field floodplain routing</span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-white/8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">
                    {SOLVERS.sph.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ProvenanceBadge type="sph_trajectory_precomputed" variant="compact" />
                  <span className="text-[10px] font-mono text-white/40">
                    {SOLVERS.sph.version}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-white/6">
                <div>
                  <span className="text-[10px] text-white/40 block">Formulation</span>
                  <span className="text-white text-[11px] font-medium">
                    Lagrangian Particle SPH (WCSPH)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">Spatial Reach</span>
                  <span className="text-white text-[11px] font-medium">
                    0–{effectiveSphDomainKm} km Near-Field Gorge
                  </span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] text-white/40 block">Particle Spacing</span>
                  <span className="text-white text-[11px]">Δp = 0.5 m (CUDA GPU)</span>
                </div>
                <div className="pt-1">
                  <span className="text-[10px] text-white/40 block">Primary Application</span>
                  <span className="text-white text-[11px]">Violent free-surface splash & wall bounce</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {(leftPreview || rightPreview) && (
        <PreviewNotice>
          Cross-validation currently rendered from hydrodynamic Manning wave routing. Solvers automatically synchronize upon full cluster simulation completion.
        </PreviewNotice>
      )}
    </div>
  )
}
