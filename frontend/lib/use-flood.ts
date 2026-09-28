'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { lineSliceAlong } from '@turf/turf'
import type { Feature, LineString } from 'geojson'
import { api } from './api'
import { getCaseById, TEHRI } from './case-study'
import {
  affectedRoadKm,
  chainageOf,
  computePreviewFlood,
  DEPTH_BANDS,
  depthBand,
  intersectAssets,
  type ExposedAsset,
  type FloodResult,
} from './flood-model'
import { useGeoData } from './geo'
import { usePlatform } from './platform-store'
import type { Scenario, SimulationRun, SolverId } from './types'

export const SPH_DOMAIN_KM = 45

export function usePlainsStartKm(reach: Feature<LineString> | undefined) {
  return useMemo(() => {
    if (!reach) return 100
    const rishikesh = TEHRI.downstreamTowns.find((t) => t.name === 'Rishikesh')!
    return chainageOf(reach, rishikesh.lngLat).chainageKm
  }, [reach])
}

export function useFloodResult(scenario: Scenario | undefined, solver: SolverId = 'delft3d', run?: SimulationRun) {
  const { mode, activeCase } = usePlatform()
  const { reach: tehriReach } = useGeoData()

  const currentCase = scenario ? getCaseById(scenario.caseId) : activeCase

  const reach = useMemo<Feature<LineString> | undefined>(() => {
    if (currentCase.id === 'tehri-dam' && tehriReach) return tehriReach
    if (currentCase.riverReachCoordinates && currentCase.riverReachCoordinates.length >= 2) {
      return {
        type: 'Feature',
        properties: { role: 'reach', name: `${currentCase.name} River Reach` },
        geometry: {
          type: 'LineString',
          coordinates: currentCase.riverReachCoordinates,
        },
      }
    }
    return tehriReach
  }, [currentCase, tehriReach])

  const plainsStartKm = useMemo(() => {
    if (!reach) return 50
    return Math.max(10, currentCase.reachKm * 0.7)
  }, [reach, currentCase])

  const useRemote = mode === 'api' && run?.status === 'done' && !run.preview
  const remote = useSWR(useRemote ? ['results', run!.id] : null, () => api.getResults(run!.id))

  const preview = useMemo<FloodResult | null>(() => {
    if (!reach || !scenario) return null
    const peakQ = Number(scenario.peakDischargeM3s) || 250000
    const manning = Number(scenario.manningN) || 0.045
    if (solver === 'sph') {
      const bounded = lineSliceAlong(reach, 0, SPH_DOMAIN_KM, { units: 'kilometers' }) as Feature<LineString>
      return computePreviewFlood(bounded, peakQ, manning * 1.1, plainsStartKm)
    }
    return computePreviewFlood(reach, peakQ, manning, plainsStartKm)
  }, [reach, scenario, solver, plainsStartKm])

  if (useRemote && remote.data) {
    const d = remote.data
    const hasValidRemoteBands =
      d?.floodBands &&
      Array.isArray(d.floodBands.features) &&
      d.floodBands.features.length > 0 &&
      Number.isFinite(d.maxArrivalS) &&
      d.maxArrivalS > 0

    if (hasValidRemoteBands) {
      return {
        result: {
          bands: d.floodBands,
          stations: d.stations ?? [],
          reachKm: d.stations?.at(-1)?.chainageKm ?? 0,
          floodedAreaKm2: d.floodedAreaKm2 ?? 0,
          maxArrivalS: d.maxArrivalS ?? 0,
          method: d.solverVersion ?? 'Remote solver output',
        } as FloodResult,
        isPreview: false,
        isLoading: false,
        error: undefined,
      }
    }
  }

  return {
    result: preview,
    isPreview: true,
    isLoading: useRemote ? remote.isLoading : !preview,
    error: useRemote ? (remote.error as Error | undefined) : undefined,
  }
}

export interface ImpactComputation {
  villages: ExposedAsset[]
  hospitals: ExposedAsset[]
  schools: ExposedAsset[]
  roadKm: number
  populationKnown: number
  depthBands: { band: string; count: number }[]
}

export function useImpact(result: FloodResult | null, atTimeS = Infinity): ImpactComputation | null {
  const { settlements, facilities, roads } = useGeoData()
  const bucket = Number.isFinite(atTimeS) ? Math.round(atTimeS / 300) * 300 : Infinity

  return useMemo(() => {
    if (!result || !settlements || !facilities || !roads) return null
    const exposedSettlements = intersectAssets(result.bands, settlements, bucket)
    const exposedFacilities = intersectAssets(result.bands, facilities, bucket)
    const villages = exposedSettlements
    const hospitals = exposedFacilities.filter((f) => f.kind === 'hospital' || f.kind === 'clinic')
    const schools = exposedFacilities.filter((f) => f.kind === 'school' || f.kind === 'college')
    const roadKm = affectedRoadKm(result.bands, roads, bucket)
    const populationKnown = villages.reduce((s, v) => s + (v.population ?? 0), 0)
    const counts = new Map(DEPTH_BANDS.map((b) => [b, 0]))
    for (const v of villages) counts.set(depthBand(v.depthM), (counts.get(depthBand(v.depthM)) ?? 0) + 1)
    return {
      villages,
      hospitals,
      schools,
      roadKm,
      populationKnown,
      depthBands: DEPTH_BANDS.map((band) => ({ band, count: counts.get(band) ?? 0 })),
    }
  }, [result, settlements, facilities, roads, bucket])
}
