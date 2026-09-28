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
  type: 'dam_break' | 'natural_blockage' | 'release'
  bbox: [number, number, number, number]
  center: [number, number]
  zoom: number
  pitch?: number
  bearing?: number
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
  riverReachCoordinates: [number, number][]
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
  zoom: 10.2,
  pitch: 58,
  bearing: 195,
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
  riverReachCoordinates: [
    [78.4808, 30.3778],
    [78.4972, 30.2622],
    [78.5986, 30.1459],
    [78.4500, 30.1100],
    [78.2932, 30.1086],
    [78.1710, 29.9565],
  ],
  datasets: [
    { id: 'dem', name: 'Copernicus GLO-30 DEM', source: 'ESA / Copernicus', resolution: '30 m', crs: 'EPSG:32644', status: 'ready', manifest: 'data/manifests/dem.json' },
    { id: 'dam', name: 'Dam metadata', source: 'CWC NRLD', resolution: '—', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/dam.json' },
    { id: 'river', name: 'River network (105 km reach)', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/river.json' },
    { id: 'exposure', name: 'Settlements, roads & critical assets', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/exposure.json' },
    { id: 'population', name: 'Population grid', source: 'WorldPop 2020', resolution: '100 m', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/population.json' },
  ],
}

export const SARDAR_SAROVAR: CaseStudy = {
  id: 'sardar-sarovar-dam',
  name: 'Sardar Sarovar Dam',
  river: 'Narmada',
  state: 'Gujarat',
  role: 'primary',
  type: 'dam_break',
  bbox: [72.8, 21.6, 73.85, 22.05],
  center: [73.55, 21.81],
  zoom: 10.4,
  pitch: 52,
  bearing: 255,
  dam: {
    name: 'Sardar Sarovar Dam',
    lngLat: [73.7481, 21.8319],
    type: 'Concrete Gravity',
    heightM: 163.0,
    crestLengthM: 1210,
    crestElevationM: 146.5,
    frlM: 138.68,
    mddlM: 110.64,
    grossStorageMcm: 9500,
    liveStorageMcm: 5800,
    catchmentKm2: 88000,
    commissioned: 2017,
    source: 'CWC National Register of Large Dams (NRLD)',
  },
  reachKm: 115,
  downstreamTowns: [
    { name: 'Kevadiya / Ekta Nagar', lngLat: [73.7150, 21.8380], chainageKm: 5 },
    { name: 'Garudeshwar', lngLat: [73.6620, 21.8210], chainageKm: 12 },
    { name: 'Rajpipla', lngLat: [73.5650, 21.7890], chainageKm: 26 },
    { name: 'Sinor', lngLat: [73.3420, 21.9120], chainageKm: 58 },
    { name: 'Bharuch', lngLat: [72.9980, 21.7050], chainageKm: 95 },
    { name: 'Ankleshwar', lngLat: [73.0020, 21.6260], chainageKm: 104 },
  ],
  riverReachCoordinates: [
    [73.7481, 21.8319],
    [73.7150, 21.8380],
    [73.6620, 21.8210],
    [73.5650, 21.7890],
    [73.4800, 21.8300],
    [73.3420, 21.9120],
    [73.1800, 21.7600],
    [72.9980, 21.7050],
    [72.8500, 21.6500],
  ],
  datasets: [
    { id: 'dem', name: 'Copernicus GLO-30 DEM', source: 'ESA / Copernicus', resolution: '30 m', crs: 'EPSG:32643', status: 'ready', manifest: 'data/manifests/dem_sardar_sarovar.json' },
    { id: 'dam', name: 'Dam structural specifications', source: 'CWC NRLD / SSNNL', resolution: '—', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/dam_sardar_sarovar.json' },
    { id: 'river', name: 'Narmada river network (115 km reach)', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/river_sardar_sarovar.json' },
    { id: 'exposure', name: 'Settlements & industrial assets (Bharuch reach)', source: 'OpenStreetMap / Census', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/exposure.json' },
  ],
}

export const BHAKRA: CaseStudy = {
  id: 'bhakra-dam',
  name: 'Bhakra Dam',
  river: 'Satluj',
  state: 'Himachal Pradesh',
  role: 'primary',
  type: 'dam_break',
  bbox: [76.25, 30.95, 76.65, 31.55],
  center: [76.45, 31.32],
  zoom: 10.6,
  pitch: 56,
  bearing: 190,
  dam: {
    name: 'Bhakra Dam',
    lngLat: [76.4358, 31.4103],
    type: 'Concrete Gravity',
    heightM: 226.0,
    crestLengthM: 518.16,
    crestElevationM: 518.2,
    frlM: 513.59,
    mddlM: 445.62,
    grossStorageMcm: 9621,
    liveStorageMcm: 7192,
    catchmentKm2: 56874,
    commissioned: 1963,
    source: 'CWC National Register of Large Dams (NRLD) / BBMB',
  },
  reachKm: 90,
  downstreamTowns: [
    { name: 'Nangal Barrage', lngLat: [76.3810, 31.3700], chainageKm: 12 },
    { name: 'Anandpur Sahib', lngLat: [76.5020, 31.2350], chainageKm: 34 },
    { name: 'Kiratpur Sahib', lngLat: [76.5680, 31.1810], chainageKm: 44 },
    { name: 'Rupnagar (Ropar)', lngLat: [76.5270, 30.9660], chainageKm: 78 },
  ],
  riverReachCoordinates: [
    [76.4358, 31.4103],
    [76.3810, 31.3700],
    [76.4200, 31.3000],
    [76.5020, 31.2350],
    [76.5680, 31.1810],
    [76.5500, 31.0500],
    [76.5270, 30.9660],
  ],
  datasets: [
    { id: 'dem', name: 'Copernicus GLO-30 DEM', source: 'ESA / Copernicus', resolution: '30 m', crs: 'EPSG:32643', status: 'ready', manifest: 'data/manifests/dem_bhakra.json' },
    { id: 'dam', name: 'Dam structural specifications', source: 'CWC NRLD / BBMB', resolution: '—', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/dam_bhakra.json' },
    { id: 'river', name: 'Satluj river corridor (90 km reach)', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/river_bhakra.json' },
    { id: 'exposure', name: 'Nangal-Ropar critical asset inventory', source: 'OpenStreetMap / Census', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/exposure.json' },
  ],
}

export const IDUKKI: CaseStudy = {
  id: 'idukki-dam',
  name: 'Idukki Dam',
  river: 'Periyar',
  state: 'Kerala',
  role: 'primary',
  type: 'dam_break',
  bbox: [76.35, 9.75, 77.10, 10.20],
  center: [76.78, 9.98],
  zoom: 10.5,
  pitch: 58,
  bearing: 300,
  dam: {
    name: 'Idukki Arch Dam',
    lngLat: [76.9744, 9.8517],
    type: 'Double Curvature Concrete Arch',
    heightM: 168.9,
    crestLengthM: 365.85,
    crestElevationM: 736.09,
    frlM: 732.43,
    mddlM: 695.0,
    grossStorageMcm: 1996,
    liveStorageMcm: 1460,
    catchmentKm2: 649.3,
    commissioned: 1976,
    source: 'CWC National Register of Large Dams (NRLD) / KSEB',
  },
  reachKm: 85,
  downstreamTowns: [
    { name: 'Cheruthoni', lngLat: [76.9620, 9.8700], chainageKm: 3 },
    { name: 'Chelachuvadu', lngLat: [76.9050, 9.9120], chainageKm: 14 },
    { name: 'Karimban', lngLat: [76.8830, 9.9250], chainageKm: 18 },
    { name: 'Neriamangalam', lngLat: [76.7820, 10.0540], chainageKm: 42 },
    { name: 'Kothamangalam', lngLat: [76.6210, 10.0630], chainageKm: 60 },
    { name: 'Aluva', lngLat: [76.3540, 10.1080], chainageKm: 85 },
  ],
  riverReachCoordinates: [
    [76.9744, 9.8517],
    [76.9620, 9.8700],
    [76.9050, 9.9120],
    [76.8830, 9.9250],
    [76.8400, 9.9800],
    [76.7820, 10.0540],
    [76.6210, 10.0630],
    [76.3540, 10.1080],
  ],
  datasets: [
    { id: 'dem', name: 'Copernicus GLO-30 DEM', source: 'ESA / Copernicus', resolution: '30 m', crs: 'EPSG:32643', status: 'ready', manifest: 'data/manifests/dem_idukki.json' },
    { id: 'dam', name: 'Dam structural specifications', source: 'CWC NRLD / KSEB', resolution: '—', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/dam_idukki.json' },
    { id: 'river', name: 'Periyar river corridor (85 km reach)', source: 'OpenStreetMap', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/river_idukki.json' },
    { id: 'exposure', name: 'Periyar basin vulnerability inventory', source: 'OpenStreetMap / KSDMA', resolution: 'Vector', crs: 'EPSG:4326', status: 'ready', manifest: 'data/manifests/exposure.json' },
  ],
}

export const CASES: CaseStudy[] = [TEHRI, SARDAR_SAROVAR, BHAKRA, IDUKKI]

export function getCaseById(id: string): CaseStudy {
  return CASES.find((c) => c.id === id) ?? TEHRI
}

