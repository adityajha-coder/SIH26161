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

export function useGeoData() {
  const river = useSWR<FeatureCollection<LineString>>('/data/river.geojson', fetchJson, opts)
  const reservoir = useSWR<FeatureCollection<Polygon>>('/data/reservoir.geojson', fetchJson, opts)
  const settlements = useSWR<FeatureCollection<Point, AssetProps>>('/data/settlements.geojson', fetchJson, opts)
  const facilities = useSWR<FeatureCollection<Point, AssetProps>>('/data/facilities.geojson', fetchJson, opts)
  const roads = useSWR<FeatureCollection<LineString, RoadProps>>('/data/roads.geojson', fetchJson, opts)
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
