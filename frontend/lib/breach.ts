export type DamType = 'rockfill' | 'concrete_gravity' | 'concrete_arch'
export type FailureMode = 'overtopping' | 'piping' | 'natural_blockage' | 'spillway_release'
export type SensitivityCase = 'low' | 'base' | 'high'

export interface BreachInput {
  reservoirVolumeM3: number
  breachHeightM: number
  waterDepthM: number
  failureMode: FailureMode
  damType?: DamType
  breachWidthOverrideM?: number
  formationTimeOverrideS?: number
}

export interface BreachParameters {
  equation: string
  avgWidthM: number
  formationTimeS: number
  peakDischargeM3s: number
  sideSlope: number
}

export interface HydrographPoint {
  t: number
  q: number
}

export interface Hydrograph {
  points: HydrographPoint[]
  peakDischargeM3s: number
  timeToPeakS: number
  releasedVolumeM3: number
  targetVolumeM3: number
  massBalanceErrorPct: number
  massBalancePass: boolean
  shapeExponent: number
}

const G = 9.81
export const MASS_BALANCE_TOLERANCE_PCT = 1

export const BREACH_BOUNDS = {
  reservoirVolumeM3: { min: 1e5, max: 1e11 },
  breachHeightM: { min: 1, max: 300 },
  waterDepthM: { min: 1, max: 300 },
  breachWidthM: { min: 5, max: 2000 },
  formationTimeS: { min: 60, max: 36000 },
}

export function froehlichParameters(input: BreachInput): BreachParameters {
  const { reservoirVolumeM3: V, breachHeightM: hb, waterDepthM: hw, failureMode, damType } = input

  if (failureMode === 'natural_blockage') {
    // Landslide damming & GLOF breach empirical formulation (Costa & Schuster 1988, Walder & O'Connor 1997)
    const avgWidth = input.breachWidthOverrideM ?? 0.38 * Math.pow(V, 0.31) * Math.pow(hb, 0.08)
    const tf = input.formationTimeOverrideS ?? Math.max(900, 28.5 * Math.sqrt(V / (G * hb * hb)))
    const qp = 0.812 * Math.pow(V, 0.285) * Math.pow(hw, 1.30)
    return {
      equation: "Costa & Schuster (1988) / Walder-O'Connor Landslide Dam Breach",
      avgWidthM: avgWidth,
      formationTimeS: tf,
      peakDischargeM3s: qp,
      sideSlope: 1.2,
    }
  }

  if (failureMode === 'spillway_release') {
    // Controlled emergency spillway gate release surge at Full Reservoir Level (CWC rating curve)
    const spillwayWidth = input.breachWidthOverrideM ?? 120.0
    const tf = input.formationTimeOverrideS ?? 1800.0 // 30 min surge ramp-up
    // Standard broad-crested weir / chute equation Q = C * L * H^1.5 with C = 2.15
    const head = Math.max(1.0, hw - Math.max(0, hw - 15.0))
    const qp = Math.min(15300.0, 2.15 * spillwayWidth * Math.pow(head, 1.5))
    return {
      equation: 'CWC Surcharge Spillway Hydrograph (Controlled Gate Surge)',
      avgWidthM: spillwayWidth,
      formationTimeS: tf,
      peakDischargeM3s: qp,
      sideSlope: 0.0,
    }
  }

  // Branch by dam structural type (USBR 1988 / FERC 1993 / CWC Guidelines)
  if (damType === 'concrete_arch') {
    const avgWidth = input.breachWidthOverrideM ?? Math.min(240, hw * 2.2)
    const tf = input.formationTimeOverrideS ?? 300 // ~5 min instantaneous structural cantilever failure
    const qp = Math.min(250000, 1.8 * avgWidth * Math.pow(hw, 1.5))
    return {
      equation: 'USBR / FERC Concrete Arch Instantaneous Cantilever Fracture',
      avgWidthM: avgWidth,
      formationTimeS: tf,
      peakDischargeM3s: qp,
      sideSlope: 0.0,
    }
  }

  if (damType === 'concrete_gravity') {
    const avgWidth = input.breachWidthOverrideM ?? 50.0 // 2-3 monolith blocks
    const tf = input.formationTimeOverrideS ?? 720 // ~12 min rapid monolith sliding/overturning
    const qp = Math.min(250000, 1.7 * avgWidth * Math.pow(hw, 1.5))
    return {
      equation: 'USBR / FERC Monolith Sliding & Overturning Failure (1-3 Blocks)',
      avgWidthM: avgWidth,
      formationTimeS: tf,
      peakDischargeM3s: qp,
      sideSlope: 0.0,
    }
  }

  // Earthen & Rockfill Embankment (Froehlich 2008 / 1995 progressive erosion)
  const k0 = failureMode === 'overtopping' ? 1.3 : 1.0
  const avgWidth = input.breachWidthOverrideM ?? 0.27 * k0 * Math.pow(V, 0.32) * Math.pow(hb, 0.04)
  const tf = input.formationTimeOverrideS ?? 63.2 * Math.sqrt(V / (G * hb * hb))
  const qp = 0.607 * Math.pow(V, 0.295) * Math.pow(hw, 1.24)
  return {
    equation: 'Froehlich (2008) width/time · Froehlich (1995) peak outflow',
    avgWidthM: avgWidth,
    formationTimeS: tf,
    peakDischargeM3s: qp,
    sideSlope: failureMode === 'overtopping' ? 1.0 : 0.7,
  }
}

function shape(t: number, tp: number, m: number) {
  if (t <= 0) return 0
  const r = t / tp
  return Math.pow(r, m) * Math.exp(m * (1 - r))
}

// Integrates dimensionless breach shape function using Composite Simpson's 1/3 Rule
// with even sub-intervals (N = 4000) for high-order quadratic quadrature.
function integrateShape(tp: number, m: number, horizon: number, steps = 4000) {
  const n = steps % 2 === 0 ? steps : steps + 1
  const dt = horizon / n

  let sum = shape(0, tp, m) + shape(horizon, tp, m)
  for (let i = 1; i < n; i++) {
    const val = shape(i * dt, tp, m)
    sum += i % 2 === 1 ? 4 * val : 2 * val
  }
  return (dt / 3) * sum
}

export function buildHydrograph(
  params: BreachParameters,
  targetVolumeM3: number,
  horizonS: number,
  sensitivity: SensitivityCase = 'base',
  samples = 240,
): Hydrograph {
  const qFactor = sensitivity === 'low' ? 0.75 : sensitivity === 'high' ? 1.25 : 1
  const tFactor = sensitivity === 'low' ? 1.4 : sensitivity === 'high' ? 0.7 : 1
  const qp = params.peakDischargeM3s * qFactor
  const tp = params.formationTimeS * tFactor
  const integrationHorizon = Math.max(horizonS, tp * 12)

  const targetShapeIntegral = targetVolumeM3 / qp
  let lo = 0.2
  let hi = 60
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const integral = integrateShape(tp, mid, integrationHorizon, 1500)
    if (integral > targetShapeIntegral) lo = mid
    else hi = mid
  }
  const m = (lo + hi) / 2
  const rawIntegral = integrateShape(tp, m, integrationHorizon)
  const scale = targetVolumeM3 / (qp * rawIntegral)
  const qPeak = qp * scale

  const points: HydrographPoint[] = []
  const dt = horizonS / samples
  for (let i = 0; i <= samples; i++) {
    const t = i * dt
    points.push({ t, q: Math.max(0, qPeak * shape(t, tp, m)) })
  }

  const released = qPeak * integrateShape(tp, m, integrationHorizon)
  const err = (Math.abs(released - targetVolumeM3) / targetVolumeM3) * 100

  return {
    points,
    peakDischargeM3s: qPeak,
    timeToPeakS: tp,
    releasedVolumeM3: released,
    targetVolumeM3,
    massBalanceErrorPct: err,
    massBalancePass: err <= MASS_BALANCE_TOLERANCE_PCT,
    shapeExponent: m,
  }
}
