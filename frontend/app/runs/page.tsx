'use client'

import { useState } from 'react'
import { Activity, Play, Square, Clock, CheckCircle2, XCircle, Loader2, Terminal } from 'lucide-react'
import { Panel, PageHeader, EmptyState } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS, RUN_PIPELINE, type SimulationRun, type RunStatus } from '@/lib/types'
import { formatDateTime, formatDuration, relativeAge } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock className="size-3.5 text-[#949ba4]" />,
  validating: <Loader2 className="size-3.5 text-[#f0b232] animate-spin" />,
  preparing: <Loader2 className="size-3.5 text-[#f0b232] animate-spin" />,
  running: <Loader2 className="size-3.5 text-white animate-spin" />,
  postprocessing: <Loader2 className="size-3.5 text-zinc-300 animate-spin" />,
  validating_output: <Loader2 className="size-3.5 text-zinc-300 animate-spin" />,
  done: <CheckCircle2 className="size-3.5 text-[#23a55a]" />,
  failed: <XCircle className="size-3.5 text-[#f23f43]" />,
  cancelled: <Square className="size-3.5 text-[#949ba4]" />,
}

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'Queued',
  validating: 'Validating',
  preparing: 'Preparing',
  running: 'Running',
  postprocessing: 'Post-processing',
  validating_output: 'Validating Output',
  done: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_COLOR: Record<RunStatus, string> = {
  queued: 'text-[#949ba4]',
  validating: 'text-[#f0b232]',
  preparing: 'text-[#f0b232]',
  running: 'text-white',
  postprocessing: 'text-zinc-300',
  validating_output: 'text-zinc-300',
  done: 'text-[#23a55a]',
  failed: 'text-[#f23f43]',
  cancelled: 'text-[#949ba4]',
}

export default function RunsPage() {
  const { runs, activeRun, setActiveRunId, activeScenario, submitRuns, cancelRun } = usePlatform()
  const [dispatching, setDispatching] = useState(false)

  const handleDispatch = async () => {
    if (!activeScenario) return
    setDispatching(true)
    try {
      await submitRuns(activeScenario.id, activeScenario.solvers)
    } finally {
      setDispatching(false)
    }
  }

  const scenarioRuns = runs.filter((r) => r.scenarioId === activeScenario?.id)

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Run Monitor"
        description="Track simulation jobs through the solver pipeline. Each run progresses through validation, preparation, execution, and post-processing stages."
        actions={
          <Button onClick={handleDispatch} disabled={dispatching || !activeScenario} size="sm">
            <Play className="mr-1.5 size-3.5" />
            {dispatching ? 'Dispatching...' : 'Dispatch Runs'}
          </Button>
        }
      />

      {scenarioRuns.length === 0 ? (
        <EmptyState
          title="No simulation runs yet"
          description="Create a scenario and dispatch solver jobs to observe real-time execution telemetry here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Run List */}
          <div className="lg:col-span-5 space-y-2.5">
            {scenarioRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setActiveRunId(run.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all duration-150 cursor-pointer',
                  run.id === activeRun?.id
                    ? 'border-white/40 bg-white/10 ring-1 ring-white/20'
                    : 'glass-panel hover:border-white/16 hover:bg-white/4',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {STATUS_ICON[run.status]}
                    <span className="text-sm font-semibold text-white">
                      {SOLVERS[run.solver].name}
                    </span>
                  </div>
                  <span className={cn('text-xs font-semibold font-mono', STATUS_COLOR[run.status])}>
                    {STATUS_LABEL[run.status]}
                  </span>
                </div>
                <div className="mt-3">
                  <Progress value={run.progress} className="h-1.5 bg-white/6" />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#949ba4] font-mono">
                  <span>{SOLVERS[run.solver].kind} · {SOLVERS[run.solver].version}</span>
                  <span className="text-white font-medium">{run.progress}%</span>
                </div>
              </button>
            ))}
          </div>

          {/* Run Detail */}
          <div className="lg:col-span-7 space-y-4">
            {activeRun ? (
              <>
                <Panel title="Pipeline Progress">
                  <div className="space-y-1.5 pt-1">
                    {RUN_PIPELINE.map((stage, i) => {
                      const stageIdx = RUN_PIPELINE.indexOf(activeRun.status)
                      const currentIdx = RUN_PIPELINE.indexOf(stage)
                      const isPast = currentIdx < stageIdx
                      const isCurrent = stage === activeRun.status
                      return (
                        <div
                          key={stage}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs transition-colors',
                            isPast && 'text-[#23a55a] bg-[#23a55a]/5',
                            isCurrent && 'bg-white/15 text-white font-semibold border-l-2 border-white',
                            !isPast && !isCurrent && 'text-[#949ba4] bg-white/2',
                          )}
                        >
                          <span className={cn(
                            'flex size-5 items-center justify-center rounded-full border text-[10px] font-mono',
                            isPast && 'border-[#23a55a] bg-[#23a55a]/20 text-[#23a55a]',
                            isCurrent && 'border-white bg-white text-black',
                            !isPast && !isCurrent && 'border-white/10 text-[#949ba4]',
                          )}>
                            {isPast ? '✓' : i + 1}
                          </span>
                          <span className="flex-1">{STATUS_LABEL[stage]}</span>
                          {isCurrent && (
                            <span className="font-mono text-[11px] text-white">Active Stage</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Panel>

                <Panel title="Run Details">
                  <dl className="grid grid-cols-2 gap-3 text-xs pt-1 sm:grid-cols-4">
                    <div className="glass-panel-subtle p-2.5 rounded-lg">
                      <dt className="text-[#949ba4]">Run ID</dt>
                      <dd className="font-mono text-white mt-1 font-semibold truncate">{activeRun.id}</dd>
                    </div>
                    <div className="glass-panel-subtle p-2.5 rounded-lg">
                      <dt className="text-[#949ba4]">Solver</dt>
                      <dd className="font-mono text-white mt-1 font-semibold truncate">{SOLVERS[activeRun.solver].name}</dd>
                    </div>
                    <div className="glass-panel-subtle p-2.5 rounded-lg">
                      <dt className="text-[#949ba4]">Started</dt>
                      <dd className="font-mono text-white mt-1 font-semibold truncate">{formatDateTime(activeRun.startedAt)}</dd>
                    </div>
                    <div className="glass-panel-subtle p-2.5 rounded-lg">
                      <dt className="text-[#949ba4]">Status</dt>
                      <dd className={cn('font-mono mt-1 font-semibold truncate', STATUS_COLOR[activeRun.status])}>
                        {STATUS_LABEL[activeRun.status]}
                      </dd>
                    </div>
                    {activeRun.preview && (
                      <div className="col-span-2 sm:col-span-4 glass-panel-subtle p-2.5 rounded-lg flex items-center gap-2 text-xs text-[#f0b232]">
                        <span className="size-1.5 rounded-full bg-[#f0b232]" />
                        Preview mode: simulated output derived from analytical hydrodynamic envelope.
                      </div>
                    )}
                  </dl>
                </Panel>

                <Panel title="Execution Log" className="h-65" bodyClassName="p-0">
                  <div className="h-full overflow-y-auto bg-[#080808] p-3.5 font-mono text-[11px] leading-relaxed">
                    {activeRun.logs.length === 0 ? (
                      <p className="text-[#949ba4]">No log entries recorded yet.</p>
                    ) : (
                      activeRun.logs.map((entry, i) => (
                        <div key={i} className="flex gap-2.5 py-0.5 hover:bg-white/2 px-1 rounded">
                          <span className="shrink-0 text-[#949ba4]">{new Date(entry.at).toLocaleTimeString('en-IN', { hour12: false })}</span>
                          <span className={cn(
                            'shrink-0 font-semibold w-12',
                            entry.level === 'info' && 'text-zinc-300',
                            entry.level === 'warn' && 'text-[#f0b232]',
                            entry.level === 'error' && 'text-[#f23f43]',
                          )}>
                            [{entry.level.toUpperCase()}]
                          </span>
                          <span className="text-[#dbdee1]">{entry.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>

                {activeRun.status !== 'done' && activeRun.status !== 'failed' && activeRun.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    onClick={() => cancelRun(activeRun.id)}
                    className="w-full border-[#f23f43]/30 text-[#f23f43] hover:bg-[#f23f43]/10"
                  >
                    <Square className="mr-2 size-3.5" />
                    Cancel Run
                  </Button>
                )}
              </>
            ) : (
              <EmptyState title="Select a run" description="Click on a run from the list to view its pipeline telemetry and logs." />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
