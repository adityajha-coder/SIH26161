export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '')
export const WS_URL = API_BASE_URL
  ? API_BASE_URL.replace(/^http/, 'ws') + '/api/ws'
  : typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
  : ''
export const isApiConfigured = true
export const CESIUM_ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? ''
export const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_KEY ?? ''

const cartoKeyParam = CARTO_KEY ? `?key=${CARTO_KEY}` : ''

export const TILES = {
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  dark: `https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png${cartoKeyParam}`,
  labels: `https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png${cartoKeyParam}`,
  voyager: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${cartoKeyParam}`,
  terrarium: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  apiTerrainRgb: '/api/v1/tiles/terrain/{z}/{x}/{y}.png',
  apiHillshade: '/api/v1/tiles/hillshade/{z}/{x}/{y}.png',
} as const

export const ATTRIBUTION = {
  satellite: 'Imagery © Esri, Maxar, Earthstar Geographics',
  dark: '© CARTO © OpenStreetMap contributors',
  dem: 'DEM © Mapzen/AWS Terrain Tiles (SRTM, GMTED, NED)',
  osm: 'Vectors © OpenStreetMap contributors (ODbL)',
}
