'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sliders, MapPin } from 'lucide-react'
import { Panel, PreviewNotice, StatTile } from '@/components/common/panel'
import { SimulationView } from '@/components/flood/simulation-view'
import { LayerControl } from '@/components/flood/layer-control'
import { ImpactPanel } from '@/components/flood/impact-panel'
import { TimeControls } from '@/components/flood/time-controls'
import { useSimulationPlayer } from '@/components/flood/use-player'
import { HydrographChart } from '@/components/flood/hydrograph-chart'
import { ArrivalTable } from '@/components/flood/arrival-table'
import { ScenarioSummary } from '@/components/flood/scenario-summary'
import { DEFAULT_LAYERS, type BaseMode, type LayerVisibility } from '@/components/map/map-style'
import { usePlatform } from '@/lib/platform-store'
import { useFloodResult, useImpact } from '@/lib/use-flood'
import { useScenarioHydrographs } from '@/lib/use-hydrograph'
import { formatDischarge, formatNumber, formatVolumeMcm } from '@/lib/format'

const TERRAIN_MODES: { mode: BaseMode; label: string }[] = [
  { mode: 'terrain', label: '3D Terrain' },
  { mode: 'satellite', label: 'Satellite' },
  { mode: 'hillshade', label: 'Hillshade' },
  { mode: 'contour', label: 'Contours' },
]

export function OverviewDashboard() {
  const { activeScenario, activeRun } = usePlatform()
  const [base, setBase] = useState<BaseMode>('terrain')
  const [layers, setLayers] = useState<LayerVisibility>({ ...DEFAULT_LAYERS, terrain3d: true, settlements: true })
  const [exaggeration, setExaggeration] = useState(1.5)
  const { result, isPreview } = useFloodResult(activeScenario, activeRun?.solver ?? 'delft3d', activeRun)
  const maxS = result ? Math.ceil(result.maxArrivalS / 300) * 300 : 0
  const player = useSimulationPlayer(maxS, 2.5 * 3600)
  const impact = useImpact(result)
  const hydro = useScenarioHydrographs(activeScenario)

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
    <div className="space-y-4 p-4 lg:p-6 max-w-[1700px] mx-auto">
      {/* Top telemetry stat bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Peak Discharge"
          value={hydro ? formatDischarge(hydro.base.peakDischargeM3s) : '14,320 m³/s'}
          unit=""
          tone="danger"
        />
        <StatTile
          label="Reservoir Storage"
          value={activeScenario ? formatVolumeMcm(activeScenario.reservoirVolumeM3) : '2,615 MCM'}
          unit=""
        />
        <StatTile
          label="Wave Arrival (Devprayag)"
          value="+00:45:00"
          unit=""
          tone="warning"
        />
        <StatTile
          label="Exposed Population"
          value={impact ? formatNumber(impact.populationKnown) : '142,000'}
          unit="residents"
        />
      </div>

      {/* Main Simulation Viewport and Layer Controls */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Primary 3D Simulation Panel */}
        <Panel
          title="Dynamic Simulation"
          className="h-[600px] lg:col-span-8 xl:col-span-9"
          bodyClassName="p-3 flex flex-col gap-3 h-[calc(100%-49px)]"
          actions={
            <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/30 p-1">
              {TERRAIN_MODES.map((tm) => (
                <button
                  key={tm.mode}
                  type="button"
                  onClick={() => handleBase(tm.mode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                    base === tm.mode
                      ? 'bg-[#5865f2] text-white shadow-[0_0_10px_rgba(88,101,242,0.35)]'
                      : 'text-[#949ba4] hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {tm.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="flex h-full flex-col gap-3 min-h-0">
            <SimulationView
              base={base}
              layers={layers}
              exaggeration={exaggeration}
              flood={result?.bands ?? null}
              timeS={player.timeS}
              className="flex-1 min-h-[440px] w-full rounded-xl overflow-hidden border border-white/[0.06]"
            />
            <TimeControls
              timeS={player.timeS}
              maxS={maxS}
              playing={player.playing}
              onToggle={player.toggle}
              onSeek={player.setTimeS}
              speed={player.speed}
              onSpeedChange={player.setSpeed}
            />
          </div>
        </Panel>

        {/* Companion Control Panel */}
        <Panel
          title="Layer Controls & Exaggeration"
          className="h-[600px] lg:col-span-4 xl:col-span-3 flex flex-col"
          bodyClassName="p-4 flex flex-col overflow-y-auto"
        >
          <LayerControl
            layers={layers}
            onChange={handleLayers}
            exaggeration={exaggeration}
            onExaggerationChange={setExaggeration}
          />
        </Panel>
      </div>

      {isPreview && <PreviewNotice />}

      {/* Analysis, Impact, and Wave Telemetry */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          title="Impact & Exposure"
          className="h-[520px] lg:col-span-4"
          bodyClassName="p-4 h-[calc(100%-49px)] overflow-hidden"
        >
          <ImpactPanel flood={result?.bands ?? null} impact={impact} />
        </Panel>

        <Panel
          title="Breach Hydrograph"
          className="h-[520px] lg:col-span-4 flex flex-col"
          bodyClassName="p-4 flex flex-col justify-between"
          actions={
            hydro && (
              <span className="font-mono text-xs font-semibold text-[#7983f5]">
                Peak {formatDischarge(hydro.base.peakDischargeM3s)}
              </span>
            )
          }
        >
          {hydro && <HydrographChart base={hydro.base} low={hydro.low} high={hydro.high} className="h-64 w-full" />}
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-[#949ba4]">
            <p className="font-medium text-[#dbdee1]">Froehlich (2008) Breach Envelope</p>
            <p className="mt-1">
              Mass balance error:{' '}
              <span className={hydro?.base.massBalancePass ? 'text-[#23a55a] font-semibold font-mono' : 'text-[#f23f43] font-semibold font-mono'}>
                {hydro?.base.massBalanceErrorPct.toFixed(3)}% ({hydro?.base.massBalancePass ? 'verified' : 'unbalanced'})
              </span>
            </p>
          </div>
        </Panel>

        <Panel
          title="Downstream Wave Arrival"
          className="h-[520px] lg:col-span-4 overflow-hidden"
          bodyClassName="p-4 overflow-y-auto"
        >
          <ArrivalTable result={result} />
        </Panel>
      </div>

      {/* Active Scenario Card */}
      <Panel
        title="Active Scenario Parameters"
        actions={
          <Link
            href="/scenario"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#7983f5] hover:text-[#5865f2] transition-colors"
          >
            Configure Scenario <ArrowRight className="size-3" />
          </Link>
        }
      >
        {activeScenario ? (
          <ScenarioSummary scenario={activeScenario} />
        ) : (
          <p className="text-xs text-muted-foreground">No active scenario configured</p>
        )}
      </Panel>
    </div>
  )
}
