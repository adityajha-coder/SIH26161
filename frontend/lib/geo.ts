'use client'

import useSWR from 'swr'
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import type { AssetProps } from './flood-model'

const fetchJson = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${url}`)
    return r.json()
  })

const opts = { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 3600_000 }

export interface RoadProps {
  name: string
  ref: string
  highway: string
}

export function useGeoData(caseId = 'tehri-dam') {
  const isSardar = caseId === 'sardar-sarovar-dam'
  const isBhakra = caseId === 'bhakra-dam'
  const isIdukki = caseId === 'idukki-dam'

  const settlementsUrl = isSardar
    ? '/data/settlements_sardar_sarovar.geojson'
    : isBhakra
      ? '/data/settlements_bhakra.geojson'
      : isIdukki
        ? '/data/settlements_idukki.geojson'
        : '/data/settlements.geojson'

  const facilitiesUrl = isSardar
    ? '/data/facilities_sardar_sarovar.geojson'
    : isBhakra
      ? '/data/facilities_bhakra.geojson'
      : isIdukki
        ? '/data/facilities_idukki.geojson'
        : '/data/facilities.geojson'

  const roadsUrl = isSardar
    ? '/data/roads_sardar_sarovar.geojson'
    : isBhakra
      ? '/data/roads_bhakra.geojson'
      : isIdukki
        ? '/data/roads_idukki.geojson'
        : '/data/roads.geojson'

  const river = useSWR<FeatureCollection<LineString>>('/data/river.geojson', fetchJson, opts)
  const reservoir = useSWR<FeatureCollection<Polygon>>('/data/reservoir.geojson', fetchJson, opts)
  const settlements = useSWR<FeatureCollection<Point, AssetProps>>(settlementsUrl, fetchJson, opts)
  const facilities = useSWR<FeatureCollection<Point, AssetProps>>(facilitiesUrl, fetchJson, opts)
  const roads = useSWR<FeatureCollection<LineString, RoadProps>>(roadsUrl, fetchJson, opts)
  const bridges = useSWR<FeatureCollection<Point, RoadProps>>('/data/bridges.geojson', fetchJson, opts)

  const reach = river.data?.features.find((f) => f.properties?.role === 'reach') as Feature<LineString> | undefined

  return {
    river: river.data,
    reach,
    reservoir: reservoir.data,
    settlements: settlements.data,
    facilities: facilities.data,
    roads: roads.data,
    bridges: bridges.data,
    isLoading:
      river.isLoading || reservoir.isLoading || settlements.isLoading || facilities.isLoading || roads.isLoading,
    error: river.error || reservoir.error || settlements.error || facilities.error || roads.error,
  }
}
