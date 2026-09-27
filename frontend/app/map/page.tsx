'use client'

import { useState } from 'react'
import { Map as MapIcon, Layers } from 'lucide-react'
import { Panel, PageHeader, PreviewNotice } from '@/components/common/panel'
import { SimulationView } from '@/components/flood/simulation-view'
import { LayerControl } from '@/components/flood/layer-control'
import { TimeControls } from '@/components/flood/time-controls'
import { useSimulationPlayer } from '@/components/flood/use-player'
import { DEFAULT_LAYERS, type BaseMode, type LayerVisibility } from '@/components/map/map-style'
import { RampLegend, SymbolLegend } from '@/components/map/legend'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult } from '@/lib/use-flood'

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
  const [showControls, setShowControls] = useState(true)
  const { result, isPreview } = useFloodResult(activeScenario, activeRun?.solver ?? 'delft3d', activeRun)
  const maxS = result ? Math.ceil(result.maxArrivalS / 300) * 300 : 0
  const player = useSimulationPlayer(maxS, 2.5 * 3600)

  const handleBase = (m: BaseMode) => {
    setBase(m)
    setLayers((l) => ({ ...l, terrain3d: m === 'terrain' }))
  }

  const handleLayers = (next: LayerVisibility) => {
    setLayers(next)
    if (next.terrain3d && base === 'satellite') setBase('terrain')
    if (!next.terrain3d && base === 'terrain') setBase('satellite')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4 lg:px-6 lg:pt-6">
        <PageHeader
          title="Hydrodynamic Flood Map"
          description="Interactive 3D terrain canvas with coupled Eulerian and SPH inundation depths, flow vectors, and arrival wavefronts."
          actions={
            <button
              onClick={() => setShowControls(!showControls)}
              className="glass-panel-subtle flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-[#dbdee1] hover:border-white/[0.16] hover:text-white transition-all cursor-pointer"
            >
              <Layers className="size-3.5 text-[#7983f5]" />
              {showControls ? 'Collapse HUD' : 'Expand HUD'}
            </button>
          }
        />
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4 lg:px-6 lg:pb-6">
        <div className="grid h-full gap-4 lg:grid-cols-12">
          <div className={`flex flex-col gap-3 ${showControls ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
            <div className="min-h-0 flex-1 rounded-xl border border-white/[0.08] overflow-hidden glass-panel">
              <SimulationView
                base={base}
                layers={layers}
                exaggeration={exaggeration}
                flood={result?.bands ?? null}
                timeS={player.timeS}
                className="h-full w-full"
              />
            </div>
            <TimeControls
              timeS={player.timeS}
              maxS={maxS}
              playing={player.playing}
              onToggle={player.toggle}
              onSeek={player.setTimeS}
              speed={player.speed}
              onSpeedChange={player.setSpeed}
            />
            {isPreview && <PreviewNotice />}
          </div>

          {showControls && (
            <div className="lg:col-span-3 space-y-3 overflow-y-auto">
              <Panel title="Base Map">
                <div className="flex gap-1.5 pt-1">
                  {(['terrain', 'satellite', 'dark'] as BaseMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleBase(m)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer ${
                        base === m
                          ? 'border-[#5865f2] bg-[#5865f2]/15 text-[#7983f5] shadow-[0_0_12px_rgba(88,101,242,0.2)]'
                          : 'border-white/[0.08] text-[#949ba4] hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Layer Visibility">
                <LayerControl
                  layers={layers}
                  onChange={handleLayers}
                  exaggeration={exaggeration}
                  onExaggerationChange={setExaggeration}
                />
              </Panel>

              <Panel title="Legend">
                <div className="space-y-2 pt-1">
                  <RampLegend kind="depth" className="w-full" />
                  <RampLegend kind="velocity" className="w-full" />
                  <RampLegend kind="arrival" className="w-full" />
                  <SymbolLegend className="w-full" />
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
