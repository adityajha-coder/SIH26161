'use client'

import { useState } from 'react'
import { Activity, Play, Square, Clock, CheckCircle2, XCircle, Loader2, Terminal } from 'lucide-react'
import { Panel, PageHeader, EmptyState } from '@/components/common/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS, RUN_PIPELINE, type SimulationRun, type RunStatus } from '@/lib/types'
import { formatDateTime, formatDuration, relativeAge } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock className="size-3.5 text-muted-foreground" />,
  validating: <Loader2 className="size-3.5 text-warning animate-spin" />,
  preparing: <Loader2 className="size-3.5 text-warning animate-spin" />,
  running: <Loader2 className="size-3.5 text-primary animate-spin" />,
  postprocessing: <Loader2 className="size-3.5 text-primary animate-spin" />,
  validating_output: <Loader2 className="size-3.5 text-primary animate-spin" />,
  done: <CheckCircle2 className="size-3.5 text-success" />,
  failed: <XCircle className="size-3.5 text-destructive" />,
  cancelled: <Square className="size-3.5 text-muted-foreground" />,
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
          title="No runs yet"
          description="Create a scenario and dispatch solver runs to see them tracked here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Run List */}
          <div className="lg:col-span-5 space-y-2">
            {scenarioRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setActiveRunId(run.id)}
                className={cn(
                  'w-full text-left rounded-lg border p-4 transition-colors cursor-pointer',
                  run.id === activeRun?.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-border',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {STATUS_ICON[run.status]}
                    <span className="text-sm font-semibold text-foreground">
                      {SOLVERS[run.solver].name}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-mono',
                      run.status === 'done' && 'border-success/30 text-success',
                      run.status === 'failed' && 'border-destructive/30 text-destructive',
                      run.status === 'running' && 'border-primary/30 text-primary',
                    )}
                  >
                    {STATUS_LABEL[run.status]}
                  </Badge>
                </div>
                <div className="mt-2">
                  <Progress value={run.progress} className="h-1" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{SOLVERS[run.solver].kind} · {SOLVERS[run.solver].version}</span>
                  <span>{run.progress}%</span>
                </div>
              </button>
            ))}
          </div>

          {/* Run Detail */}
          <div className="lg:col-span-7 space-y-4">
            {activeRun ? (
              <>
                <Panel title="Pipeline Progress">
                  <div className="space-y-1 pt-1">
                    {RUN_PIPELINE.map((stage, i) => {
                      const stageIdx = RUN_PIPELINE.indexOf(activeRun.status)
                      const currentIdx = RUN_PIPELINE.indexOf(stage)
                      const isPast = currentIdx < stageIdx
                      const isCurrent = stage === activeRun.status
                      return (
                        <div
                          key={stage}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-xs',
                            isPast && 'text-success',
                            isCurrent && 'bg-primary/5 text-primary font-semibold',
                            !isPast && !isCurrent && 'text-muted-foreground',
                          )}
                        >
                          <span className={cn(
                            'flex size-5 items-center justify-center rounded-full border text-[10px] font-mono',
                            isPast && 'border-success bg-success/10',
                            isCurrent && 'border-primary bg-primary/10',
                            !isPast && !isCurrent && 'border-border',
                          )}>
                            {isPast ? '✓' : i + 1}
                          </span>
                          {STATUS_LABEL[stage]}
                        </div>
                      )
                    })}
                  </div>
                </Panel>

                <Panel title="Run Details">
                  <dl className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <dt className="text-muted-foreground">Run ID</dt>
                      <dd className="font-mono text-foreground mt-0.5">{activeRun.id}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Solver</dt>
                      <dd className="font-mono text-foreground mt-0.5">{SOLVERS[activeRun.solver].name} {SOLVERS[activeRun.solver].version}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Created</dt>
                      <dd className="font-mono text-foreground mt-0.5">{formatDateTime(activeRun.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Started</dt>
                      <dd className="font-mono text-foreground mt-0.5">{formatDateTime(activeRun.startedAt)}</dd>
                    </div>
                    {activeRun.finishedAt && (
                      <div>
                        <dt className="text-muted-foreground">Finished</dt>
                        <dd className="font-mono text-foreground mt-0.5">{formatDateTime(activeRun.finishedAt)}</dd>
                      </div>
                    )}
                    {activeRun.preview && (
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                          Preview mode — solver not executed
                        </Badge>
                      </div>
                    )}
                  </dl>
                </Panel>

                <Panel title="Execution Log" className="h-[240px]">
                  <div className="h-full overflow-y-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
                    {activeRun.logs.length === 0 ? (
                      <p className="text-muted-foreground">No log entries</p>
                    ) : (
                      activeRun.logs.map((entry, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">{new Date(entry.at).toLocaleTimeString('en-IN', { hour12: false })}</span>
                          <span className={cn(
                            'shrink-0 uppercase w-10',
                            entry.level === 'info' && 'text-muted-foreground',
                            entry.level === 'warn' && 'text-warning',
                            entry.level === 'error' && 'text-destructive',
                          )}>
                            {entry.level}
                          </span>
                          <span className="text-foreground">{entry.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>

                {activeRun.status !== 'done' && activeRun.status !== 'failed' && activeRun.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    onClick={() => cancelRun(activeRun.id)}
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                  >
                    <Square className="mr-2 size-3.5" />
                    Cancel Run
                  </Button>
                )}
              </>
            ) : (
              <EmptyState title="Select a run" description="Click on a run from the list to view its details." />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
