'use client'

import { useMemo } from 'react'
import { buildHydrograph, type BreachParameters } from './breach'
import type { Scenario } from './types'

export function scenarioBreachParams(s: Scenario): BreachParameters {
  return {
    equation: s.breachEquation,
    avgWidthM: s.breachWidthM,
    formationTimeS: s.formationTimeS,
    peakDischargeM3s: s.peakDischargeM3s,
    sideSlope: s.failureMode === 'overtopping' ? 1 : 0.7,
  }
}

export function useScenarioHydrographs(s: Scenario | undefined) {
  return useMemo(() => {
    if (!s) return null
    const p = scenarioBreachParams(s)
    return {
      base: buildHydrograph(p, s.reservoirVolumeM3, s.simulationHorizonS, 'base'),
      low: buildHydrograph(p, s.reservoirVolumeM3, s.simulationHorizonS, 'low'),
      high: buildHydrograph(p, s.reservoirVolumeM3, s.simulationHorizonS, 'high'),
    }
  }, [s])
}
