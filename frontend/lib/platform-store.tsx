'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { api } from './api'
import { isApiConfigured, WS_URL } from './config'
import { buildHydrograph, froehlichParameters } from './breach'
import { TEHRI } from './case-study'
import { RUN_PIPELINE, SOLVERS, type RunLogEntry, type RunStatus, type Scenario, type SimulationRun, type SolverId } from './types'

export type ApiStatus = 'checking' | 'connected' | 'unreachable' | 'not_configured'
export type ScenarioInput = Omit<Scenario, 'id' | 'createdAt'>

interface PlatformState {
  mode: 'api' | 'preview'
  apiStatus: ApiStatus
  scenarios: Scenario[]
  runs: SimulationRun[]
  activeScenario: Scenario | undefined
  activeRun: SimulationRun | undefined
  setActiveScenarioId: (id: string) => void
  setActiveRunId: (id: string) => void
  createScenario: (input: ScenarioInput) => Promise<Scenario>
  submitRuns: (scenarioId: string, solvers: SolverId[]) => Promise<SimulationRun[]>
  cancelRun: (id: string) => Promise<void>
}

const PlatformContext = createContext<PlatformState | null>(null)

export function buildBaselineScenario(): Scenario {
  const V = TEHRI.dam.grossStorageMcm * 1e6
  const hb = 240
  const hw = 240
  const params = froehlichParameters({ reservoirVolumeM3: V, breachHeightM: hb, waterDepthM: hw, failureMode: 'overtopping' })
  const hydro = buildHydrograph(params, V, 6 * 3600)
  return {
    id: 'scn-tehri-baseline',
    caseId: TEHRI.id,
    name: 'Baseline · FRL overtopping failure',
    type: 'dam_break',
    demVersion: 'GLO-30 · UTM44N · v1',
    initialWaterLevelM: TEHRI.dam.frlM,
    reservoirVolumeM3: V,
    breachHeightM: hb,
    failureMode: 'overtopping',
    breachWidthM: params.avgWidthM,
    formationTimeS: params.formationTimeS,
    peakDischargeM3s: hydro.peakDischargeM3s,
    manningN: 0.045,
    downstreamBoundary: 'normal_depth',
    simulationHorizonS: 6 * 3600,
    solvers: ['delft3d', 'sph'],
    sensitivity: 'base',
    breachEquation: params.equation,
    massBalanceErrorPct: hydro.massBalanceErrorPct,
    createdAt: '2026-09-20T09:30:00.000Z',
  }
}

const now = () => new Date().toISOString()
const log = (message: string, level: RunLogEntry['level'] = 'info'): RunLogEntry => ({ at: now(), level, message })

function seededRuns(scenarioId: string): SimulationRun[] {
  return (['delft3d', 'sph'] as SolverId[]).map((solver) => ({
    id: `run-${solver}-baseline`,
    scenarioId,
    solver,
    status: 'done' as RunStatus,
    progress: 100,
    createdAt: '2026-09-20T09:31:00.000Z',
    startedAt: '2026-09-20T09:31:02.000Z',
    finishedAt: '2026-09-20T09:31:04.000Z',
    preview: true,
    logs: [
      { at: '2026-09-20T09:31:00.000Z', level: 'info', message: 'Job accepted (preview mode — Go API not connected)' },
      { at: '2026-09-20T09:31:04.000Z', level: 'warn', message: `${SOLVERS[solver].name} not executed; analytical preview generated in browser` },
    ],
  }))
}

const STAGE_MESSAGES: Record<RunStatus, string> = {
  queued: 'Job queued',
  validating: 'Validating scenario geometry, units and breach bounds',
  preparing: 'Preparing solver inputs from DEM and hydrograph',
  running: 'Solver running',
  postprocessing: 'Extracting depth, velocity and arrival-time products',
  validating_output: 'Validating output mass balance',
  done: 'Run complete',
  failed: 'Run failed',
  cancelled: 'Run cancelled',
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const baseline = useMemo(buildBaselineScenario, [])
  const [localScenarios, setLocalScenarios] = useState<Scenario[]>(() => [baseline])
  const [localRuns, setLocalRuns] = useState<SimulationRun[]>(() => seededRuns(baseline.id))
  const [activeScenarioId, setActiveScenarioId] = useState(baseline.id)
  const [activeRunId, setActiveRunId] = useState('run-delft3d-baseline')
  const timers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  const health = useSWR(isApiConfigured ? 'api-health' : null, api.health, {
    refreshInterval: 30_000,
    shouldRetryOnError: false,
  })
  const apiStatus: ApiStatus = !isApiConfigured
    ? 'not_configured'
    : health.error
      ? 'unreachable'
      : health.data
        ? 'connected'
        : 'checking'
  const mode = apiStatus === 'connected' ? 'api' : 'preview'

  const remoteScenarios = useSWR(mode === 'api' ? 'scenarios' : null, api.listScenarios)
  const remoteRuns = useSWR(mode === 'api' ? 'runs' : null, api.listRuns, { refreshInterval: 5000 })

  useEffect(() => {
    if (mode !== 'api' || !WS_URL) return
    const ws = new WebSocket(WS_URL)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type?.startsWith('simulation.')) remoteRuns.mutate()
        if (msg.type === 'simulation.done') toast.success(`Run ${msg.runId} completed`)
        if (msg.type === 'simulation.failed') toast.error(`Run ${msg.runId} failed`)
      } catch {}
    }
    return () => ws.close()
  }, [mode, remoteRuns])

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearInterval(t))
  }, [])

  const scenarios = mode === 'api' ? (remoteScenarios.data ?? []) : localScenarios
  const runs = mode === 'api' ? (remoteRuns.data ?? []) : localRuns

  const advancePreviewRun = useCallback((id: string) => {
    let stageTicks = 0
    const timer = setInterval(() => {
      setLocalRuns((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          if (r.status === 'done' || r.status === 'failed' || r.status === 'cancelled') {
            clearInterval(timer)
            timers.current.delete(id)
            return r
          }
          if (r.status === 'running' && r.progress < 100) {
            const progress = Math.min(100, r.progress + 6 + Math.round(Math.random() * 6))
            const logs = progress % 24 < 12 ? [...r.logs, log(`Solver progress ${progress}%`)] : r.logs
            return { ...r, progress, logs }
          }
          stageTicks++
          if (stageTicks < 2) return r
          stageTicks = 0
          const idx = RUN_PIPELINE.indexOf(r.status)
          const next = RUN_PIPELINE[idx + 1]
          const finished = next === 'done'
          if (finished) toast.success(`${SOLVERS[r.solver].name} preview run complete`)
          return {
            ...r,
            status: next,
            progress: next === 'running' ? 0 : r.progress,
            startedAt: next === 'validating' ? now() : r.startedAt,
            finishedAt: finished ? now() : r.finishedAt,
            runtimeS: finished && r.startedAt ? (Date.now() - new Date(r.startedAt).getTime()) / 1000 : r.runtimeS,
            logs: [...r.logs, log(STAGE_MESSAGES[next] + (finished ? ' (analytical preview)' : ''))],
          }
        }),
      )
    }, 450)
    timers.current.set(id, timer)
  }, [])

  const createScenario = useCallback(
    async (input: ScenarioInput) => {
      if (mode === 'api') {
        const s = await api.createScenario(input)
        await remoteScenarios.mutate()
        setActiveScenarioId(s.id)
        return s
      }
      const s: Scenario = { ...input, id: `scn-${Date.now().toString(36)}`, createdAt: now() }
      setLocalScenarios((prev) => [s, ...prev])
      setActiveScenarioId(s.id)
      return s
    },
    [mode, remoteScenarios],
  )

  const submitRuns = useCallback(
    async (scenarioId: string, solvers: SolverId[]) => {
      if (mode === 'api') {
        const created = await api.createRuns(scenarioId, solvers)
        await remoteRuns.mutate()
        if (created[0]) setActiveRunId(created[0].id)
        return created
      }
      const created: SimulationRun[] = solvers.map((solver) => ({
        id: `run-${solver}-${Date.now().toString(36)}`,
        scenarioId,
        solver,
        status: 'queued',
        progress: 0,
        createdAt: now(),
        preview: true,
        logs: [log(`Job accepted for ${SOLVERS[solver].name} ${SOLVERS[solver].version} (preview mode)`)],
      }))
      setLocalRuns((prev) => [...created, ...prev])
      created.forEach((r) => advancePreviewRun(r.id))
      if (created[0]) setActiveRunId(created[0].id)
      return created
    },
    [mode, remoteRuns, advancePreviewRun],
  )

  const cancelRun = useCallback(
    async (id: string) => {
      if (mode === 'api') {
        await api.cancelRun(id)
        await remoteRuns.mutate()
        return
      }
      setLocalRuns((prev) =>
        prev.map((r) =>
          r.id === id && !['done', 'failed', 'cancelled'].includes(r.status)
            ? { ...r, status: 'cancelled', logs: [...r.logs, log('Cancelled by user', 'warn')] }
            : r,
        ),
      )
    },
    [mode, remoteRuns],
  )

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0]
  const activeRun = runs.find((r) => r.id === activeRunId) ?? runs.find((r) => r.scenarioId === activeScenario?.id)

  const value: PlatformState = {
    mode,
    apiStatus,
    scenarios,
    runs,
    activeScenario,
    activeRun,
    setActiveScenarioId,
    setActiveRunId,
    createScenario,
    submitRuns,
    cancelRun,
  }

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  const ctx = useContext(PlatformContext)
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider')
  return ctx
}
