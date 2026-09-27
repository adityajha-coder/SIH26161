'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { lineSliceAlong } from '@turf/turf'
import type { Feature, LineString } from 'geojson'
import { api } from './api'
import { TEHRI } from './case-study'
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
  const { mode } = usePlatform()
  const { reach } = useGeoData()
  const plainsStartKm = usePlainsStartKm(reach)

  const useRemote = mode === 'api' && run?.status === 'done' && !run.preview
  const remote = useSWR(useRemote ? ['results', run!.id] : null, () => api.getResults(run!.id))

  const preview = useMemo<FloodResult | null>(() => {
    if (useRemote || !reach || !scenario) return null
    if (solver === 'sph') {
      const bounded = lineSliceAlong(reach, 0, SPH_DOMAIN_KM, { units: 'kilometers' }) as Feature<LineString>
      return computePreviewFlood(bounded, scenario.peakDischargeM3s, scenario.manningN * 1.1, plainsStartKm)
    }
    return computePreviewFlood(reach, scenario.peakDischargeM3s, scenario.manningN, plainsStartKm)
  }, [useRemote, reach, scenario, solver, plainsStartKm])

  if (useRemote) {
    const d = remote.data
    return {
      result: d
        ? ({
            bands: d.floodBands,
            stations: d.stations,
            reachKm: d.stations.at(-1)?.chainageKm ?? 0,
            floodedAreaKm2: d.floodedAreaKm2,
            maxArrivalS: d.maxArrivalS,
            method: d.solverVersion,
          } as FloodResult)
        : null,
      isPreview: false,
      isLoading: remote.isLoading,
      error: remote.error as Error | undefined,
    }
  }
  return { result: preview, isPreview: true, isLoading: !preview, error: undefined }
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
