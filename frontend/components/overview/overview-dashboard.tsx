'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Panel, PreviewNotice } from '@/components/common/panel'
import { TerrainViews } from '@/components/flood/terrain-views'
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
import { formatDischarge } from '@/lib/format'

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
    <div className="space-y-3 p-3 lg:p-4">
      <div className="grid gap-3 lg:grid-cols-2 2xl:h-[min(620px,calc(100dvh-7rem))] 2xl:grid-cols-[1fr_1.5fr_0.8fr_1.25fr]">
        <Panel title="Different Terrain Views" className="h-[420px] 2xl:h-auto">
          <TerrainViews value={base} onChange={handleBase} />
        </Panel>

        <Panel title="Simulation Animation" className="h-[520px] lg:col-span-2 2xl:col-span-1 2xl:h-auto" bodyClassName="flex flex-col gap-2">
          <SimulationView
            base={base}
            layers={layers}
            exaggeration={exaggeration}
            flood={result?.bands ?? null}
            timeS={player.timeS}
            className="min-h-0 flex-1"
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
        </Panel>

        <Panel title="Layer Control" className="2xl:h-auto">
          <LayerControl layers={layers} onChange={handleLayers} exaggeration={exaggeration} onExaggerationChange={setExaggeration} />
        </Panel>

        <Panel title="Impact Analysis" className="h-[560px] 2xl:h-auto">
          <ImpactPanel flood={result?.bands ?? null} impact={impact} />
        </Panel>
      </div>

      {isPreview && <PreviewNotice className="px-1" />}

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel
          title="Scenario"
          actions={
            <Link href="/scenario" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Edit <ArrowRight className="size-3" />
            </Link>
          }
        >
          {activeScenario ? <ScenarioSummary scenario={activeScenario} /> : <p className="text-xs text-muted-foreground">No scenario</p>}
        </Panel>
        <Panel
          title="Breach Hydrograph Q(t)"
          actions={
            hydro && (
              <span className="font-mono text-[11px] text-muted-foreground">Peak {formatDischarge(hydro.base.peakDischargeM3s)}</span>
            )
          }
        >
          {hydro && <HydrographChart base={hydro.base} low={hydro.low} high={hydro.high} className="h-56" />}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Froehlich breach parameters · low/base/high envelope · mass balance{' '}
            <span className={hydro?.base.massBalancePass ? 'text-success' : 'text-destructive'}>
              {hydro?.base.massBalancePass ? 'passed' : 'failed'}
            </span>
          </p>
        </Panel>
        <Panel title="Wave Arrival at Downstream Towns">
          <ArrivalTable result={result} />
        </Panel>
      </div>
    </div>
  )
}
