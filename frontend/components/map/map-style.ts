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
  [0, '#7dd3fc'],
  [2, '#38bdf8'],
  [6, '#0284c7'],
  [14, '#0369a1'],
  [28, '#1e40af'],
  [55, '#0f172a'],
]

export const VELOCITY_STOPS: [number, string][] = [
  [0, '#0284c7'],
  [3, '#0ea5e9'],
  [7, '#06b6d4'],
  [12, '#38bdf8'],
  [18, '#f8fafc'],
]

export const ARRIVAL_STOPS: [number, string][] = [
  [0, '#1e3a8a'],
  [1800, '#2563eb'],
  [3600, '#0284c7'],
  [7200, '#38bdf8'],
  [14400, '#bae6fd'],
]

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  if (clean.length === 3) {
    const r = ((num >> 8) & 0xf) * 17
    const g = ((num >> 4) & 0xf) * 17
    const b = (num & 0xf) * 17
    return [r, g, b]
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

/**
 * Interpolate a continuous value along a piecewise ramp of [stopValue, hexColor]
 */
export function interpolateRampColor(val: number, stops: [number, string][]): string {
  if (stops.length === 0) return '#ffffff'
  if (val <= stops[0][0]) return stops[0][1]
  if (val >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]

  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i]
    const [v1, c1] = stops[i + 1]
    if (val >= v0 && val <= v1) {
      const t = (val - v0) / (v1 - v0)
      const rgb0 = hexToRgb(c0)
      const rgb1 = hexToRgb(c1)
      const r = rgb0[0] + (rgb1[0] - rgb0[0]) * t
      const g = rgb0[1] + (rgb1[1] - rgb0[1]) * t
      const b = rgb0[2] + (rgb1[2] - rgb0[2]) * t
      return rgbToHex(r, g, b)
    }
  }
  return stops[stops.length - 1][1]
}
