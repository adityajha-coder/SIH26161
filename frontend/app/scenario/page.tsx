'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, AlertTriangle, CheckCircle2, Play, Sparkles, Mountain, Waves, ShieldAlert } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HydrographChart } from '@/components/flood/hydrograph-chart'
import { usePlatform } from '@/lib/platform-store'
import { TEHRI, CHAMOLI } from '@/lib/case-study'
import {
  BREACH_BOUNDS,
  MASS_BALANCE_TOLERANCE_PCT,
  buildHydrograph,
  froehlichParameters,
  type BreachInput,
  type FailureMode,
} from '@/lib/breach'
import { formatDischarge, formatDuration, formatNumber, formatVolumeMcm } from '@/lib/format'
import { useScenarioHydrographs } from '@/lib/use-hydrograph'
import type { SolverId, ScenarioType } from '@/lib/types'

const CRISIS_PRESETS = [
  {
    id: 'tehri-overtopping',
    title: 'Tehri Dam Overtopping (PMF)',
    subtitle: '105 km Bhagirathi Reach · 3,540 MCM · Extreme Wave Surge',
    badge: 'Structural Dam Break',
    caseId: TEHRI.id,
    type: 'dam_break' as ScenarioType,
    failureMode: 'overtopping' as FailureMode,
    volumeMcm: 3540,
    breachHeightM: 240,
    waterDepthM: 240,
    manningN: 0.045,
    horizonH: 6,
  },
  {
    id: 'rishiganga-2021',
    title: 'Rishi Ganga 2021 Debris Blockage',
    subtitle: '25 km Reach to Tapovan · Rock-Ice Avalanche Lake Outburst (Chamoli)',
    badge: 'Natural Lake / GLOF',
    caseId: CHAMOLI.id,
    type: 'natural_blockage' as ScenarioType,
    failureMode: 'natural_blockage' as FailureMode,
    volumeMcm: 12.5,
    breachHeightM: 35,
    waterDepthM: 32,
    manningN: 0.055,
    horizonH: 4,
  },
  {
    id: 'tehri-water-release',
    title: 'Emergency Spillway Water Release',
    subtitle: 'Full Reservoir Level (FRL 830m) · 15,300 m³/s Controlled Surge',
    badge: 'Spillway Water Release',
    caseId: TEHRI.id,
    type: 'release' as ScenarioType,
    failureMode: 'spillway_release' as FailureMode,
    volumeMcm: 1800,
    breachHeightM: 45,
    waterDepthM: 22,
    manningN: 0.038,
    horizonH: 8,
  },
]

const FAILURE_MODES: { value: FailureMode; label: string; tag: string }[] = [
  { value: 'overtopping', label: 'Overtopping Breach', tag: 'Dam Break' },
  { value: 'piping', label: 'Internal Piping', tag: 'Dam Break' },
  { value: 'natural_blockage', label: 'River Blockage / GLOF', tag: 'Natural Lake' },
  { value: 'spillway_release', label: 'Emergency Water Release', tag: 'Spillway Surge' },
]

const SOLVER_OPTIONS: { id: SolverId; label: string; desc: string }[] = [
  {
    id: 'delft3d',
    label: 'Delft3D FM (Eulerian SWE)',
    desc: 'Unstructured grid 2D shallow water equations for 105 km downstream corridor',
  },
  {
    id: 'sph',
    label: 'DualSPHysics (Lagrangian SPH)',
    desc: 'Meshless 3D particle hydrodynamics for near-field violent canyon turbulence',
  },
]

export default function ScenarioPage() {
  const { activeScenario, createScenario, submitRuns } = usePlatform()
  const router = useRouter()
  const hydro = useScenarioHydrographs(activeScenario)

  const [activePreset, setActivePreset] = useState<string>('tehri-overtopping')
  const [selectedCaseId, setSelectedCaseId] = useState<string>(TEHRI.id)
  const [scenarioType, setScenarioType] = useState<ScenarioType>('dam_break')
  const [failureMode, setFailureMode] = useState<FailureMode>('overtopping')
  const [reservoirVolumeM3, setReservoirVolumeM3] = useState(TEHRI.dam.grossStorageMcm * 1e6)
  const [breachHeightM, setBreachHeightM] = useState(240)
  const [waterDepthM, setWaterDepthM] = useState(240)
  const [manningN, setManningN] = useState(0.045)
  const [horizonH, setHorizonH] = useState(6)
  const [selectedSolvers, setSelectedSolvers] = useState<SolverId[]>(['delft3d', 'sph'])
  const [submitting, setSubmitting] = useState(false)

  const applyPreset = (preset: typeof CRISIS_PRESETS[0]) => {
    setActivePreset(preset.id)
    setSelectedCaseId(preset.caseId)
    setScenarioType(preset.type)
    setFailureMode(preset.failureMode)
    setReservoirVolumeM3(preset.volumeMcm * 1e6)
    setBreachHeightM(preset.breachHeightM)
    setWaterDepthM(preset.waterDepthM)
    setManningN(preset.manningN)
    setHorizonH(preset.horizonH)
  }

  const input: BreachInput = useMemo(
    () => ({ reservoirVolumeM3, breachHeightM, waterDepthM, failureMode }),
    [reservoirVolumeM3, breachHeightM, waterDepthM, failureMode],
  )

  const params = useMemo(() => froehlichParameters(input), [input])
  const hydrograph = useMemo(
    () => buildHydrograph(params, reservoirVolumeM3, horizonH * 3600),
    [params, reservoirVolumeM3, horizonH],
  )

  const massBalanceOk = Math.abs(hydrograph.massBalanceErrorPct) <= MASS_BALANCE_TOLERANCE_PCT

  const toggleSolver = (id: SolverId) =>
    setSelectedSolvers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )

  const handleSubmit = useCallback(async () => {
    if (selectedSolvers.length === 0) return
    setSubmitting(true)
    try {
      const modeLabel =
        failureMode === 'overtopping'
          ? 'Overtopping PMF'
          : failureMode === 'piping'
          ? 'Piping Failure'
          : failureMode === 'natural_blockage'
          ? 'Natural Lake Blockage Breach'
          : 'Emergency Spillway Surge'

      const created = await createScenario({
        caseId: selectedCaseId,
        name: `${modeLabel} · Hb=${breachHeightM}m`,
        type: scenarioType,
        demVersion: 'GLO-30 · UTM44N · v1',
        initialWaterLevelM: selectedCaseId === TEHRI.id ? TEHRI.dam.frlM : 1800,
        reservoirVolumeM3,
        breachHeightM,
        failureMode,
        breachWidthM: params.avgWidthM,
        formationTimeS: params.formationTimeS,
        peakDischargeM3s: hydrograph.peakDischargeM3s,
        manningN,
        downstreamBoundary: 'normal_depth',
        simulationHorizonS: horizonH * 3600,
        solvers: selectedSolvers,
        sensitivity: 'base',
        breachEquation: params.equation,
        massBalanceErrorPct: hydrograph.massBalanceErrorPct,
      })

      if (created) {
        await submitRuns(created.id, selectedSolvers)
        router.push('/runs')
      }
    } finally {
      setSubmitting(false)
    }
  }, [
    selectedSolvers, createScenario, submitRuns, router, selectedCaseId, failureMode, scenarioType, breachHeightM,
    reservoirVolumeM3, params, hydrograph, manningN, horizonH,
  ])

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Breach & Water Surge Scenario Engine"
        description="Unified hydrodynamic scenario generator for structural dam breaks, natural landslide dam blockages (e.g. Rishi Ganga 2021), and emergency reservoir spillway water release."
      />

      {/* Preset Quick-Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-white" />
            Calibrated Disaster Scenarios (Problem Statement Presets)
          </span>
          <span className="text-[11px] text-white/50">One-click parameters</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {CRISIS_PRESETS.map((preset) => {
            const isCurrent = activePreset === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-white bg-white/10 text-white'
                    : 'border-white/[0.08] bg-white/[0.02] text-[#949ba4] hover:border-white/[0.18] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{preset.title}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-white shrink-0">
                    {preset.badge}
                  </span>
                </div>
                <p className="text-[11px] text-white/60 mt-1 leading-snug">{preset.subtitle}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Form */}
        <div className="lg:col-span-5 space-y-4">
          <Panel title="Hazard & Breach Parameters">
            <div className="space-y-4 pt-1">
              <div>
                <Label className="text-xs font-medium text-[#dbdee1]">Failure / Inundation Mode</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {FAILURE_MODES.map((fm) => (
                    <button
                      key={fm.value}
                      onClick={() => {
                        setFailureMode(fm.value)
                        setActivePreset('custom')
                        if (fm.value === 'natural_blockage') setScenarioType('natural_blockage')
                        else if (fm.value === 'spillway_release') setScenarioType('release')
                        else setScenarioType('dam_break')
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold text-left transition-all cursor-pointer ${
                        failureMode === fm.value
                          ? 'border-white bg-white/10 text-white'
                          : 'border-white/[0.08] text-[#949ba4] hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <div>{fm.label}</div>
                      <div className="text-[10px] text-white/50 font-normal">{fm.tag}</div>
                    </button>
                  ))}
                </div>
              </div>

              <FieldRow
                label="Reservoir / Impounded Storage"
                unit="MCM"
                hint={`${BREACH_BOUNDS.reservoirVolumeM3.min / 1e6}–${BREACH_BOUNDS.reservoirVolumeM3.max / 1e6} MCM`}
              >
                <Input
                  type="number"
                  value={Math.round(reservoirVolumeM3 / 1e6)}
                  onChange={(e) => {
                    setReservoirVolumeM3(Number(e.target.value) * 1e6)
                    setActivePreset('custom')
                  }}
                />
              </FieldRow>

              <FieldRow
                label="Breach / Dam Height"
                unit="m"
                hint={`${BREACH_BOUNDS.breachHeightM.min}–${BREACH_BOUNDS.breachHeightM.max} m`}
              >
                <Input
                  type="number"
                  value={breachHeightM}
                  onChange={(e) => {
                    setBreachHeightM(Number(e.target.value))
                    setActivePreset('custom')
                  }}
                  className="font-mono"
                />
              </FieldRow>

              <FieldRow
                label="Water Depth at Failure"
                unit="m"
                hint={`${BREACH_BOUNDS.waterDepthM.min}–${BREACH_BOUNDS.waterDepthM.max} m`}
              >
                <Input
                  type="number"
                  value={waterDepthM}
                  onChange={(e) => {
                    setWaterDepthM(Number(e.target.value))
                    setActivePreset('custom')
                  }}
                  className="font-mono"
                />
              </FieldRow>

              <FieldRow label="Bed Roughness (Manning's n)" unit="" hint="0.025 (smooth) – 0.070 (boulders)">
                <Input
                  type="number"
                  step={0.001}
                  value={manningN}
                  onChange={(e) => {
                    setManningN(Number(e.target.value))
                    setActivePreset('custom')
                  }}
                  className="font-mono"
                />
              </FieldRow>

              <FieldRow label="Simulation Horizon" unit="hours" hint="1–24 hours">
                <Input
                  type="number"
                  value={horizonH}
                  onChange={(e) => {
                    setHorizonH(Number(e.target.value))
                    setActivePreset('custom')
                  }}
                  className="font-mono"
                />
              </FieldRow>
            </div>
          </Panel>

          <Panel title="Multi-Physics Solvers (DualSPHysics & Delft3D)">
            <div className="space-y-2.5 pt-1">
              {SOLVER_OPTIONS.map((s) => {
                const isSelected = selectedSolvers.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'border-white/50 bg-white/10 text-white'
                        : 'border-white/[0.08] bg-white/[0.02] text-[#949ba4] hover:border-white/[0.16] hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSolver(s.id)}
                      className="mt-0.5 size-4 rounded accent-white cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white">{s.label}</div>
                      <div className="text-[11px] text-white/60 mt-0.5">{s.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </Panel>
        </div>

        {/* Right: Computed Output */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Peak Outflow" value={formatNumber(Math.round(hydrograph.peakDischargeM3s))} unit="m³/s" tone="danger" />
            <StatTile label="Breach / Gate Width" value={formatNumber(Math.round(params.avgWidthM))} unit="m" />
            <StatTile label="Formation / Ramp Time" value={formatDuration(params.formationTimeS)} />
            <StatTile
              label="Mass Balance"
              value={`${hydrograph.massBalanceErrorPct.toFixed(3)}%`}
              tone={massBalanceOk ? 'success' : 'danger'}
              hint={massBalanceOk ? 'Balanced' : `Exceeds ±${MASS_BALANCE_TOLERANCE_PCT}%`}
            />
          </div>

          <Panel
            title="Breach Outflow Hydrograph Q(t)"
            className="h-[340px]"
            actions={
              <span className="font-mono text-xs font-medium text-white">
                Peak {formatDischarge(hydrograph.peakDischargeM3s)}
              </span>
            }
          >
            {hydrograph ? (
              <HydrographChart base={hydrograph} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Calculating...
              </div>
            )}
          </Panel>

          <Panel title="Hydrodynamic Model Provenance & Verification">
            <div className="space-y-2 pt-1">
              <ValidationRow
                ok={massBalanceOk}
                label="Volumetric Conservation"
                detail={`Released ${formatVolumeMcm(hydrograph.releasedVolumeM3)} vs impounded ${formatVolumeMcm(hydrograph.targetVolumeM3)} (Error: ${hydrograph.massBalanceErrorPct.toFixed(2)}%)`}
              />
              <ValidationRow
                ok={breachHeightM >= 1 && breachHeightM <= 300}
                label="Physical Elevation Bounds"
                detail={`${breachHeightM} m elevation depth (Valid in [${BREACH_BOUNDS.breachHeightM.min}, ${BREACH_BOUNDS.breachHeightM.max}] m)`}
              />
              <ValidationRow
                ok={true}
                label="Governing Hydraulic Formulation"
                detail={params.equation}
              />
              <ValidationRow
                ok={selectedSolvers.length > 0}
                label="Dual-Model Verification"
                detail={selectedSolvers.length > 0 ? selectedSolvers.map((s) => (s === 'delft3d' ? 'Delft3D FM' : 'DualSPHysics')).join(' + ') : 'None selected'}
              />
            </div>
          </Panel>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !massBalanceOk || selectedSolvers.length === 0}
            className="w-full h-11 text-sm font-semibold rounded-xl"
            size="lg"
          >
            <Play className="mr-2 size-4" />
            {submitting ? 'Creating Scenario...' : 'Create Scenario & Queue Dual-Solver Run'}
          </Button>
        </div>
      </div>

      <PreviewNotice />
    </div>
  )
}

function FieldRow({
  label,
  unit,
  hint,
  children,
}: {
  label: string
  unit: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <Label className="text-xs font-medium text-[#dbdee1]">{label}</Label>
        {unit && <span className="text-xs text-[#949ba4] font-mono">{unit}</span>}
      </div>
      <div>{children}</div>
      {hint && <p className="mt-1 text-[11px] text-[#949ba4]">Bounds: {hint}</p>}
    </div>
  )
}

function ValidationRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="glass-panel-subtle flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 transition-colors">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#23a55a]" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#f23f43]" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[11px] text-[#949ba4] font-mono mt-0.5">{detail}</p>
      </div>
    </div>
  )
}
