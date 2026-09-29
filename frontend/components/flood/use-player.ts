'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8]

// Base simulation rate: 1 real second = 120 simulation seconds (2 min/sec at 1x)
const BASE_RATE = 120

export function useSimulationPlayer(maxS: number, initialS = 0) {
  const [timeS, setTimeS] = useState(initialS)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const timeRef = useRef(initialS)
  const maxRef = useRef(maxS)
  maxRef.current = maxS

  const speedRef = useRef(speed)
  speedRef.current = speed

  // Keep timeS bounded when maxS changes
  useEffect(() => {
    if (maxS > 0 && timeRef.current > maxS) {
      timeRef.current = maxS
      setTimeS(maxS)
    }
  }, [maxS])

  useEffect(() => {
    if (!playing || maxS <= 0) return

    let lastTimestamp = performance.now()
    let animId: number

    const tick = (now: number) => {
      const elapsedSec = Math.min((now - lastTimestamp) / 1000, 0.25)
      lastTimestamp = now

      const current = timeRef.current
      const next = current + elapsedSec * BASE_RATE * speedRef.current
      const limit = maxRef.current

      if (limit > 0 && next >= limit) {
        timeRef.current = limit
        setTimeS(limit)
        setPlaying(false)
        return
      }

      timeRef.current = next
      setTimeS(next)
      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [playing, maxS])

  const toggle = useCallback(() => {
    setPlaying((prev) => {
      if (!prev) {
        // If starting while at or near the end, restart from 0
        if (maxRef.current > 0 && timeRef.current >= maxRef.current - 5) {
          timeRef.current = 0
          setTimeS(0)
        }
        return true
      }
      return false
    })
  }, [])

  const seek = useCallback((targetTime: number) => {
    const limit = maxRef.current
    const clamped = Math.max(0, limit > 0 ? Math.min(targetTime, limit) : targetTime)
    timeRef.current = clamped
    setTimeS(clamped)
  }, [])

  const play = useCallback(() => {
    if (maxRef.current > 0 && timeRef.current >= maxRef.current - 5) {
      timeRef.current = 0
      setTimeS(0)
    }
    setPlaying(true)
  }, [])

  const pause = useCallback(() => {
    setPlaying(false)
  }, [])

  const reset = useCallback(() => {
    setPlaying(false)
    timeRef.current = 0
    setTimeS(0)
  }, [])

  return {
    timeS: Math.round(timeS),
    setTimeS: seek,
    playing,
    toggle,
    play,
    pause,
    speed,
    setSpeed,
    reset,
  }
}
