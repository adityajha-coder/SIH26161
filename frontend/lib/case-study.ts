export type DatasetStatus = 'ready' | 'processing' | 'missing'

export interface CaseDataset {
  id: string
  name: string
  source: string
  resolution: string
  crs: string
  status: DatasetStatus
  manifest: string
}

export interface CaseStudy {
  id: string
  name: string
  river: string
  state: string
  role: 'primary' | 'regression'
  type: 'dam_break' | 'natural_blockage'
  bbox: [number, number, number, number]
  center: [number, number]
  zoom: number
  dam: {
    name: string
    lngLat: [number, number]
    type: string
    heightM: number
    crestLengthM: number
    crestElevationM: number
    frlM: number
    mddlM: number
    grossStorageMcm: number
    liveStorageMcm: number
    catchmentKm2: number
    commissioned: number
    source: string
  }
  reachKm: number
  downstreamTowns: { name: string; lngLat: [number, number]; chainageKm: number }[]
  datasets: CaseDataset[]
}

export const TEHRI: CaseStudy = {
  id: 'tehri-dam',
  name: 'Tehri Dam',
  river: 'Bhagirathi – Ganga',
  state: 'Uttarakhand',
  role: 'primary',
  type: 'dam_break',
  bbox: [78.1, 29.9, 78.65, 30.42],
  center: [78.38, 30.16],
  zoom: 9.6,
  dam: {
    name: 'Tehri Dam',
    lngLat: [78.4808, 30.3778],
    type: 'Earth & rockfill',
    heightM: 260.5,
    crestLengthM: 575,
    crestElevationM: 839.5,
    frlM: 830,
    mddlM: 740,
    grossStorageMcm: 3540,
    liveStorageMcm: 2615,
    catchmentKm2: 7511,
    commissioned: 2006,
    source: 'CWC National Register of Large Dams (NRLD)',
  },
  reachKm: 105,
  downstreamTowns: [
    { name: 'Koteshwar', lngLat: [78.4972, 30.2622], chainageKm: 15 },
    { name: 'Devprayag', lngLat: [78.5986, 30.1459], chainageKm: 42 },
    { name: 'Rishikesh', lngLat: [78.2932, 30.1086], chainageKm: 84 },
    { name: 'Haridwar', lngLat: [78.171, 29.9565], chainageKm: 105 },
  ],
  datasets: [
    { id: 'dem', name: 'Copernicus GLO-30 DEM', source: 'ESA / Copernicus', resolution: '30 m', crs: 'EPSG:32644', status: 'ready', manifest: 'data/manifests/dem.json' },
    { id: 'dam', name: 'Dam metadata', source: 'CWC NRLD', resolution: '—', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/dam.json' },
    { id: 'river', name: 'River network (105 km reach)', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/river.json' },
    { id: 'exposure', name: 'Settlements, roads & critical assets', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/exposure.json' },
    { id: 'population', name: 'Population grid', source: 'WorldPop 2020', resolution: '100 m', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/population.json' },
    { id: 'historical', name: 'Historical events (Chamoli 2021, Tehri 2010)', source: 'Literature / Sentinel-1', resolution: '10 m', crs: 'EPSG:32644', status: 'ready', manifest: 'data/manifests/historical_event.json' },
    { id: 'tiles', name: 'Terrain-RGB & hillshade tiles (z8–12)', source: 'Derived (Phase 2.2)', resolution: '30 m', crs: 'EPSG:3857', status: 'ready', manifest: 'data/processed/provenance.json' },
    { id: 'solver-inputs', name: 'Delft3D FM grid / DualSPHysics geometry', source: 'Derived (Phase 2.1)', resolution: '30 m', crs: 'EPSG:32644', status: 'ready', manifest: 'data/processed/provenance.json' },
  ],
}

export const CHAMOLI: CaseStudy = {
  id: 'rishiganga-blockage',
  name: 'Rishiganga Blockage',
  river: 'Rishiganga – Dhauliganga',
  state: 'Uttarakhand',
  role: 'regression',
  type: 'natural_blockage',
  bbox: [79.55, 30.4, 79.8, 30.6],
  center: [79.7, 30.5],
  zoom: 11,
  dam: {
    name: 'Rishiganga HEP (2021 event)',
    lngLat: [79.7297, 30.4958],
    type: 'Run-of-river / debris blockage',
    heightM: 0,
    crestLengthM: 0,
    crestElevationM: 0,
    frlM: 0,
    mddlM: 0,
    grossStorageMcm: 0,
    liveStorageMcm: 0,
    catchmentKm2: 0,
    commissioned: 2020,
    source: 'Shugar et al. 2021, Science',
  },
  reachKm: 25,
  downstreamTowns: [
    { name: 'Raini', lngLat: [79.7297, 30.4958], chainageKm: 0 },
    { name: 'Tapovan', lngLat: [79.6289, 30.4905], chainageKm: 8 },
    { name: 'Joshimath', lngLat: [79.5663, 30.5553], chainageKm: 20 },
  ],
  datasets: [
    { id: 'dem', name: 'Copernicus GLO-30 DEM', source: 'ESA / Copernicus', resolution: '30 m', crs: 'EPSG:32644', status: 'ready', manifest: 'data/manifests/dem.json' },
    { id: 'historical', name: 'Chamoli 2021 flood footprint', source: 'Sentinel-2 / Literature', resolution: '10 m', crs: 'EPSG:32644', status: 'processing', manifest: 'data/manifests/historical_event.json' },
  ],
}

export const CASES = [TEHRI, CHAMOLI]
