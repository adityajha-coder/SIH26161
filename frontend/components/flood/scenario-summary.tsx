import type { Scenario } from '@/lib/types'
import { SOLVERS } from '@/lib/types'
import { formatDischarge, formatDuration, formatNumber, formatVolumeMcm } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ScenarioSummary({ scenario, className }: { scenario: Scenario; className?: string }) {
  const cap = (s: string | undefined) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
  const rows: [string, string][] = [
    ['Scenario type', cap(scenario.type?.replace('_', ' '))],
    ['Failure mode', cap(scenario.failureMode)],
    ['Initial water level', `${formatNumber(scenario.initialWaterLevelM ?? 0)} m`],
    ['Released volume', formatVolumeMcm(scenario.reservoirVolumeM3 ?? 0)],
    ['Breach height', `${formatNumber(scenario.breachHeightM ?? 0)} m`],
    ['Avg. breach width', `${formatNumber(scenario.breachWidthM ?? 0)} m`],
    ['Formation time', formatDuration(scenario.formationTimeS ?? 0)],
    ['Peak outflow', formatDischarge(scenario.peakDischargeM3s ?? 0)],
    ["Manning's n", (scenario.manningN ?? 0).toFixed(3)],
    ['Horizon', formatDuration(scenario.simulationHorizonS ?? 0)],
    ['Solvers', scenario.solvers?.map((s) => SOLVERS[s]?.name ?? s).join(', ') ?? '—'],
    ['Mass balance error', `${(scenario.massBalanceErrorPct ?? 0).toFixed(3)} %`],
  ]
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 text-xs sm:grid-cols-2', className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2">
          <dt className="text-[#949ba4]">{k}</dt>
          <dd className="text-right font-mono tabular-nums text-white font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
