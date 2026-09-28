'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Play } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HydrographChart } from '@/components/flood/hydrograph-chart'
import { usePlatform } from '@/lib/platform-store'
import { TEHRI, SARDAR_SAROVAR, BHAKRA, IDUKKI, getCaseById } from '@/lib/case-study'
import {
  BREACH_BOUNDS,
  MASS_BALANCE_TOLERANCE_PCT,
  buildHydrograph,
  froehlichParameters,
  type BreachInput,
  type FailureMode,
} from '@/lib/breach'
import { formatDischarge, formatDuration, formatNumber, formatVolumeMcm } from '@/lib/format'
import type { SolverId, ScenarioType } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRESETS = [
  {
    id: 'tehri-overtopping',
    label: 'Tehri Dam',
    tag: 'Dam Break',
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
    id: 'sardar-sarovar-pmf',
    label: 'Sardar Sarovar',
    tag: 'Concrete Gravity',
    caseId: SARDAR_SAROVAR.id,
    type: 'dam_break' as ScenarioType,
    failureMode: 'overtopping' as FailureMode,
    volumeMcm: 9500,
    breachHeightM: 155,
    waterDepthM: 145,
    manningN: 0.038,
    horizonH: 8,
  },
  {
    id: 'bhakra-pmf',
    label: 'Bhakra Dam',
    tag: 'High-Head Gravity',
    caseId: BHAKRA.id,
    type: 'dam_break' as ScenarioType,
    failureMode: 'overtopping' as FailureMode,
    volumeMcm: 9621,
    breachHeightM: 215,
    waterDepthM: 205,
    manningN: 0.042,
    horizonH: 7,
  },
  {
    id: 'idukki-arch-breach',
    label: 'Idukki Dam',
    tag: 'Concrete Arch',
    caseId: IDUKKI.id,
    type: 'dam_break' as ScenarioType,
    failureMode: 'overtopping' as FailureMode,
    volumeMcm: 1996,
    breachHeightM: 160,
    waterDepthM: 155,
    manningN: 0.048,
    horizonH: 6,
  },
  {
    id: 'tehri-water-release',
    label: 'Spillway Release',
    tag: 'Controlled Surge',
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
    desc: '2D shallow water equations on unstructured grid',
  },
  {
    id: 'sph',
    label: 'DualSPHysics (Lagrangian SPH)',
    desc: 'Meshless 3D particle hydrodynamics',
  },
]


export default function ScenarioPage() {
  const { activeScenario, createScenario, submitRuns } = usePlatform()
  const router = useRouter()

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

  const applyPreset = (preset: typeof PRESETS[0]) => {
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

  const markCustom = () => setActivePreset('custom')

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
        initialWaterLevelM: getCaseById(selectedCaseId).dam.frlM > 0 ? getCaseById(selectedCaseId).dam.frlM : 1800,
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
      <PageHeader title="Scenario Engine" />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {PRESETS.map((p) => {
          const active = activePreset === p.id
          return (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={cn(
                'shrink-0 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer',
                active
                  ? 'border-white bg-white/10 text-white'
                  : 'border-white/8 text-[#949ba4] hover:border-white/18 hover:text-white',
              )}
            >
              <span className="text-white">{p.label}</span>
              <span className="ml-1.5 text-[10px] font-mono text-white/50">{p.tag}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Peak Outflow" value={formatNumber(Math.round(hydrograph.peakDischargeM3s))} unit="m³/s" tone="danger" />
        <StatTile label="Breach Width" value={formatNumber(Math.round(params.avgWidthM))} unit="m" />
        <StatTile label="Formation Time" value={formatDuration(params.formationTimeS)} />
        <StatTile
          label="Mass Balance"
          value={`${hydrograph.massBalanceErrorPct.toFixed(3)}%`}
          tone={massBalanceOk ? 'success' : 'danger'}
          hint={massBalanceOk ? 'Balanced' : `Exceeds ±${MASS_BALANCE_TOLERANCE_PCT}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">

        {/* Left: Parameters */}
        <div className="lg:col-span-5 space-y-4">

          {/* Failure Mode */}
          <Panel title="Failure Mode">
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {FAILURE_MODES.map((fm) => (
                <button
                  key={fm.value}
                  onClick={() => {
                    setFailureMode(fm.value)
                    markCustom()
                    if (fm.value === 'natural_blockage') setScenarioType('natural_blockage')
                    else if (fm.value === 'spillway_release') setScenarioType('release')
                    else setScenarioType('dam_break')
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold text-left transition-all cursor-pointer',
                    failureMode === fm.value
                      ? 'border-white bg-white/10 text-white'
                      : 'border-white/8 text-[#949ba4] hover:bg-white/4 hover:text-white',
                  )}
                >
                  <div>{fm.label}</div>
                  <div className="text-[10px] text-white/50 font-normal">{fm.tag}</div>
                </button>
              ))}
            </div>
          </Panel>

          {/* Breach Parameters */}
          <Panel title="Breach Parameters">
            <div className="space-y-3.5 pt-0.5">
              <FieldRow label="Reservoir Storage" unit="MCM" hint={`${BREACH_BOUNDS.reservoirVolumeM3.min / 1e6}–${BREACH_BOUNDS.reservoirVolumeM3.max / 1e6}`}>
                <Input type="number" value={Math.round(reservoirVolumeM3 / 1e6)} onChange={(e) => { setReservoirVolumeM3(Number(e.target.value) * 1e6); markCustom() }} className="font-mono" />
              </FieldRow>
              <FieldRow label="Breach Height" unit="m" hint={`${BREACH_BOUNDS.breachHeightM.min}–${BREACH_BOUNDS.breachHeightM.max}`}>
                <Input type="number" value={breachHeightM} onChange={(e) => { setBreachHeightM(Number(e.target.value)); markCustom() }} className="font-mono" />
              </FieldRow>
              <FieldRow label="Water Depth at Failure" unit="m" hint={`${BREACH_BOUNDS.waterDepthM.min}–${BREACH_BOUNDS.waterDepthM.max}`}>
                <Input type="number" value={waterDepthM} onChange={(e) => { setWaterDepthM(Number(e.target.value)); markCustom() }} className="font-mono" />
              </FieldRow>
              <FieldRow label="Manning's n" unit="" hint="0.025 – 0.070">
                <Input type="number" step={0.001} value={manningN} onChange={(e) => { setManningN(Number(e.target.value)); markCustom() }} className="font-mono" />
              </FieldRow>
              <FieldRow label="Simulation Horizon" unit="hours" hint="1–24">
                <Input type="number" value={horizonH} onChange={(e) => { setHorizonH(Number(e.target.value)); markCustom() }} className="font-mono" />
              </FieldRow>
            </div>
          </Panel>

          {/* Solver Selection */}
          <Panel title="Solvers">
            <div className="space-y-2 pt-0.5">
              {SOLVER_OPTIONS.map((s) => {
                const isSelected = selectedSolvers.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150',
                      isSelected
                        ? 'border-white/50 bg-white/10 text-white'
                        : 'border-white/8 bg-white/2 text-[#949ba4] hover:border-white/16 hover:text-white',
                    )}
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

        {/* Right: Chart + Validation + Submit */}
        <div className="lg:col-span-7 space-y-4">
          <Panel
            title="Breach Outflow Hydrograph Q(t)"
            className="h-85"
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

          {/* Validation Checks */}
          <Panel title="Verification">
            <div className="space-y-2 pt-0.5">
              <ValidationRow
                ok={massBalanceOk}
                label="Volume Conservation"
                detail={`Released ${formatVolumeMcm(hydrograph.releasedVolumeM3)} / Impounded ${formatVolumeMcm(hydrograph.targetVolumeM3)} (${hydrograph.massBalanceErrorPct.toFixed(2)}%)`}
              />
              <ValidationRow
                ok={breachHeightM >= 1 && breachHeightM <= 300}
                label="Elevation Bounds"
                detail={`${breachHeightM} m within [${BREACH_BOUNDS.breachHeightM.min}, ${BREACH_BOUNDS.breachHeightM.max}] m`}
              />
              <ValidationRow
                ok={true}
                label="Hydraulic Formulation"
                detail={params.equation}
              />
              <ValidationRow
                ok={selectedSolvers.length > 0}
                label="Solver Selection"
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
            {submitting ? 'Creating Scenario...' : 'Create Scenario & Queue Simulation'}
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
