'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Play, Sliders, Sparkles, Compass } from 'lucide-react'
import { Panel, PageHeader, StatTile, PreviewNotice } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HydrographChart } from '@/components/flood/hydrograph-chart'
import { ProvenanceBadge } from '@/components/common/provenance-badge'
import { usePlatform } from '@/lib/platform-store'
import { TEHRI, SARDAR_SAROVAR, BHAKRA, IDUKKI, RISHI_GANGA, getCaseById } from '@/lib/case-study'
import {
  BREACH_BOUNDS,
  MASS_BALANCE_TOLERANCE_PCT,
  buildHydrograph,
  froehlichParameters,
  type BreachInput,
  type DamType,
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
    id: 'rishi-ganga-blockage',
    label: 'Rishi Ganga',
    tag: 'Natural Landslide / Ice Dam',
    caseId: RISHI_GANGA.id,
    type: 'natural_blockage' as ScenarioType,
    failureMode: 'natural_blockage' as FailureMode,
    volumeMcm: 12.5,
    breachHeightM: 25,
    waterDepthM: 25,
    manningN: 0.055,
    horizonH: 3,
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

  // Custom Dam Wizard State
  const [wizardMode, setWizardMode] = useState<'presets' | 'custom_wizard'>('presets')
  const [customDamName, setCustomDamName] = useState('Subansiri Lower Hydroelectric Project')
  const [customRiver, setCustomRiver] = useState('Subansiri River Basin')
  const [customState, setCustomState] = useState('Arunachal Pradesh / Assam')
  const [customDamType, setCustomDamType] = useState<DamType>('concrete_gravity')
  const [customSlope, setCustomSlope] = useState(0.008)
  const [customReachKm, setCustomReachKm] = useState(75)

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

  const damType: DamType = useMemo(() => {
    if (wizardMode === 'custom_wizard') return customDamType
    const cid = (selectedCaseId || '').toLowerCase()
    if (cid.includes('idukki')) return 'concrete_arch'
    if (cid.includes('sarovar') || cid.includes('bhakra')) return 'concrete_gravity'
    return 'rockfill'
  }, [selectedCaseId, wizardMode, customDamType])

  const waveCelerityMs = useMemo(() => {
    const g = 9.81
    const meanH = Math.max(2.0, breachHeightM * 0.35)
    return Math.sqrt(g * meanH) * (1 + 1.2 * Math.sqrt(customSlope))
  }, [breachHeightM, customSlope])

  const customStations = useMemo(() => {
    const r = customReachKm
    return [
      { name: 'Dam Toe', km: 0, timeMin: 0 },
      { name: 'Upper Gorge', km: Math.round(r * 0.2), timeMin: Math.max(1, Math.round((r * 0.2 * 1000) / (waveCelerityMs * 60))) },
      { name: 'Middle Confluence', km: Math.round(r * 0.5), timeMin: Math.max(2, Math.round((r * 0.5 * 1000) / (waveCelerityMs * 60))) },
      { name: 'Valley Terminal', km: r, timeMin: Math.max(5, Math.round((r * 1000) / (waveCelerityMs * 60))) },
    ]
  }, [customReachKm, waveCelerityMs])

  const input: BreachInput = useMemo(
    () => ({ reservoirVolumeM3, breachHeightM, waterDepthM, failureMode, damType }),
    [reservoirVolumeM3, breachHeightM, waterDepthM, failureMode, damType],
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

      const displayName =
        wizardMode === 'custom_wizard'
          ? `${customDamName} (${modeLabel}) · Hb=${breachHeightM}m`
          : `${modeLabel} · Hb=${breachHeightM}m`

      const created = await createScenario({
        caseId: selectedCaseId,
        name: displayName,
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

      {/* Wizard Mode Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-3">
        <div className="flex items-center rounded-xl bg-white/4 p-1 border border-white/8 text-xs">
          <button
            type="button"
            onClick={() => setWizardMode('presets')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer',
              wizardMode === 'presets' ? 'bg-white/12 text-white shadow-sm' : 'text-white/50 hover:text-white'
            )}
          >
            Pre-calibrated Dam Presets ({PRESETS.length})
          </button>
          <button
            type="button"
            onClick={() => setWizardMode('custom_wizard')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5',
              wizardMode === 'custom_wizard' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm' : 'text-white/50 hover:text-white'
            )}
          >
            <Sparkles className="size-3 text-purple-400" />
            <span>Custom Dam Wizard</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/30 text-purple-300 font-mono">Interactive</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <ProvenanceBadge type="numerical_swe_2d" variant="compact" />
          <ProvenanceBadge type="calibrated_adapter" variant="compact" />
        </div>
      </div>

      {/* Preset Buttons Mode */}
      {wizardMode === 'presets' ? (
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
      ) : (
        /* Custom Dam Wizard Controls */
        <div className="glass-panel rounded-xl p-4 border border-purple-500/20 bg-purple-500/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/8 pb-2">
            <div>
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sliders className="size-3.5 text-purple-400" />
                Custom Dam &amp; Hydraulic Basin Specification
              </span>
              <p className="text-[11px] text-white/50 mt-0.5">
                Define arbitrary dam geometries, material structural failure modes, and valley slopes
              </p>
            </div>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
              Dynamic Bore: c = {waveCelerityMs.toFixed(1)} m/s ({Math.round(waveCelerityMs * 3.6)} km/h)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Dam Name</label>
              <Input
                value={customDamName}
                onChange={(e) => setCustomDamName(e.target.value)}
                className="font-mono text-xs bg-black/40 border-white/10"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">River Corridor</label>
              <Input
                value={customRiver}
                onChange={(e) => setCustomRiver(e.target.value)}
                className="font-mono text-xs bg-black/40 border-white/10"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">State / Jurisdiction</label>
              <Input
                value={customState}
                onChange={(e) => setCustomState(e.target.value)}
                className="font-mono text-xs bg-black/40 border-white/10"
              />
            </div>
          </div>

          {/* Dam Structural Type Selector */}
          <div>
            <label className="text-[10px] text-white/40 uppercase font-mono block mb-1.5">
              Dam Structural Type &amp; Breach Mechanism
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCustomDamType('rockfill')}
                className={cn(
                  'p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer',
                  customDamType === 'rockfill'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-white/8 bg-white/2 text-white/50 hover:bg-white/4'
                )}
              >
                <div className="font-semibold text-white">Earth &amp; Rockfill</div>
                <div className="text-[10px] text-white/50 mt-0.5">Froehlich progressive erosion (tf ≈ 1.5–3.0h)</div>
              </button>

              <button
                type="button"
                onClick={() => setCustomDamType('concrete_gravity')}
                className={cn(
                  'p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer',
                  customDamType === 'concrete_gravity'
                    ? 'border-cyan-500 bg-cyan-500/10 text-white'
                    : 'border-white/8 bg-white/2 text-white/50 hover:bg-white/4'
                )}
              >
                <div className="font-semibold text-white">Concrete Gravity</div>
                <div className="text-[10px] text-white/50 mt-0.5">USBR / FERC Monolith collapse (tf ≈ 0.2h)</div>
              </button>

              <button
                type="button"
                onClick={() => setCustomDamType('concrete_arch')}
                className={cn(
                  'p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer',
                  customDamType === 'concrete_arch'
                    ? 'border-purple-500 bg-purple-500/10 text-white'
                    : 'border-white/8 bg-white/2 text-white/50 hover:bg-white/4'
                )}
              >
                <div className="font-semibold text-white">Concrete Arch</div>
                <div className="text-[10px] text-white/50 mt-0.5">USBR Sudden Cantilever Buckling (tf ≤ 0.1h)</div>
              </button>
            </div>
          </div>

          {/* Valley Slope & Reach Corridor Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-black/30 border border-white/6 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Valley Bed Slope (S₀):</span>
                <span className="font-mono text-purple-300 font-semibold">{customSlope.toFixed(4)} ({customSlope >= 0.01 ? 'Steep Bedrock Gorge' : customSlope >= 0.005 ? 'Foothill Valley' : 'Alluvial Plain'})</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.025"
                step="0.0005"
                value={customSlope}
                onChange={(e) => setCustomSlope(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            <div className="p-3 rounded-lg bg-black/30 border border-white/6 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Downstream Corridor Reach:</span>
                <span className="font-mono text-sky-300 font-semibold">{customReachKm} km</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="5"
                value={customReachKm}
                onChange={(e) => setCustomReachKm(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
          </div>

          {/* Real-time Dynamic Wave Arrival Timetable */}
          <div className="p-2.5 rounded-lg bg-white/2 border border-white/6 text-xs">
            <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">
              Estimated Wave Front Arrival Times (Dynamic Bore Velocity: {waveCelerityMs.toFixed(1)} m/s)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {customStations.map((st) => (
                <div key={st.name} className="p-1.5 rounded bg-black/40 border border-white/4">
                  <span className="text-[10px] text-white/50 block truncate">{st.name}</span>
                  <span className="text-xs font-mono font-bold text-white block mt-0.5">
                    {st.timeMin} min
                  </span>
                  <span className="text-[9px] font-mono text-white/40">{st.km} km</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
