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
    <div className={cn('glass-panel-subtle flex items-center gap-3 px-3 py-2 rounded-xl', className)}>
      <Button
        size="icon"
        onClick={onToggle}
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        className="size-8 shrink-0 rounded-full bg-[#5865f2] hover:bg-[#4752c4] text-white shadow-[0_0_12px_rgba(88,101,242,0.35)]"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </Button>
      {onReset && (
        <Button variant="ghost" size="icon" onClick={onReset} aria-label="Reset to breach time" className="size-8 shrink-0 text-[#949ba4] hover:text-white">
          <RotateCcw className="size-3.5" />
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
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-white font-semibold">{formatClock(timeS)}</span>
      {onSpeedChange && speed !== undefined && (
        <div className="hidden shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5 sm:flex" role="group" aria-label="Playback speed">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              aria-pressed={speed === s}
              className={cn(
                'rounded-md px-2 py-0.5 font-mono text-xs font-semibold transition-all cursor-pointer',
                speed === s ? 'bg-[#5865f2] text-white shadow-sm' : 'text-[#949ba4] hover:text-white',
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
