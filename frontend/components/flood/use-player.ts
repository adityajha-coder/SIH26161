'use client'

import { useEffect, useState } from 'react'

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4]

export function useSimulationPlayer(maxS: number, initialS?: number) {
  const [timeS, setTimeS] = useState(initialS ?? 0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    if (!playing || maxS <= 0) return
    const id = setInterval(() => {
      setTimeS((t) => {
        const next = t + 60 * speed
        if (next >= maxS) {
          setPlaying(false)
          return maxS
        }
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [playing, speed, maxS])

  const toggle = () => {
    if (!playing && timeS >= maxS) setTimeS(0)
    setPlaying((p) => !p)
  }

  return { timeS: Math.min(timeS, maxS || timeS), setTimeS, playing, toggle, speed, setSpeed, reset: () => setTimeS(0) }
}
