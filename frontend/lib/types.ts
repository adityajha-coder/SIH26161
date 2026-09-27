import type { FailureMode, SensitivityCase } from './breach'

export type ScenarioType = 'dam_break' | 'natural_blockage' | 'release'
export type SolverId = 'delft3d' | 'sph' | 'lisflood'

export const SOLVERS: Record<SolverId, { name: string; version: string; kind: string }> = {
  delft3d: { name: 'Delft3D FM', version: 'D-Flow FM 2024.03', kind: 'Eulerian' },
  sph: { name: 'DualSPHysics', version: 'v5.2', kind: 'SPH' },
  lisflood: { name: 'LISFLOOD-FP', version: 'v8.1', kind: 'Eulerian (fallback)' },
}

export interface Scenario {
  id: string
  caseId: string
  name: string
  type: ScenarioType
  demVersion: string
  initialWaterLevelM: number
  reservoirVolumeM3: number
  breachHeightM: number
  failureMode: FailureMode
  breachWidthM: number
  formationTimeS: number
  peakDischargeM3s: number
  manningN: number
  downstreamBoundary: 'normal_depth' | 'free_outflow'
  simulationHorizonS: number
  solvers: SolverId[]
  sensitivity: SensitivityCase
  breachEquation: string
  massBalanceErrorPct: number
  createdAt: string
}

export type RunStatus =
  | 'queued'
  | 'validating'
  | 'preparing'
  | 'running'
  | 'postprocessing'
  | 'validating_output'
  | 'done'
  | 'failed'
  | 'cancelled'

export const RUN_PIPELINE: RunStatus[] = [
  'queued',
  'validating',
  'preparing',
  'running',
  'postprocessing',
  'validating_output',
  'done',
]

export interface RunLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface SimulationRun {
  id: string
  scenarioId: string
  solver: SolverId
  status: RunStatus
  progress: number
  createdAt: string
  startedAt?: string
  finishedAt?: string
  runtimeS?: number
  logs: RunLogEntry[]
  error?: string
  preview: boolean
}

export interface ImpactSummary {
  villagesAffected: number
  hospitalsAtRisk: number
  schoolsAtRisk: number
  roadLengthKm: number
  populationExposed: number | null
  floodedAreaKm2: number
  depthBands: { band: string; count: number }[]
}

export interface ObservationProduct {
  id: string
  source: 'sentinel1' | 'imerg' | 'dswx' | 'gsmap'
  sourceName: string
  collection: string
  acquiredAt: string | null
  ingestedAt: string | null
  status: 'ok' | 'stale' | 'no_acquisition' | 'unavailable' | 'not_configured'
  revisit: string
  resolution: string
}
