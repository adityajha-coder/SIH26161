'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SidebarNav } from './sidebar-nav'

const STATUS_COPY = {
  connected: { label: 'API connected', dot: 'bg-success' },
  checking: { label: 'Checking API', dot: 'bg-warning' },
  unreachable: { label: 'API unreachable · preview mode', dot: 'bg-destructive' },
  not_configured: { label: 'Preview mode · API not configured', dot: 'bg-warning' },
} as const

export function TopBar() {
  const { activeScenario, activeRun, apiStatus } = usePlatform()
  const [open, setOpen] = useState(false)
  const status = STATUS_COPY[apiStatus]

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/40 px-3 lg:px-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {activeScenario?.name ?? 'No scenario selected'}
        </p>
      </div>

      <dl className="hidden items-center gap-5 font-mono text-[11px] text-muted-foreground xl:flex">
        <div className="flex gap-1.5">
          <dt>Scenario</dt>
          <dd className="text-foreground">{activeScenario?.id ?? '—'}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Solver</dt>
          <dd className="text-foreground">
            {activeRun ? `${SOLVERS[activeRun.solver].name} ${SOLVERS[activeRun.solver].version}` : '—'}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>DEM</dt>
          <dd className="text-foreground">GLO-30 · 30 m · EPSG:32644</dd>
        </div>
      </dl>

      <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
        <span className="hidden sm:inline">{status.label}</span>
        <span className="sr-only sm:hidden">{status.label}</span>
      </div>
    </header>
  )
}
