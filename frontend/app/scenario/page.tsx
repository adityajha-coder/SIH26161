'use client'

import { useCallback, useMemo, useState } from 'react'
import { SlidersHorizontal, AlertTriangle, CheckCircle2, Play } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HydrographChart } from '@/components/flood/hydrograph-chart'
import { usePlatform } from '@/lib/platform-store'
import { TEHRI } from '@/lib/case-study'
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
import type { SolverId } from '@/lib/types'

const FAILURE_MODES: { value: FailureMode; label: string }[] = [
  { value: 'overtopping', label: 'Overtopping' },
  { value: 'piping', label: 'Piping' },
]

const SOLVER_OPTIONS: { id: SolverId; label: string }[] = [
  { id: 'delft3d', label: 'Delft3D FM (Eulerian)' },
  { id: 'sph', label: 'DualSPHysics (SPH)' },
  { id: 'lisflood', label: 'LISFLOOD-FP (Fallback)' },
]

export default function ScenarioPage() {
  const { activeScenario, createScenario } = usePlatform()
  const hydro = useScenarioHydrographs(activeScenario)

  const [failureMode, setFailureMode] = useState<FailureMode>('overtopping')
  const [reservoirVolumeM3, setReservoirVolumeM3] = useState(TEHRI.dam.grossStorageMcm * 1e6)
  const [breachHeightM, setBreachHeightM] = useState(240)
  const [waterDepthM, setWaterDepthM] = useState(240)
  const [manningN, setManningN] = useState(0.045)
  const [horizonH, setHorizonH] = useState(6)
  const [selectedSolvers, setSelectedSolvers] = useState<SolverId[]>(['delft3d', 'sph'])
  const [submitting, setSubmitting] = useState(false)

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
      await createScenario({
        caseId: TEHRI.id,
        name: `${failureMode === 'overtopping' ? 'Overtopping' : 'Piping'} · Hb=${breachHeightM}m`,
        type: 'dam_break',
        demVersion: 'GLO-30 · UTM44N · v1',
        initialWaterLevelM: TEHRI.dam.frlM,
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
    } finally {
      setSubmitting(false)
    }
  }, [
    selectedSolvers, createScenario, failureMode, breachHeightM,
    reservoirVolumeM3, waterDepthM, params, hydrograph, manningN, horizonH,
  ])

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Scenario Builder"
        description="Configure breach parameters using Froehlich (2008) empirical relationships. Hydrographs, wave peak, and volume balance calculate dynamically."
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Form */}
        <div className="lg:col-span-5 space-y-4">
          <Panel title="Breach Parameters">
            <div className="space-y-4 pt-1">
              <div>
                <Label className="text-xs font-medium text-[#dbdee1]">Failure mode</Label>
                <div className="mt-1.5 flex gap-1.5">
                  {FAILURE_MODES.map((fm) => (
                    <button
                      key={fm.value}
                      onClick={() => setFailureMode(fm.value)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                        failureMode === fm.value
                          ? 'border-[#5865f2] bg-[#5865f2]/15 text-[#7983f5] shadow-[0_0_12px_rgba(88,101,242,0.2)]'
                          : 'border-white/[0.08] text-[#949ba4] hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {fm.label}
                    </button>
                  ))}
                </div>
              </div>

              <FieldRow label="Reservoir storage" unit="MCM" hint={`${BREACH_BOUNDS.reservoirVolumeM3.min / 1e6}–${BREACH_BOUNDS.reservoirVolumeM3.max / 1e6}`}>
                <Input
                  type="number"
                  value={Math.round(reservoirVolumeM3 / 1e6)}
                  onChange={(e) => setReservoirVolumeM3(Number(e.target.value) * 1e6)}
                />
              </FieldRow>

              <FieldRow label="Breach height" unit="m" hint={`${BREACH_BOUNDS.breachHeightM.min}–${BREACH_BOUNDS.breachHeightM.max}`}>
                <Input
                  type="number"
                  value={breachHeightM}
                  onChange={(e) => setBreachHeightM(Number(e.target.value))}
                  className="font-mono"
                />
              </FieldRow>

              <FieldRow label="Water Depth at Failure" unit="m" hint={`${BREACH_BOUNDS.waterDepthM.min}–${BREACH_BOUNDS.waterDepthM.max}`}>
                <Input
                  type="number"
                  value={waterDepthM}
                  onChange={(e) => setWaterDepthM(Number(e.target.value))}
                  className="font-mono"
                />
              </FieldRow>

              <FieldRow label="Manning's n" unit="" hint="0.025–0.070">
                <Input
                  type="number"
                  step={0.001}
                  value={manningN}
                  onChange={(e) => setManningN(Number(e.target.value))}
                  className="font-mono"
                />
              </FieldRow>

              <FieldRow label="Simulation Horizon" unit="hours" hint="1–24">
                <Input
                  type="number"
                  value={horizonH}
                  onChange={(e) => setHorizonH(Number(e.target.value))}
                  className="font-mono"
                />
              </FieldRow>
            </div>
          </Panel>

          <Panel title="Solver Selection">
            <div className="space-y-2 pt-1">
              {SOLVER_OPTIONS.map((s) => {
                const isSelected = selectedSolvers.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'border-[#5865f2] bg-[#5865f2]/10 text-white shadow-[0_0_12px_rgba(88,101,242,0.15)]'
                        : 'border-white/[0.08] bg-white/[0.02] text-[#949ba4] hover:border-white/[0.16] hover:text-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSolver(s.id)}
                      className="size-4 rounded accent-[#5865f2] cursor-pointer"
                    />
                    <span className="text-xs font-semibold">{s.label}</span>
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
            <StatTile label="Breach Width" value={formatNumber(Math.round(params.avgWidthM))} unit="m" />
            <StatTile label="Formation Time" value={formatDuration(params.formationTimeS)} />
            <StatTile
              label="Mass Balance"
              value={`${hydrograph.massBalanceErrorPct.toFixed(3)}%`}
              tone={massBalanceOk ? 'success' : 'danger'}
              hint={massBalanceOk ? 'Balanced' : `Exceeds ±${MASS_BALANCE_TOLERANCE_PCT}%`}
            />
          </div>

          <Panel
            title="Breach Hydrograph"
            className="h-[340px]"
            actions={
              <span className="font-mono text-xs font-medium text-[#7983f5]">
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

          <Panel title="Validation Checks">
            <div className="space-y-2 pt-1">
              <ValidationRow
                ok={massBalanceOk}
                label="Mass balance convergence"
                detail={`Released ${formatVolumeMcm(hydrograph.releasedVolumeM3)} vs target ${formatVolumeMcm(hydrograph.targetVolumeM3)}`}
              />
              <ValidationRow
                ok={breachHeightM >= 1 && breachHeightM <= 300}
                label="Breach height physical limits"
                detail={`${breachHeightM} m ∈ [${BREACH_BOUNDS.breachHeightM.min}, ${BREACH_BOUNDS.breachHeightM.max}]`}
              />
              <ValidationRow
                ok={reservoirVolumeM3 >= BREACH_BOUNDS.reservoirVolumeM3.min}
                label="Reservoir volume plausibility"
                detail={formatVolumeMcm(reservoirVolumeM3)}
              />
              <ValidationRow
                ok={selectedSolvers.length > 0}
                label="Simulation solver configured"
                detail={selectedSolvers.length > 0 ? selectedSolvers.join(', ') : 'None selected'}
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
            {submitting ? 'Creating Scenario...' : 'Create Scenario & Queue Runs'}
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
