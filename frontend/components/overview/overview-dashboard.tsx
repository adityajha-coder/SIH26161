'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Layers,
  Check,
  ChevronDown,
  Settings2,
  X,
  ShieldAlert,
  Clock,
  Compass,
  Waves,
  ArrowRight,
} from 'lucide-react'
import { Panel, PreviewNotice, StatTile } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { SimulationView } from '@/components/flood/simulation-view'
import { SphParticleViewer } from '@/components/sph/sph-particle-viewer'
import { LayerControl } from '@/components/flood/layer-control'
import { TimeControls } from '@/components/flood/time-controls'
import { useSimulationPlayer } from '@/components/flood/use-player'
import { HydrographChart } from '@/components/flood/hydrograph-chart'
import { ArrivalTable, useTownArrivals } from '@/components/flood/arrival-table'
import { DEFAULT_LAYERS, type BaseMode, type LayerVisibility } from '@/components/map/map-style'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, useImpact } from '@/lib/use-flood'
import { CASES, getCaseById } from '@/lib/case-study'
import {
  MASS_BALANCE_TOLERANCE_PCT,
  buildHydrograph,
  froehlichParameters,
  type BreachInput,
  type DamType,
  type FailureMode,
} from '@/lib/breach'
import { formatClock, formatDischarge, formatDuration, formatNumber, formatVolumeMcm } from '@/lib/format'
import type { Scenario, ScenarioType, SolverId } from '@/lib/types'
import { cn } from '@/lib/utils'

const TERRAIN_MODES: { mode: BaseMode; label: string }[] = [
  { mode: 'terrain', label: '3D Terrain' },
  { mode: 'satellite', label: 'Satellite' },
  { mode: 'hillshade', label: 'Hillshade' },
  { mode: 'contour', label: 'Contours' },
]

const FAILURE_MODES: { value: FailureMode; label: string; desc: string }[] = [
  { value: 'overtopping', label: 'Overtopping PMF', desc: 'Probable Maximum Flood crest overtopping' },
  { value: 'piping', label: 'Internal Piping', desc: 'Seepage conduit erosion under sustained head' },
  { value: 'natural_blockage', label: 'GLOF / Blockage', desc: 'Glacial lake or landslide barrier breach' },
  { value: 'spillway_release', label: 'Spillway Surge', desc: 'High-discharge emergency spillway release' },
]

export function OverviewDashboard() {
  const {
    activeScenario,
    activeRun,
    activeCaseId,
    activeCase,
    setActiveCaseId,
    createScenario,
    submitRuns,
  } = usePlatform()

  // 3D Viewport State
  const [base, setBase] = useState<BaseMode>('terrain')
  const [layers, setLayers] = useState<LayerVisibility>({ ...DEFAULT_LAYERS, terrain3d: true, settlements: true })
  const [exaggeration, setExaggeration] = useState(1.5)
  const [floodOpacity, setFloodOpacity] = useState(0.85)
  const [showLayerDrawer, setShowLayerDrawer] = useState(false)

  // Breach Scenario Configuration State (Dynamic per Case Study)
  const [scenarioType, setScenarioType] = useState<ScenarioType>(activeCase?.type ?? 'dam_break')
  const [failureMode, setFailureMode] = useState<FailureMode>(
    activeCase?.type === 'natural_blockage' ? 'natural_blockage' : 'overtopping',
  )
  const [reservoirVolumeMcm, setReservoirVolumeMcm] = useState<number>(
    activeCase?.dam.grossStorageMcm && activeCase.dam.grossStorageMcm > 0 ? activeCase.dam.grossStorageMcm : 3540,
  )
  const [breachHeightM, setBreachHeightM] = useState<number>(
    activeCase?.dam.heightM ? Math.round(activeCase.dam.heightM * 0.9) : 240,
  )
  const [waterDepthM, setWaterDepthM] = useState<number>(
    activeCase?.dam.heightM ? Math.round(activeCase.dam.heightM * 0.85) : 240,
  )
  const [manningN, setManningN] = useState<number>(activeCase?.type === 'natural_blockage' ? 0.055 : 0.045)
  const [horizonH, setHorizonH] = useState<number>(activeCase?.reachKm && activeCase.reachKm <= 40 ? 2 : 4)
  const [selectedSolvers, setSelectedSolvers] = useState<SolverId[]>(['delft3d', 'sph'])
  const [viewportMode, setViewportMode] = useState<'delft3d' | 'sph'>('delft3d')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Dynamically synchronize physical parameters whenever the user switches dam or active scenario
  useEffect(() => {
    if (activeScenario && activeScenario.caseId === activeCaseId) {
      setScenarioType(activeScenario.type)
      setFailureMode(activeScenario.failureMode)
      setReservoirVolumeMcm(Math.round(activeScenario.reservoirVolumeM3 / 1e6))
      setBreachHeightM(activeScenario.breachHeightM)
      setWaterDepthM(Math.min(activeScenario.breachHeightM, Math.round(activeScenario.breachHeightM * 0.95)))
      setManningN(activeScenario.manningN)
      setHorizonH(Math.max(1, Math.round(activeScenario.simulationHorizonS / 3600)))
      if (activeScenario.solvers && activeScenario.solvers.length > 0) {
        setSelectedSolvers(activeScenario.solvers)
      }
    } else if (activeCase) {
      const c = activeCase
      setScenarioType(c.type)
      setFailureMode(c.type === 'natural_blockage' ? 'natural_blockage' : 'overtopping')
      setReservoirVolumeMcm(c.dam.grossStorageMcm > 0 ? c.dam.grossStorageMcm : 100)
      const hb = Math.round(c.dam.heightM * 0.9)
      setBreachHeightM(hb)
      setWaterDepthM(Math.round(c.dam.heightM * 0.85))
      setManningN(c.type === 'natural_blockage' ? 0.055 : c.reachKm > 100 ? 0.038 : 0.045)
      setHorizonH(c.reachKm <= 40 ? 2 : c.reachKm <= 110 ? 4 : 6)
    }
  }, [activeCaseId, activeScenario, activeCase])

  // Real physical bounds tailored for the active dam
  const maxStorageMcm = useMemo(() => {
    const baseStorage = activeCase?.dam.grossStorageMcm ?? 3540
    return Math.max(50, Math.ceil(baseStorage * 1.5))
  }, [activeCase])

  const maxBreachHeightM = useMemo(() => {
    const baseHeight = activeCase?.dam.heightM ?? 260
    return Math.max(15, Math.ceil(baseHeight * 1.05))
  }, [activeCase])

  // Synchronize dam structural type from active case
  const damType: DamType = useMemo(() => {
    const cid = (activeCaseId || '').toLowerCase()
    if (cid.includes('idukki')) return 'concrete_arch'
    if (cid.includes('sarovar') || cid.includes('bhakra')) return 'concrete_gravity'
    return 'rockfill'
  }, [activeCaseId])

  // Live Analytical Breach Physics (Froehlich 2008 & Mass Balance)
  const breachInput: BreachInput = useMemo(
    () => ({
      reservoirVolumeM3: reservoirVolumeMcm * 1e6,
      breachHeightM,
      waterDepthM,
      failureMode,
      damType,
    }),
    [reservoirVolumeMcm, breachHeightM, waterDepthM, failureMode, damType],
  )

  const froehlichParams = useMemo(() => froehlichParameters(breachInput), [breachInput])

  const liveHydrograph = useMemo(
    () => buildHydrograph(froehlichParams, reservoirVolumeMcm * 1e6, horizonH * 3600),
    [froehlichParams, reservoirVolumeMcm, horizonH],
  )

  const massBalanceOk = Math.abs(liveHydrograph.massBalanceErrorPct) <= MASS_BALANCE_TOLERANCE_PCT

  // Construct dynamic live scenario object for instant reactive 3D simulation
  const liveScenario: Scenario = useMemo(() => {
    return {
      id: activeScenario?.id ?? `scn-${activeCaseId}-live`,
      caseId: activeCaseId,
      name: `${activeCase.name} · ${failureMode.replace('_', ' ')} · Hb=${breachHeightM}m`,
      type: scenarioType,
      demVersion: activeCase.datasets.find((d) => d.id === 'dem')?.name ?? 'GLO-30 · UTM44N · v1',
      initialWaterLevelM: activeCase.dam.frlM > 0 ? activeCase.dam.frlM : activeCase.dam.crestElevationM - 5,
      reservoirVolumeM3: reservoirVolumeMcm * 1e6,
      breachHeightM,
      failureMode,
      breachWidthM: froehlichParams.avgWidthM,
      formationTimeS: froehlichParams.formationTimeS,
      peakDischargeM3s: liveHydrograph.peakDischargeM3s,
      manningN,
      downstreamBoundary: 'normal_depth',
      simulationHorizonS: horizonH * 3600,
      solvers: selectedSolvers,
      sensitivity: 'base',
      breachEquation: froehlichParams.equation,
      massBalanceErrorPct: liveHydrograph.massBalanceErrorPct,
      createdAt: activeScenario?.createdAt ?? new Date().toISOString(),
    }
  }, [
    activeScenario,
    activeCaseId,
    activeCase,
    scenarioType,
    failureMode,
    reservoirVolumeMcm,
    breachHeightM,
    froehlichParams,
    liveHydrograph,
    manningN,
    horizonH,
    selectedSolvers,
  ])

  const [cameraTarget, setCameraTarget] = useState<{
    center: [number, number]
    zoom?: number
    pitch?: number
    bearing?: number
    nonce?: number
  } | null>(null)

  // Active hydrodynamic solver and simulation result
  const activeSolver: SolverId = selectedSolvers.includes('delft3d') ? 'delft3d' : 'sph'
  const { result, isPreview } = useFloodResult(liveScenario, activeSolver, activeRun)

  // Physical simulation playback duration dynamically calibrated to the flood transit time of the active dam reach
  const maxS = useMemo(() => {
    if (result && Number.isFinite(result.maxArrivalS) && result.maxArrivalS > 0) {
      return Math.round(result.maxArrivalS)
    }
    return Math.max(1800, horizonH * 3600)
  }, [result, horizonH])
  const player = useSimulationPlayer(maxS, 0)
  const impact = useImpact(result, Infinity, activeCaseId)

  // Real downstream wave arrival computation for top KPI tile
  const primaryTown = useMemo(() => {
    const towns = activeCase.downstreamTowns
    return towns.find((t) => t.chainageKm > 0) ?? towns[0]
  }, [activeCase])

  const townArrivalRows = useTownArrivals(result, activeCase.downstreamTowns)
  const primaryTownRow = townArrivalRows.find((r) => r.town === primaryTown?.name)

  const arrivalDisplay = primaryTownRow?.station
    ? formatClock(primaryTownRow.station.arrivalS)
    : 'Calculating...'

  // Switching preset benchmark dams
  const handleSelectDam = (caseId: string) => {
    setActiveCaseId(caseId)
    const c = getCaseById(caseId)
    const defaultH = c.reachKm <= 40 ? 3 : c.reachKm <= 90 ? (c.id === 'bhakra-dam' ? 7 : 6) : 8
    setHorizonH(defaultH)
    setCameraTarget({
      center: c.center,
      zoom: c.zoom,
      pitch: c.pitch ?? (base === 'terrain' ? 58 : 0),
      bearing: c.bearing ?? (base === 'terrain' ? 195 : 0),
      nonce: Date.now(),
    })
    player.reset()
  }

  // Toggle solver engines
  const toggleSolver = (id: SolverId) => {
    setSelectedSolvers((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id],
    )
  }

  // Run & Apply Simulation Workflow
  const handleRunSimulation = async () => {
    if (selectedSolvers.length === 0) return
    setSubmitting(true)
    try {
      const modeLabel =
        failureMode === 'overtopping'
          ? 'Overtopping PMF'
          : failureMode === 'piping'
          ? 'Piping Failure'
          : failureMode === 'natural_blockage'
          ? 'GLOF Blockage Breach'
          : 'Emergency Spillway Surge'

      const currentCase = getCaseById(activeCaseId)
      const displayName = `${currentCase.name} (${modeLabel}) · Hb=${breachHeightM}m`

      // 1. Force flood depth layer to be visible
      setLayers((prev) => ({ ...prev, floodDepth: true }))

      // 2. Smoothly fly camera to dam breach & river reach
      setCameraTarget({
        center: currentCase.center,
        zoom: currentCase.zoom,
        pitch: currentCase.pitch ?? (base === 'terrain' ? 58 : 0),
        bearing: currentCase.bearing ?? (base === 'terrain' ? 195 : 0),
        nonce: Date.now(),
      })

      const created = await createScenario({
        caseId: activeCaseId,
        name: displayName,
        type: scenarioType,
        demVersion: 'GLO-30 · UTM44N · v1',
        initialWaterLevelM: currentCase.dam.frlM > 0 ? currentCase.dam.frlM : currentCase.dam.crestElevationM - 5,
        reservoirVolumeM3: reservoirVolumeMcm * 1e6,
        breachHeightM,
        failureMode,
        breachWidthM: froehlichParams.avgWidthM,
        formationTimeS: froehlichParams.formationTimeS,
        peakDischargeM3s: liveHydrograph.peakDischargeM3s,
        manningN,
        downstreamBoundary: 'normal_depth',
        simulationHorizonS: horizonH * 3600,
        solvers: selectedSolvers,
        sensitivity: 'base',
        breachEquation: froehlichParams.equation,
        massBalanceErrorPct: liveHydrograph.massBalanceErrorPct,
      })

      if (created) {
        await submitRuns(created.id, selectedSolvers)

        // 3. Immediately trigger simulation animation on map!
        player.reset()
        player.setSpeed(2)
        player.play()

        setNotice(`Simulation active · Propagating dynamic flood wave across ${currentCase.name}`)
        setTimeout(() => setNotice(null), 5000)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleBase = (m: BaseMode) => {
    setBase(m)
    setLayers((l) => ({ ...l, terrain3d: m === 'terrain' }))
  }

  const handleLayers = (next: LayerVisibility) => {
    setLayers(next)
    if (next.terrain3d && base === 'satellite') setBase('terrain')
    if (!next.terrain3d && base === 'terrain') setBase('satellite')
  }

  const toVal = (val: number | readonly number[]): number =>
    Array.isArray(val) ? val[0] : typeof val === 'number' ? val : 0

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-[1700px] mx-auto">
      {/* Benchmark Dam Switcher & Operational Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-white/8 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-white" aria-hidden="true" />
            <h1 className="text-lg font-bold tracking-tight text-white">Digital Twin Studio</h1>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {activeCase?.name ?? 'Dam'} · {activeCase?.river ?? 'River Basin'} ({activeCase?.reachKm ?? 100} km reach) · {activeCase?.state ?? 'India'}
          </p>
        </div>

        {/* Dynamic Benchmark Dam Selector from CASES */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/8 bg-[#121214] p-1">
          {CASES.map((c) => {
            const isSelected = c.id === activeCaseId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectDam(c.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                )}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* 100% Dynamic Top Telemetry KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Peak Discharge Qp"
          value={formatDischarge(liveHydrograph.peakDischargeM3s)}
          unit=""
          tone="danger"
          hint={`${froehlichParams.equation} · Bavg=${formatNumber(froehlichParams.avgWidthM, 1)}m · Tf=${formatDuration(froehlichParams.formationTimeS)}`}
        />
        <StatTile
          label="Reservoir Storage"
          value={formatVolumeMcm(reservoirVolumeMcm * 1e6)}
          unit=""
          hint={`Gross: ${formatNumber(activeCase.dam.grossStorageMcm, 0)} MCM · Live: ${formatNumber(activeCase.dam.liveStorageMcm, 0)} MCM`}
        />
        <StatTile
          label={`Wave Arrival (${primaryTown?.name ?? 'Reach'})`}
          value={arrivalDisplay}
          unit={primaryTown ? `@ ${primaryTown.chainageKm} km` : ''}
          tone="warning"
          hint={
            primaryTownRow?.station
              ? `Peak Depth ${formatNumber(primaryTownRow.station.peakDepthM, 1)} m · Velocity ${formatNumber(primaryTownRow.station.velocityMs, 1)} m/s`
              : 'Hydrodynamic wave bore routing'
          }
        />
        <StatTile
          label="Exposed Population"
          value={impact ? formatNumber(impact.populationKnown) : 'Computing...'}
          unit="residents"
          hint={
            impact
              ? `${impact.villages.length} settlements within ${activeCase.reachKm} km reach`
              : 'Spatial exposure overlay'
          }
        />
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-emerald-400" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-400 hover:text-white cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Main Studio Workspace: Scenario Controls (Left) + 3D Simulation (Right) */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Breach Scenario Configuration Panel */}
        <Panel
          title="Scenario & Breach Parameters"
          className="lg:col-span-5 xl:col-span-4 flex flex-col"
          bodyClassName="p-4 flex flex-col gap-4 overflow-y-auto"
        >
          {/* Failure Mode Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-300">Failure Mode</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {FAILURE_MODES.map((fm) => {
                const active = failureMode === fm.value
                return (
                  <button
                    key={fm.value}
                    type="button"
                    onClick={() => {
                      setFailureMode(fm.value)
                      if (fm.value === 'natural_blockage') setScenarioType('natural_blockage')
                      else if (fm.value === 'spillway_release') setScenarioType('release')
                      else setScenarioType('dam_break')
                    }}
                    className={cn(
                      'flex flex-col items-start rounded-lg border p-2 text-left transition-colors cursor-pointer',
                      active
                        ? 'border-white/40 bg-white/10 text-white'
                        : 'border-white/8 bg-[#121214] text-zinc-400 hover:border-white/20 hover:text-white'
                    )}
                  >
                    <span className="text-xs font-medium">{fm.label}</span>
                    <span className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{fm.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dynamic Physical Parameters Grid tailored to active dam */}
          <div className="space-y-3.5 border-t border-white/8 pt-3.5">
            {/* Reservoir Storage */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label htmlFor="input-volume" className="text-zinc-300 font-medium">Reservoir Storage (Vw)</Label>
                <span className="font-mono text-white font-semibold">{formatNumber(reservoirVolumeMcm, 0)} MCM</span>
              </div>
              <Slider
                id="input-volume"
                aria-label="Reservoir Storage in MCM"
                min={Math.max(1, Math.round(maxStorageMcm * 0.02))}
                max={maxStorageMcm}
                step={maxStorageMcm > 500 ? 50 : 1}
                value={[reservoirVolumeMcm]}
                onValueChange={(v) => setReservoirVolumeMcm(toVal(v))}
              />
            </div>

            {/* Breach Height */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label htmlFor="input-breach-height" className="text-zinc-300 font-medium">Breach Height (hb)</Label>
                <span className="font-mono text-white font-semibold">{breachHeightM} m</span>
              </div>
              <Slider
                id="input-breach-height"
                aria-label="Breach Height in meters"
                min={Math.max(5, Math.round(maxBreachHeightM * 0.1))}
                max={maxBreachHeightM}
                step={maxBreachHeightM > 60 ? 5 : 1}
                value={[breachHeightM]}
                onValueChange={(v) => {
                  const val = toVal(v)
                  setBreachHeightM(val)
                  if (waterDepthM > val) setWaterDepthM(val)
                }}
              />
            </div>

            {/* Water Depth at Failure */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <Label htmlFor="input-water-depth" className="text-zinc-300 font-medium">Water Depth at Breach (hw)</Label>
                <span className="font-mono text-white font-semibold">{waterDepthM} m</span>
              </div>
              <Slider
                id="input-water-depth"
                aria-label="Water Depth in meters"
                min={Math.max(5, Math.round(maxBreachHeightM * 0.08))}
                max={breachHeightM}
                step={maxBreachHeightM > 60 ? 5 : 1}
                value={[waterDepthM]}
                onValueChange={(v) => setWaterDepthM(toVal(v))}
              />
            </div>

            {/* Manning Roughness & Horizon */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="input-manning" className="text-zinc-300 font-medium">Manning n</Label>
                  <span className="font-mono text-white font-semibold">{manningN.toFixed(3)}</span>
                </div>
                <Slider
                  id="input-manning"
                  aria-label="Manning Roughness Coefficient"
                  min={0.025}
                  max={0.070}
                  step={0.005}
                  value={[manningN]}
                  onValueChange={(v) => setManningN(toVal(v))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300 font-medium">Horizon</Label>
                <div className="grid grid-cols-4 gap-1">
                  {[3, 6, 8, 12].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHorizonH(h)}
                      className={cn(
                        'rounded py-1 text-center font-mono text-xs transition-colors cursor-pointer border',
                        horizonH === h
                          ? 'border-white/40 bg-white/10 text-white font-semibold'
                          : 'border-white/8 bg-[#121214] text-zinc-400 hover:text-white'
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Solver Engines Selection */}
          <div className="space-y-2 border-t border-white/8 pt-3.5">
            <Label className="text-xs font-semibold text-zinc-300">Hydrodynamic Solvers</Label>
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/8 bg-[#121214] p-2.5 text-xs text-white hover:border-white/20 transition-colors">
                <Checkbox
                  checked={selectedSolvers.includes('delft3d')}
                  onCheckedChange={() => toggleSolver('delft3d')}
                />
                <div className="flex-1">
                  <p className="font-medium">Delft3D Flexible Mesh</p>
                  <p className="text-[10px] text-zinc-400">2D Depth-Averaged Shallow Water Equations (SWE)</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/8 bg-[#121214] p-2.5 text-xs text-white hover:border-white/20 transition-colors">
                <Checkbox
                  checked={selectedSolvers.includes('sph')}
                  onCheckedChange={() => toggleSolver('sph')}
                />
                <div className="flex-1">
                  <p className="font-medium">DualSPHysics</p>
                  <p className="text-[10px] text-zinc-400">Meshless 3D Lagrangian SPH particle hydrodynamics</p>
                </div>
              </label>
            </div>
          </div>

          {/* Real-Time Analytical Verification Readout */}
          <div className="rounded-lg border border-white/8 bg-[#0C0C0C] p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Froehlich Breach Width (Bavg)</span>
              <span className="font-mono text-white font-medium">{froehlichParams.avgWidthM.toFixed(1)} m</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Formation Time (Tf)</span>
              <span className="font-mono text-white font-medium">{(froehlichParams.formationTimeS / 60).toFixed(1)} min</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 border-t border-white/6 pt-1.5">
              <span>Mass Conservation Error (ΔM)</span>
              <span className={cn('font-mono font-semibold', massBalanceOk ? 'text-emerald-400' : 'text-rose-400')}>
                {liveHydrograph.massBalanceErrorPct.toFixed(3)}% ({massBalanceOk ? 'Conservation Verified' : 'Unbalanced'})
              </span>
            </div>
          </div>

          {/* Action Trigger Button */}
          <Button
            type="button"
            onClick={handleRunSimulation}
            disabled={submitting}
            className="w-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors cursor-pointer h-10 mt-auto"
          >
            {submitting ? 'Synchronizing Solvers...' : 'Apply & Run Simulation'}
          </Button>
        </Panel>

        {/* Right Column: 3D Digital Twin Simulation Viewport */}
        <Panel
          title="Dynamic 3D Simulation"
          className="h-165 lg:col-span-7 xl:col-span-8 flex flex-col"
          bodyClassName="p-3 flex flex-col gap-3 h-[calc(100%-49px)]"
          actions={
            <div className="flex items-center gap-2">
              {/* Solver Switcher: Macro Basin vs 3D SPH Particle Flume */}
              <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => setViewportMode('delft3d')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                    viewportMode === 'delft3d'
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                  )}
                >
                  Macro Basin (SWE)
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('sph')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                    viewportMode === 'sph'
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                  )}
                >
                  3D SPH Fluid Flume
                </button>
              </div>

              {viewportMode === 'delft3d' && (
                <>
                  {/* Terrain Mode Switcher */}
                  <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-black/40 p-1">
                    {TERRAIN_MODES.map((tm) => (
                      <button
                        key={tm.mode}
                        type="button"
                        onClick={() => handleBase(tm.mode)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                          base === tm.mode
                            ? 'bg-white text-black'
                            : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                        )}
                      >
                        {tm.label}
                      </button>
                    ))}
                  </div>

                  {/* Layer Controls Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowLayerDrawer((v) => !v)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                      showLayerDrawer
                        ? 'border-white/30 bg-white/15 text-white'
                        : 'border-white/8 bg-black/40 text-zinc-400 hover:text-white hover:bg-white/5'
                    )}
                    title="Toggle GIS layers & terrain settings"
                  >
                    <Layers className="size-3.5" />
                    <span>Layers</span>
                  </button>
                </>
              )}
            </div>
          }
        >
          {viewportMode === 'sph' ? (
            <div className="relative flex-1 w-full min-h-0 rounded-xl overflow-hidden border border-white/6">
              <SphParticleViewer className="h-full w-full border-0" />
            </div>
          ) : (
            <div className="relative flex h-full flex-col gap-3 min-h-0">
              {/* Simulation Canvas with Dynamic Active Dam Centering */}
              <div className="relative flex-1 min-h-110 w-full rounded-xl overflow-hidden border border-white/6">
                <SimulationView
                  base={base}
                  layers={layers}
                  exaggeration={exaggeration}
                  flood={result?.bands ?? null}
                  timeS={player.timeS}
                  cameraTarget={cameraTarget}
                  className="h-full w-full"
                />

                {/* Floating Layer Controls Overlay Drawer */}
                {showLayerDrawer && (
                  <div className="absolute top-3 right-3 z-30 w-72 rounded-xl border border-white/12 bg-[#0C0C0C]/95 p-3.5 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center justify-between pb-2 border-b border-white/8">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Settings2 className="size-3.5 text-zinc-400" />
                        GIS Layer Control
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowLayerDrawer(false)}
                        className="text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-2">
                      <LayerControl
                        layers={layers}
                        onChange={handleLayers}
                        exaggeration={exaggeration}
                        onExaggerationChange={setExaggeration}
                        floodOpacity={floodOpacity}
                        onFloodOpacityChange={setFloodOpacity}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Time Playback Scrubber Bar */}
              <TimeControls
                timeS={player.timeS}
                maxS={maxS}
                playing={player.playing}
                onToggle={player.toggle}
                onSeek={player.setTimeS}
                onReset={player.reset}
                speed={player.speed}
                onSpeedChange={player.setSpeed}
              />
            </div>
          )}
        </Panel>
      </div>

      {isPreview && <PreviewNotice />}

      {/* Lower Deck: Dynamic Breach Hydrograph and Downstream Wave Arrival */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Dynamic Breach Hydrograph Q(t) */}
        <Panel
          title="Breach Hydrograph Q(t)"
          className="h-130 lg:col-span-6 flex flex-col"
          bodyClassName="p-4 flex flex-col justify-between"
          actions={
            <span className="font-mono text-xs font-semibold text-white">
              Peak {formatDischarge(liveHydrograph.peakDischargeM3s)}
            </span>
          }
        >
          <HydrographChart
            base={liveHydrograph}
            className="h-72 w-full"
          />
          <div className="mt-4 rounded-lg border border-white/8 bg-[#121214] p-3 text-xs text-zinc-300">
            <p className="font-medium text-white">{froehlichParams.equation} Peak Outflow</p>
            <p className="mt-1 text-zinc-400">
              Mass balance error:{' '}
              <span className={cn('font-mono font-semibold', massBalanceOk ? 'text-emerald-400' : 'text-rose-400')}>
                {liveHydrograph.massBalanceErrorPct.toFixed(3)}% ({massBalanceOk ? 'Conservation Verified' : 'Unbalanced'})
              </span>
            </p>
          </div>
        </Panel>

        {/* Downstream Wave Arrival Table (Dynamic per Active Dam) */}
        <Panel
          title={`Downstream Wave Arrival (${activeCase.name})`}
          className="h-130 lg:col-span-6 overflow-hidden"
          bodyClassName="p-4 overflow-y-auto"
          actions={
            <Link
              href="/impact"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              <span>Detailed Impact Analysis</span>
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <ArrivalTable result={result} towns={activeCase.downstreamTowns} />
        </Panel>
      </div>
    </div>
  )
}
