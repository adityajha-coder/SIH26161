'use client'

import { MapView } from '@/components/map/map-view'
import type { BaseMode } from '@/components/map/map-style'
import { cn } from '@/lib/utils'

const VIEWS: { mode: BaseMode; label: string }[] = [
  { mode: 'satellite', label: '2D Map (Satellite)' },
  { mode: 'terrain', label: '3D Terrain View' },
  { mode: 'hillshade', label: 'Hillshade View' },
  { mode: 'contour', label: 'Contour View' },
]

const THUMB_VIEW = { center: [78.475, 30.33] as [number, number], zoom: 10.4 }

export function TerrainViews({ value, onChange }: { value: BaseMode; onChange: (m: BaseMode) => void }) {
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
      {VIEWS.map((v) => {
        const active = value === v.mode
        return (
          <button
            key={v.mode}
            type="button"
            onClick={() => onChange(v.mode)}
            aria-pressed={active}
            aria-label={`Switch main view to ${v.label}`}
            className={cn(
              'relative min-h-28 overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer',
              active
                ? 'border-[#5865f2] ring-1 ring-[#5865f2] shadow-[0_0_16px_rgba(88,101,242,0.35)]'
                : 'border-white/[0.08] hover:border-white/[0.2]',
            )}
          >
            <MapView
              base={v.mode}
              interactive={false}
              center={THUMB_VIEW.center}
              zoom={v.mode === 'terrain' ? 10.9 : THUMB_VIEW.zoom}
              pitch={v.mode === 'terrain' ? 58 : 0}
              bearing={v.mode === 'terrain' ? 200 : 0}
              layers={{ settlements: false, dam: v.mode !== 'contour', river: true, floodDepth: false }}
              label={v.label}
              className="pointer-events-none absolute inset-0"
            />
          </button>
        )
      })}
    </div>
  )
}
