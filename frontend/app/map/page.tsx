'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Play, Pause, RotateCcw, Layers, ChevronRight, ChevronLeft,
  Mountain, Satellite, Moon, Map as MapIcon, Eye, EyeOff,
  Clock
} from 'lucide-react'
import { MapView } from '@/components/map/map-view'
import { RampLegend } from '@/components/map/legend'
import { DEFAULT_LAYERS, type BaseMode, type LayerVisibility } from '@/components/map/map-style'
import { useSimulationPlayer, PLAYBACK_SPEEDS } from '@/components/flood/use-player'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult } from '@/lib/use-flood'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'

/* ─── Layer items ─────────────────────────────────────────────────── */
type LayerKey = keyof LayerVisibility
const LAYER_GROUPS: { title: string; items: { key: LayerKey | 'settlementsInfra'; label: string; icon: string; hint?: string; disabled?: boolean }[] }[] = [
  {
    title: 'Terrain',
    items: [
      { key: 'terrain3d', label: '3D Terrain Elevation', icon: '🏔️' },
      { key: 'hillshade', label: 'Hillshade', icon: '🌄' },
      { key: 'contours', label: 'Contours', icon: '〰️' },
    ],
  },
  {
    title: 'Hydrology',
    items: [
      { key: 'river', label: 'River Network', icon: '🌊' },
      { key: 'dam', label: 'Dam & Reservoir', icon: '🏗️' },
    ],
  },
  {
    title: 'Simulation',
    items: [
      { key: 'floodDepth', label: 'Inundation Depth (m)', icon: '💧' },
      { key: 'floodVelocity', label: 'Wave Velocity (m/s)', icon: '⚡' },
      { key: 'arrivalTime', label: 'Arrival Isochrones', icon: '⏱️' },
      { key: 'observedFlood', label: 'Sentinel-1 SAR', icon: '🛰️', hint: 'No active pass', disabled: true },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { key: 'settlementsInfra', label: 'Settlements', icon: '🏘️' },
      { key: 'roads', label: 'Roads & Highways', icon: '🛣️' },
    ],
  },
]

/* ─── Base mode configs ───────────────────────────────────────────── */
const BASE_MODES: { mode: BaseMode; label: string; icon: typeof Mountain }[] = [
  { mode: 'terrain', label: '3D Terrain', icon: Mountain },
  { mode: 'satellite', label: 'Satellite', icon: Satellite },
  { mode: 'hillshade', label: 'Hillshade', icon: Moon },
  { mode: 'contour', label: 'Contours', icon: MapIcon },
]

export default function MapPage() {
  const { activeScenario, activeRun } = usePlatform()
  const [base, setBase] = useState<BaseMode>('terrain')
  const [layers, setLayers] = useState<LayerVisibility>({
    ...DEFAULT_LAYERS,
    terrain3d: true,
    hillshade: true,
    contours: true,
    settlements: true,
    floodDepth: true,
  })
  const [exaggeration, setExaggeration] = useState(1.5)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [legendExpanded, setLegendExpanded] = useState(true)

  // Complete 129 km Delft3D hydrodynamic simulation
  const { result } = useFloodResult(activeScenario, 'delft3d', activeRun)

  // Simulation time horizon (9900s = 02:45:00 for full 129 km reach to Haridwar)
  const maxS = useMemo(() => {
    if (result && Number.isFinite(result.maxArrivalS) && result.maxArrivalS > 0) {
      return Math.ceil(result.maxArrivalS / 300) * 300
    }
    return 9900
  }, [result])

  const player = useSimulationPlayer(maxS, 0)

  const handleBase = useCallback((m: BaseMode) => {
    setBase(m)
    setLayers((l) => ({ ...l, terrain3d: m === 'terrain' }))
  }, [])

  const handleLayers = useCallback((next: LayerVisibility) => {
    setLayers(next)
    if (next.terrain3d && base === 'satellite') setBase('terrain')
    if (!next.terrain3d && base === 'terrain') setBase('satellite')
  }, [base])

  const checked = (key: LayerKey | 'settlementsInfra') =>
    key === 'settlementsInfra' ? layers.settlements || layers.roads : layers[key as LayerKey]

  const toggle = (key: LayerKey | 'settlementsInfra', value: boolean) => {
    if (key === 'settlementsInfra') handleLayers({ ...layers, settlements: value, roads: value })
    else handleLayers({ ...layers, [key]: value })
  }

  const is3d = layers.terrain3d || base === 'terrain'
  const activeLegend = layers.arrivalTime ? 'arrival' : layers.floodVelocity ? 'velocity' : layers.floodDepth ? 'depth' : null
  const progress = maxS > 0 ? (player.timeS / maxS) * 100 : 0

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0C0C0C]">
      {/* ── Full-bleed 3D Map Canvas ───────────────────────────────── */}
      <MapView
        base={base}
        layers={layers}
        exaggeration={exaggeration}
        flood={result?.bands ?? null}
        timeS={player.timeS}
        center={is3d ? [78.505, 30.29] : [78.4, 30.17]}
        zoom={is3d ? 11 : 9.7}
        pitch={is3d ? 62 : 0}
        bearing={is3d ? 190 : 0}
        className="absolute inset-0 h-full w-full"
        ariaLabel="Flood simulation map"
      />

      {/* ── Top-Left: Minimal Clock Status Badge ────────────────────── */}
      <div className="pointer-events-none absolute top-4 left-18 z-10">
        <div className="pointer-events-auto map-hud-panel flex items-center gap-2.5 rounded-2xl px-3.5 py-2">
          <span className={cn(
            'size-2.5 rounded-full',
            player.playing ? 'bg-[#23a55a]' : 'bg-[#f0b232]'
          )} />
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-bold tabular-nums text-white">
              {formatClock(player.timeS)}
            </span>
            <span className="text-[10px] text-white/40 uppercase font-mono">
              / {formatClock(maxS)}
            </span>
          </div>
          <span className="text-white/20 text-xs">|</span>
          <span className="text-[11px] text-white/60 font-medium">129 km Corridor</span>
        </div>
      </div>

      {/* ── Top-Center: Base Map Switcher ──────────────────────────── */}
      <div className="pointer-events-auto absolute top-4 left-1/2 z-10 -translate-x-1/2">
        <div className="map-hud-panel flex items-center gap-1 rounded-2xl p-1">
          {BASE_MODES.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => handleBase(mode)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 cursor-pointer',
                base === mode
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Top-Right: Layers Drawer Toggle ────────────────────────── */}
      <div className="pointer-events-auto absolute top-4 right-4 z-10">
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={cn(
            'map-hud-panel flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer',
            drawerOpen
              ? 'bg-white text-black'
              : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
          )}
        >
          <Layers className="size-4" />
          <span className="hidden sm:inline">Layers</span>
          {drawerOpen ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </div>

      {/* ── Layer Control Drawer ───────────────────────────────────── */}
      <div
        className={cn(
          'absolute top-16 right-4 z-20 w-[270px] transition-all duration-200 ease-out',
          drawerOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : 'translate-x-full opacity-0 pointer-events-none'
        )}
      >
        <div className="map-hud-panel-solid flex flex-col gap-0.5 rounded-2xl max-h-[calc(100vh-160px)] overflow-y-auto">
          <div className="px-4 pt-4 pb-2 border-b border-white/[0.06]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">GIS Layers</h3>
          </div>

          {LAYER_GROUPS.map((group) => (
            <div key={group.title} className="px-3 pt-2.5 pb-2 border-b border-white/[0.04]">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isDisabled = item.key === 'observedFlood' ? true : item.disabled
                  return (
                    <li key={item.key}>
                      <label
                        className={cn(
                          'group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs transition-all',
                          isDisabled ? 'cursor-not-allowed opacity-35' : 'hover:bg-white/[0.06]'
                        )}
                      >
                        <Checkbox
                          id={`layer-${item.key}`}
                          checked={checked(item.key)}
                          disabled={isDisabled}
                          onCheckedChange={(v) => toggle(item.key, Boolean(v))}
                        />
                        <span className="flex-1">
                          <span className="flex items-center gap-1.5 font-medium text-white/90 group-hover:text-white">
                            <span className="text-sm">{item.icon}</span>
                            {item.label}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Terrain Exaggeration Slider */}
          <div className="px-4 pt-3 pb-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-white/70 font-medium">3D Relief</span>
              <span className="font-mono text-white font-bold text-[11px]">{exaggeration.toFixed(1)}×</span>
            </div>
            <Slider
              aria-label="Terrain exaggeration scale"
              min={1}
              max={3}
              step={0.1}
              value={[exaggeration]}
              onValueChange={(v) => setExaggeration(Array.isArray(v) ? v[0] : v)}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom-Left: Collapsible Legend ────────────────────────── */}
      <div className="pointer-events-auto absolute bottom-20 left-18 z-10">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setLegendExpanded(!legendExpanded)}
            className="map-hud-panel flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-semibold text-white/60 hover:text-white transition-all cursor-pointer self-start"
          >
            {legendExpanded ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            {legendExpanded ? 'Hide Legend' : 'Legend'}
          </button>
          {legendExpanded && activeLegend && (
            <div className="animate-in fade-in duration-150">
              <RampLegend kind={activeLegend} className="w-56 !bg-[#0C0C0C]/85 !backdrop-blur-xl border border-white/10" />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: Minimalist Cinematic Simulation Player ─────────── */}
      <div className="pointer-events-auto absolute bottom-0 inset-x-0 z-10 pl-16">
        {/* Progress ribbon */}
        <div className="relative h-1 w-full bg-white/[0.08] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-75 ease-linear bg-white"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Player bar */}
        <div className="map-time-bar flex items-center gap-3 px-4 py-2.5">
          {/* Play / Pause Toggle */}
          <button
            onClick={player.toggle}
            aria-label={player.playing ? 'Pause simulation' : 'Play simulation'}
            className={cn(
              'relative flex size-10 items-center justify-center rounded-full transition-all duration-150 cursor-pointer shrink-0',
              'bg-white hover:bg-white/90 text-black',
              'active:scale-90'
            )}
          >
            {player.playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
          </button>

          {/* Reset Rewind */}
          <button
            onClick={player.reset}
            title="Rewind to breach inception"
            className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer shrink-0"
          >
            <RotateCcw className="size-3.5" />
          </button>

          {/* Scrubber Slider */}
          <div className="flex-1 px-2">
            <Slider
              aria-label="Simulation time scrubber"
              min={0}
              max={Math.max(1, maxS)}
              step={1}
              value={[player.timeS]}
              onValueChange={(v) => player.setTimeS(Array.isArray(v) ? v[0] : v)}
            />
          </div>

          {/* Clock Display */}
          <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs font-bold tabular-nums text-white">
            <Clock className="size-3 text-white/40" />
            <span>{formatClock(player.timeS)}</span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">{formatClock(maxS)}</span>
          </div>

          <div className="h-5 w-px bg-white/[0.08] hidden sm:block" />

          {/* Speed Selector */}
          <div className="hidden sm:flex items-center gap-0.5 rounded-xl p-0.5 bg-white/[0.04]">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => player.setSpeed(s)}
                className={cn(
                  'rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold transition-all cursor-pointer',
                  player.speed === s
                    ? 'bg-white text-black'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
