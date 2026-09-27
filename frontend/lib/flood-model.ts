import { booleanPointInPolygon, buffer, length, lineSliceAlong, point, along, nearestPointOnLine } from '@turf/turf'
import type { Feature, FeatureCollection, LineString, Point, Polygon, MultiPolygon } from 'geojson'

export interface FloodBandProps {
  chainageKm: number
  arrivalS: number
  depthM: number
  peakDepthM: number
  velocityMs: number
  topWidthM: number
  dischargeM3s: number
  band: number
}

export type FloodBands = FeatureCollection<Polygon | MultiPolygon, FloodBandProps>

export interface FloodStation {
  chainageKm: number
  arrivalS: number
  peakDepthM: number
  velocityMs: number
  dischargeM3s: number
  topWidthM: number
}

export interface FloodResult {
  bands: FloodBands
  stations: FloodStation[]
  reachKm: number
  floodedAreaKm2: number
  maxArrivalS: number
  method: string
}

const BANDS = [
  { width: 1, depth: 0.25 },
  { width: 0.62, depth: 0.6 },
  { width: 0.3, depth: 1 },
]

export function computePreviewFlood(
  river: Feature<LineString>,
  peakDischargeM3s: number,
  manningN: number,
  plainsStartKm: number,
  stepKm = 0.5,
): FloodResult {
  const safePeakQ = Number(peakDischargeM3s) > 0 ? Number(peakDischargeM3s) : 250000
  const safeManning = Number(manningN) > 0 ? Number(manningN) : 0.045
  const safePlainsStart = Number(plainsStartKm) > 0 ? Number(plainsStartKm) : 100

  const reachKm = length(river, { units: 'kilometers' })
  const stations: FloodStation[] = []
  const features: FloodBands['features'] = []
  let arrival = 0
  let area = 0

  for (let x = 0; x < reachKm; x += stepKm) {
    const x2 = Math.min(x + stepKm, reachKm)
    const mid = (x + x2) / 2
    const plainsBlend = 1 / (1 + Math.exp(-(mid - safePlainsStart) / 2.5))
    const B = 250 + plainsBlend * 1550
    const S = 0.0025 - plainsBlend * 0.0017
    const n = safeManning * (1 - plainsBlend * 0.22)
    const z = 1.5 + plainsBlend * 6.5
    const Q = safePeakQ * (0.35 + 0.65 * Math.exp(-mid / 45))
    const h = Math.pow((Q * n) / (B * Math.sqrt(S)), 0.6)
    const v = Q / (B * h)
    const c = Math.min((5 / 3) * v, 25)
    const topWidth = B + 2 * z * h
    arrival += ((x2 - x) * 1000) / c

    stations.push({ chainageKm: mid, arrivalS: arrival, peakDepthM: h, velocityMs: v, dischargeM3s: Q, topWidthM: topWidth })
    area += (topWidth * (x2 - x) * 1000) / 1e6

    const seg = lineSliceAlong(river, x, x2, { units: 'kilometers' })
    const coords = seg.geometry?.coordinates
    if (!coords || coords.length < 2) continue
    BANDS.forEach((b, i) => {
      let poly: ReturnType<typeof buffer> | null = null
      try {
        poly = buffer(seg, (topWidth * b.width) / 2, { units: 'meters', steps: 3 })
      } catch {
        return
      }
      if (!poly) return
      features.push({
        type: 'Feature',
        properties: {
          chainageKm: mid,
          arrivalS: arrival,
          depthM: h * b.depth,
          peakDepthM: h,
          velocityMs: v * (0.55 + 0.45 * b.depth),
          topWidthM: topWidth,
          dischargeM3s: Q,
          band: i,
        },
        geometry: poly.geometry as Polygon | MultiPolygon,
      })
    })
  }

  return {
    bands: { type: 'FeatureCollection', features },
    stations,
    reachKm,
    floodedAreaKm2: area,
    maxArrivalS: arrival,
    method: 'Analytical preview · Manning normal-depth with exponential peak attenuation (not solver output)',
  }
}

export function chainageOf(river: Feature<LineString>, lngLat: [number, number]) {
  const p = nearestPointOnLine(river, point(lngLat), { units: 'kilometers' })
  return { chainageKm: p.properties.location ?? 0, offsetKm: p.properties.dist ?? 0 }
}

export function pointAtChainage(river: Feature<LineString>, km: number) {
  return along(river, km, { units: 'kilometers' }).geometry.coordinates as [number, number]
}

export interface AssetProps {
  name: string
  kind: 'hamlet' | 'village' | 'town' | 'city' | 'hospital' | 'clinic' | 'school' | 'college'
  population?: number | null
}

export interface ExposedAsset extends AssetProps {
  lngLat: [number, number]
  arrivalS: number
  depthM: number
}

function bboxOf(f: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat()
  for (const ring of rings) for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

export function intersectAssets(
  bands: FloodBands,
  assets: FeatureCollection<Point, AssetProps>,
  atTimeS = Infinity,
): ExposedAsset[] {
  const polys = bands.features
    .filter((f) => f.properties.arrivalS <= atTimeS)
    .map((f) => ({ f, bb: bboxOf(f) }))
  const out: ExposedAsset[] = []
  for (const a of assets.features) {
    const [x, y] = a.geometry.coordinates
    let hit: FloodBandProps | null = null
    for (const { f, bb } of polys) {
      if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue
      if (booleanPointInPolygon(a.geometry.coordinates, f)) {
        if (!hit || f.properties.depthM > hit.depthM) hit = f.properties
      }
    }
    if (hit) out.push({ ...a.properties, lngLat: [x, y], arrivalS: hit.arrivalS, depthM: hit.depthM })
  }
  return out.sort((a, b) => a.arrivalS - b.arrivalS)
}

export function affectedRoadKm(
  bands: FloodBands,
  roads: FeatureCollection<LineString>,
  atTimeS = Infinity,
  sampleM = 150,
) {
  const outer = bands.features
    .filter((f) => f.properties.band === 0 && f.properties.arrivalS <= atTimeS)
    .map((f) => ({ f, bb: bboxOf(f) }))
  let km = 0
  for (const r of roads.features) {
    const L = length(r, { units: 'meters' })
    const n = Math.max(1, Math.floor(L / sampleM))
    for (let i = 0; i < n; i++) {
      const p = along(r, (i + 0.5) * (L / n), { units: 'meters' }).geometry.coordinates
      for (const { f, bb } of outer) {
        if (p[0] < bb[0] || p[0] > bb[2] || p[1] < bb[1] || p[1] > bb[3]) continue
        if (booleanPointInPolygon(p, f)) {
          km += L / n / 1000
          break
        }
      }
    }
  }
  return km
}

export function depthBand(d: number) {
  if (d < 0.5) return '< 0.5 m'
  if (d < 2) return '0.5–2 m'
  if (d < 5) return '2–5 m'
  if (d < 10) return '5–10 m'
  return '> 10 m'
}

export const DEPTH_BANDS = ['< 0.5 m', '0.5–2 m', '2–5 m', '5–10 m', '> 10 m']
