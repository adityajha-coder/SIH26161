export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '')
export const WS_URL = API_BASE_URL
  ? API_BASE_URL.replace(/^http/, 'ws') + '/ws'
  : typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
  : ''
export const isApiConfigured = true

export const TILES = {
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
  labels: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
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
