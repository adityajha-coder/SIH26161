'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import type { LayerVisibility } from '@/components/map/map-style'

type LayerKey = keyof LayerVisibility

const ITEMS: { key: LayerKey | 'settlementsInfra'; label: string; hint?: string; disabled?: boolean }[] = [
  { key: 'terrain3d', label: 'Terrain (3D)' },
  { key: 'hillshade', label: 'Hillshade' },
  { key: 'contours', label: 'Contour Lines' },
  { key: 'river', label: 'River Network' },
  { key: 'dam', label: 'Dam / Reservoir' },
  { key: 'floodDepth', label: 'Flood Depth (Simulation)' },
  { key: 'floodVelocity', label: 'Flood Velocity' },
  { key: 'arrivalTime', label: 'Arrival Time' },
  { key: 'observedFlood', label: 'Satellite Flood (Sentinel-1)', hint: 'No acquisition ingested', disabled: true },
  { key: 'settlementsInfra', label: 'Settlements & Infrastructure' },
]

export function LayerControl({
  layers,
  onChange,
  exaggeration,
  onExaggerationChange,
  floodOpacity,
  onFloodOpacityChange,
  observedAvailable = false,
}: {
  layers: LayerVisibility
  onChange: (next: LayerVisibility) => void
  exaggeration: number
  onExaggerationChange: (v: number) => void
  floodOpacity?: number
  onFloodOpacityChange?: (v: number) => void
  observedAvailable?: boolean
}) {
  const checked = (key: LayerKey | 'settlementsInfra') =>
    key === 'settlementsInfra' ? layers.settlements || layers.roads : layers[key]

  const toggle = (key: LayerKey | 'settlementsInfra', value: boolean) => {
    if (key === 'settlementsInfra') onChange({ ...layers, settlements: value, roads: value })
    else onChange({ ...layers, [key]: value })
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const disabled = item.key === 'observedFlood' ? !observedAvailable : item.disabled
          const id = `layer-${item.key}`
          return (
            <li key={item.key}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs text-white hover:bg-white/[0.06] transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40"
              >
                <Checkbox
                  id={id}
                  checked={checked(item.key)}
                  disabled={disabled}
                  onCheckedChange={(v) => toggle(item.key, Boolean(v))}
                />
                <span className="flex-1 font-medium text-white">
                  {item.label}
                  {disabled && item.hint && <span className="block text-[10px] text-white/70 font-normal">{item.hint}</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto space-y-4 border-t border-white/[0.08] pt-3.5">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-white font-medium">Terrain Exaggeration</span>
            <span className="font-mono text-white font-semibold">{exaggeration.toFixed(1)}x</span>
          </div>
          <Slider
            aria-label="Terrain exaggeration"
            min={1}
            max={3}
            step={0.1}
            value={[exaggeration]}
            onValueChange={(v) => onExaggerationChange(Array.isArray(v) ? v[0] : v)}
          />
        </div>
        {onFloodOpacityChange && floodOpacity !== undefined && (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-white font-medium">Flood Layer Opacity</span>
              <span className="font-mono text-white font-semibold">{Math.round(floodOpacity * 100)}%</span>
            </div>
            <Slider
              aria-label="Flood layer opacity"
              min={0.1}
              max={1}
              step={0.05}
              value={[floodOpacity]}
              onValueChange={(v) => onFloodOpacityChange(Array.isArray(v) ? v[0] : v)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
