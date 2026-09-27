import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import { ATTRIBUTION, TILES } from '@/lib/config'

export type BaseMode = 'satellite' | 'terrain' | 'hillshade' | 'contour'

export interface LayerVisibility {
  terrain3d: boolean
  hillshade: boolean
  contours: boolean
  river: boolean
  dam: boolean
  floodDepth: boolean
  floodVelocity: boolean
  arrivalTime: boolean
  observedFlood: boolean
  settlements: boolean
  roads: boolean
  exposure: boolean
}

export const DEFAULT_LAYERS: LayerVisibility = {
  terrain3d: false,
  hillshade: false,
  contours: false,
  river: true,
  dam: true,
  floodDepth: true,
  floodVelocity: false,
  arrivalTime: false,
  observedFlood: false,
  settlements: true,
  roads: false,
  exposure: false,
}

export const DEPTH_STOPS: [number, string][] = [
  [0, '#2563eb'],
  [3, '#06b6d4'],
  [8, '#22c55e'],
  [16, '#eab308'],
  [30, '#f97316'],
  [55, '#dc2626'],
]

export const VELOCITY_STOPS: [number, string][] = [
  [0, '#1e3a8a'],
  [4, '#6d28d9'],
  [8, '#c026d3'],
  [12, '#f43f5e'],
  [18, '#fde047'],
]

export const ARRIVAL_STOPS: [number, string][] = [
  [0, '#dc2626'],
  [1800, '#f97316'],
  [3600, '#eab308'],
  [5400, '#22c55e'],
  [7200, '#3b82f6'],
]

function ramp(prop: string, stops: [number, string][]): ExpressionSpecification {
  return ['interpolate', ['linear'], ['get', prop], ...stops.flat()] as unknown as ExpressionSpecification
}

const EMPTY = { type: 'FeatureCollection', features: [] } as const

export function buildStyle(contourTilesUrl: string, demTilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      satellite: {
        type: 'raster',
        tiles: [TILES.satellite],
        tileSize: 256,
        maxzoom: 18,
        attribution: ATTRIBUTION.satellite,
      },
      dem: { type: 'raster-dem', tiles: [demTilesUrl], tileSize: 256, maxzoom: 13, encoding: 'terrarium', attribution: ATTRIBUTION.dem },
      hillshadeDem: { type: 'raster-dem', tiles: [demTilesUrl], tileSize: 256, maxzoom: 13, encoding: 'terrarium' },
      contours: { type: 'vector', tiles: [contourTilesUrl], maxzoom: 15 },
      reservoir: { type: 'geojson', data: EMPTY as never, attribution: ATTRIBUTION.osm },
      river: { type: 'geojson', data: EMPTY as never },
      roads: { type: 'geojson', data: EMPTY as never },
      flood: { type: 'geojson', data: EMPTY as never },
      observed: { type: 'geojson', data: EMPTY as never },
      settlements: { type: 'geojson', data: EMPTY as never },
      facilities: { type: 'geojson', data: EMPTY as never },
      exposure: { type: 'geojson', data: EMPTY as never },
      dam: { type: 'geojson', data: EMPTY as never },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0c1322' } },
      { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.15, 'raster-contrast': 0.05 } },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshadeDem',
        layout: { visibility: 'none' },
        paint: {
          'hillshade-exaggeration': 0.7,
          'hillshade-shadow-color': '#1f2430',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#5a6272',
        },
      },
      {
        id: 'contour-lines',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#e3a857',
          'line-opacity': ['match', ['get', 'level'], 1, 0.95, 0.55],
          'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5],
        },
      },
      {
        id: 'contour-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['>', ['get', 'level'], 0],
        minzoom: 11,
        layout: {
          visibility: 'none',
          'symbol-placement': 'line',
          'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
        },
        paint: { 'text-color': '#f3c98b', 'text-halo-color': '#1c160e', 'text-halo-width': 1 },
      },
      {
        id: 'reservoir-fill',
        type: 'fill',
        source: 'reservoir',
        paint: { 'fill-color': '#1d4ed8', 'fill-opacity': 0.55 },
      },
      {
        id: 'reservoir-line',
        type: 'line',
        source: 'reservoir',
        paint: { 'line-color': '#60a5fa', 'line-width': 1 },
      },
      {
        id: 'roads-line',
        type: 'line',
        source: 'roads',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'highway'], 'trunk', '#f8fafc', 'primary', '#e2e8f0', '#cbd5e1'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 2.2],
          'line-opacity': 0.8,
        },
      },
      {
        id: 'river-line',
        type: 'line',
        source: 'river',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#7dd3fc',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, 3.5],
          'line-opacity': 0.9,
        },
      },
      {
        id: 'flood-depth',
        type: 'fill',
        source: 'flood',
        paint: { 'fill-color': ramp('depthM', DEPTH_STOPS), 'fill-opacity': 0.72, 'fill-antialias': false },
      },
      {
        id: 'flood-velocity',
        type: 'fill',
        source: 'flood',
        layout: { visibility: 'none' },
        paint: { 'fill-color': ramp('velocityMs', VELOCITY_STOPS), 'fill-opacity': 0.72, 'fill-antialias': false },
      },
      {
        id: 'flood-arrival',
        type: 'fill',
        source: 'flood',
        filter: ['==', ['get', 'band'], 0],
        layout: { visibility: 'none' },
        paint: { 'fill-color': ramp('arrivalS', ARRIVAL_STOPS), 'fill-opacity': 0.75, 'fill-antialias': false },
      },
      {
        id: 'observed-flood',
        type: 'fill',
        source: 'observed',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#f0abfc', 'fill-opacity': 0.5, 'fill-outline-color': '#e879f9' },
      },
      {
        id: 'settlements-circle',
        type: 'circle',
        source: 'settlements',
        filter: [
          'any',
          ['in', ['get', 'kind'], ['literal', ['city', 'town']]],
          ['all', ['==', ['get', 'kind'], 'village'], ['>=', ['zoom'], 10.5]],
          ['>=', ['zoom'], 12],
        ],
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'city', 6, 'town', 5, 'village', 3.2, 2.2],
          'circle-color': '#fbbf24',
          'circle-stroke-color': '#1f2937',
          'circle-stroke-width': 1,
        },
      },
      {
        id: 'settlements-label',
        type: 'symbol',
        source: 'settlements',
        filter: ['any', ['in', ['get', 'kind'], ['literal', ['city', 'town']]], ['all', ['==', ['get', 'kind'], 'village'], ['>=', ['zoom'], 11]]],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'kind'], 'city', 13, 'town', 12, 10.5],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#f8fafc', 'text-halo-color': '#0b1220', 'text-halo-width': 1.3 },
      },
      {
        id: 'exposure-circle',
        type: 'circle',
        source: 'exposure',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'hospital', 6, 'clinic', 5, 'school', 5, 'college', 5, 'city', 6, 'town', 5.5, 4],
          'circle-color': [
            'match',
            ['get', 'kind'],
            ['hospital', 'clinic'],
            '#ef4444',
            ['school', 'college'],
            '#3b82f6',
            '#f59e0b',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: 'dam-point',
        type: 'circle',
        source: 'dam',
        paint: { 'circle-radius': 7, 'circle-color': '#f8fafc', 'circle-stroke-color': '#0b1220', 'circle-stroke-width': 2.5 },
      },
      {
        id: 'dam-label',
        type: 'symbol',
        source: 'dam',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-offset': [0, -1.4],
          'text-anchor': 'bottom',
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b1220', 'text-halo-width': 1.5 },
      },
    ],
  }
}
