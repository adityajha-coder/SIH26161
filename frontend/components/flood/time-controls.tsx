'use client'

import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PLAYBACK_SPEEDS } from './use-player'

export function TimeControls({
  timeS,
  maxS,
  playing,
  onToggle,
  onSeek,
  onReset,
  speed,
  onSpeedChange,
  className,
}: {
  timeS: number
  maxS: number
  playing: boolean
  onToggle: () => void
  onSeek: (t: number) => void
  onReset?: () => void
  speed?: number
  onSpeedChange?: (s: number) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        size="icon"
        onClick={onToggle}
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        className="size-8 shrink-0 rounded-full"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </Button>
      {onReset && (
        <Button variant="ghost" size="icon" onClick={onReset} aria-label="Reset to breach time" className="size-8 shrink-0">
          <RotateCcw className="size-4" />
        </Button>
      )}
      <Slider
        aria-label="Simulation time"
        min={0}
        max={Math.max(1, maxS)}
        step={30}
        value={[timeS]}
        onValueChange={(v) => onSeek(Array.isArray(v) ? v[0] : v)}
        className="flex-1"
      />
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">{formatClock(timeS)}</span>
      {onSpeedChange && speed !== undefined && (
        <div className="hidden shrink-0 items-center rounded-md border border-border p-0.5 sm:flex" role="group" aria-label="Playback speed">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              aria-pressed={speed === s}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px]',
                speed === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
