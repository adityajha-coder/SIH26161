'use client'

import { useMemo } from 'react'
import { buildHydrograph, type BreachParameters } from './breach'
import type { Scenario } from './types'

export function scenarioBreachParams(s: Scenario): BreachParameters {
  return {
    equation: s.breachEquation || 'froehlich_2008',
    avgWidthM: Number(s.breachWidthM) || 320,
    formationTimeS: Number(s.formationTimeS) || 4200,
    peakDischargeM3s: Number(s.peakDischargeM3s) || 250000,
    sideSlope: s.failureMode === 'overtopping' ? 1 : 0.7,
  }
}

export function useScenarioHydrographs(s: Scenario | undefined) {
  return useMemo(() => {
    if (!s) return null
    const p = scenarioBreachParams(s)
    const volume = Number(s.reservoirVolumeM3) || 3540 * 1e6
    const horizon = Number(s.simulationHorizonS) || 6 * 3600
    return {
      base: buildHydrograph(p, volume, horizon, 'base'),
      low: buildHydrograph(p, volume, horizon, 'low'),
      high: buildHydrograph(p, volume, horizon, 'high'),
    }
  }, [s])
}
