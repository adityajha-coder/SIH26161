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
      {/* Play/Pause Button */}
      <Button
        size="icon"
        onClick={onToggle}
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        className="size-8 shrink-0 rounded-full bg-white hover:bg-white/90 text-black cursor-pointer transition-transform active:scale-95"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </Button>

      {/* Reset / Rewind Button */}
      {onReset && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          title="Rewind to breach start (00:00:00)"
          aria-label="Reset to breach time"
          className="size-8 shrink-0 text-white/80 hover:bg-white/[0.08] hover:text-white cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      )}

      {/* Interactive Time Slider */}
      <Slider
        aria-label="Simulation time scrubber"
        min={0}
        max={Math.max(1, maxS)}
        step={1}
        value={[timeS]}
        onValueChange={(v) => onSeek(Array.isArray(v) ? v[0] : v)}
        className="flex-1"
      />

      {/* Timestamp Display */}
      <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-white shrink-0">
        <span className="font-semibold text-white">{formatClock(timeS)}</span>
        <span className="text-white/40">/</span>
        <span className="text-white/70">{formatClock(maxS)}</span>
      </div>

      {/* Playback Speed Selector */}
      {onSpeedChange && speed !== undefined && (
        <div className="hidden shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 sm:flex" role="group" aria-label="Playback speed">
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              aria-pressed={speed === s}
              className={cn(
                'rounded-md px-2 py-0.5 font-mono text-xs font-semibold transition-all cursor-pointer',
                speed === s ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white',
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
