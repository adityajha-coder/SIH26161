'use client'

import { MapView } from '@/components/map/map-view'
import type { BaseMode, LayerVisibility } from '@/components/map/map-style'
import { RampLegend } from '@/components/map/legend'
import type { FloodBands } from '@/lib/flood-model'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

export function SimulationView({
  base,
  layers,
  exaggeration,
  flood,
  timeS,
  floodOpacity,
  className,
  compact = false,
  title = 'Flood propagation after dam break',
  hideOverlays = false,
}: {
  base: BaseMode
  layers: LayerVisibility
  exaggeration: number
  flood: FloodBands | null
  timeS: number
  floodOpacity?: number
  className?: string
  compact?: boolean
  title?: string
  hideOverlays?: boolean
}) {
  const is3d = layers.terrain3d || base === 'terrain'
  const legend = layers.arrivalTime ? 'arrival' : layers.floodVelocity ? 'velocity' : layers.floodDepth ? 'depth' : null
  return (
    <div className={cn('relative overflow-hidden rounded-xl min-h-[380px] w-full', className)}>
      <MapView
        base={base}
        layers={layers}
        exaggeration={exaggeration}
        flood={flood}
        timeS={timeS}
        floodOpacity={floodOpacity}
        center={is3d ? [78.505, 30.29] : compact ? [78.47, 30.29] : [78.4, 30.17]}
        zoom={is3d ? 11 : compact ? 10.4 : 9.7}
        pitch={is3d ? 62 : 0}
        bearing={is3d ? 190 : 0}
        className="absolute inset-0"
        ariaLabel="Flood simulation map"
      />
      {!hideOverlays && (
        <>
          <div className="pointer-events-none absolute top-2 right-12 map-hud-panel rounded-xl px-3 py-2 text-right">
            <p className="font-mono text-xs font-semibold tabular-nums text-white">
              Time: {formatClock(timeS)}
            </p>
            <p className="text-[10px] text-white/50">{title}</p>
          </div>
          {legend && <RampLegend kind={legend} className="pointer-events-none absolute bottom-8 left-2 w-48 !bg-black/70 !backdrop-blur-xl" />}
        </>
      )}
    </div>
  )
}
