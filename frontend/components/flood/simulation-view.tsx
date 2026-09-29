'use client'

import { MapView } from '@/components/map/map-view'
import type { BaseMode, LayerVisibility } from '@/components/map/map-style'
import { RampLegend } from '@/components/map/legend'
import type { FloodBands } from '@/lib/flood-model'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

import { usePlatform } from '@/lib/platform-store'

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
  center,
  zoom,
  pitch,
  bearing,
  cameraTarget,
  interactive = true,
  showMaxExtent = false,
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
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  cameraTarget?: { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce?: number } | null
  interactive?: boolean
  showMaxExtent?: boolean
}) {
  const { activeCase } = usePlatform()
  const is3d = layers.terrain3d || base === 'terrain'
  const legend = layers.arrivalTime ? 'arrival' : layers.floodVelocity ? 'velocity' : layers.floodDepth ? 'depth' : null

  const mapCenter = center ?? (is3d ? (activeCase?.center ?? [78.505, 30.29]) : (activeCase?.center ?? [78.4, 30.17]))
  const mapZoom = zoom ?? (is3d ? (activeCase?.zoom ?? 10.5) : Math.max(8.5, (activeCase?.zoom ?? 10.2) - 0.5))
  const mapPitch = pitch ?? (is3d ? (activeCase?.pitch ?? 58) : 0)
  const mapBearing = bearing ?? (is3d ? (activeCase?.bearing ?? 195) : 0)

  return (
    <div className={cn('relative overflow-hidden rounded-xl min-h-95 w-full', className)}>
      <MapView
        base={base}
        layers={layers}
        exaggeration={exaggeration}
        flood={flood}
        timeS={timeS}
        floodOpacity={floodOpacity}
        center={mapCenter}
        zoom={mapZoom}
        pitch={mapPitch}
        bearing={mapBearing}
        cameraTarget={cameraTarget}
        activeCase={activeCase}
        interactive={interactive}
        showMaxExtent={showMaxExtent}
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
          {legend && <RampLegend kind={legend} className="pointer-events-none absolute bottom-8 left-2 w-48 bg-black/70! backdrop-blur-xl!" />}
        </>
      )}
    </div>
  )
}
