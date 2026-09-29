import { API_BASE_URL, isApiConfigured } from './config'
import type { FloodBands, FloodStation } from './flood-model'
import type { ImpactSummary, ObservationProduct, Scenario, SimulationRun, SolverId } from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isApiConfigured) throw new ApiError('API base URL not configured', 0)
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(body || res.statusText, res.status)
  }
  return res.json() as Promise<T>
}

export interface RunResults {
  floodBands: FloodBands
  stations: FloodStation[]
  floodedAreaKm2: number
  maxArrivalS: number
  solverVersion: string
  crs: string
  resolutionM: number
}

export const api = {
  health: () => apiFetch<{ status: string }>('/api/health'),
  listScenarios: () => apiFetch<Scenario[]>('/api/v1/scenarios'),
  getScenario: (id: string) => apiFetch<Scenario>(`/api/v1/scenarios/${id}`),
  createScenario: (s: Omit<Scenario, 'id' | 'createdAt'>) =>
    apiFetch<Scenario>('/api/v1/scenarios', { method: 'POST', body: JSON.stringify(s) }),
  listRuns: () => apiFetch<SimulationRun[]>('/api/v1/simulations'),
  getRun: (id: string) => apiFetch<SimulationRun>(`/api/v1/simulations/${id}`),
  createRuns: async (scenarioId: string, solvers: SolverId[]) => {
    const targetSolvers = solvers && solvers.length > 0 ? solvers : (['delft3d'] as SolverId[])
    const results: SimulationRun[] = []
    for (const solver of targetSolvers) {
      try {
        const res = await apiFetch<any>('/api/v1/simulations', {
          method: 'POST',
          body: JSON.stringify({
            scenario_id: scenarioId,
            scenarioId: scenarioId,
            solver: solver,
            solvers: [solver],
          }),
        })
        if (res) {
          if (Array.isArray(res)) results.push(...res)
          else results.push(res)
        }
      } catch (err) {
        console.warn(`Failed to dispatch run for solver ${solver}:`, err)
      }
    }
    return results
  },
  cancelRun: (id: string) => apiFetch<SimulationRun>(`/api/v1/simulations/${id}/cancel`, { method: 'POST' }),
  getResults: (id: string) => apiFetch<RunResults>(`/api/v1/simulations/${id}/results`),
  getImpact: (id: string) => apiFetch<ImpactSummary>(`/api/v1/simulations/${id}/impact`),
  latestObservations: (caseId: string) =>
    apiFetch<ObservationProduct[]>(`/api/v1/observations/latest?caseId=${encodeURIComponent(caseId)}`),
  refreshObservations: () => apiFetch<{ queued: boolean }>('/api/v1/observations/refresh', { method: 'POST' }),
  exportUrl: (runId: string, format: 'kml' | 'shp' | 'geojson' | 'report', caseId?: string) =>
    `${API_BASE_URL}/api/v1/exports/${runId}/${format}${caseId ? `?case_id=${encodeURIComponent(caseId)}` : ''}`,
  getEAPReportJson: (runId: string, caseId?: string) =>
    apiFetch<any>(`/api/v1/exports/${runId}/report?format=json${caseId ? `&case_id=${encodeURIComponent(caseId)}` : ''}`),
}

