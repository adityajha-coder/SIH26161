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
  connected: { label: 'API Connected', dot: 'bg-[#23a55a]', shadow: 'shadow-[0_0_8px_rgba(35,165,90,0.6)]' },
  checking: { label: 'Checking API', dot: 'bg-[#f0b232]', shadow: 'shadow-[0_0_8px_rgba(240,178,50,0.6)]' },
  unreachable: { label: 'Preview Mode', dot: 'bg-[#f23f43]', shadow: 'shadow-[0_0_8px_rgba(242,63,67,0.6)]' },
  not_configured: { label: 'Preview Mode', dot: 'bg-[#f0b232]', shadow: 'shadow-[0_0_8px_rgba(240,178,50,0.6)]' },
} as const

export function TopBar() {
  const { activeScenario, activeRun, apiStatus } = usePlatform()
  const [open, setOpen] = useState(false)
  const status = STATUS_COPY[apiStatus]

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.06] bg-[#0c0f17]/75 backdrop-blur-md px-4 lg:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden text-[#949ba4] hover:text-white" aria-label="Open navigation" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-[#090c13] p-0 border-r border-white/[0.06]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-white flex items-center gap-2">
          {activeScenario?.name ?? 'No scenario selected'}
          {activeScenario?.type && (
            <span className="text-xs font-normal text-[#949ba4] font-mono">
              ({String(activeScenario.type).replace('_', ' ')})
            </span>
          )}
        </p>
      </div>

      <dl className="hidden items-center gap-5 font-mono text-xs text-[#949ba4] xl:flex">
        <div className="flex items-center gap-1.5 glass-panel-subtle px-2.5 py-1 rounded-md">
          <dt className="text-[#80848e]">Scenario:</dt>
          <dd className="text-white font-medium">{activeScenario?.id ?? '—'}</dd>
        </div>
        <div className="flex items-center gap-1.5 glass-panel-subtle px-2.5 py-1 rounded-md">
          <dt className="text-[#80848e]">Solver:</dt>
          <dd className="text-[#7983f5] font-medium">
            {activeRun && SOLVERS[activeRun.solver]
              ? `${SOLVERS[activeRun.solver].name} ${SOLVERS[activeRun.solver].version}`
              : 'Eulerian + SPH'}
          </dd>
        </div>
        <div className="flex items-center gap-1.5 glass-panel-subtle px-2.5 py-1 rounded-md">
          <dt className="text-[#80848e]">CRS:</dt>
          <dd className="text-white font-medium">EPSG:32644</dd>
        </div>
      </dl>

      <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-[#dbdee1] backdrop-blur-sm">
        <span className={cn('size-2 rounded-full', status.dot, status.shadow)} aria-hidden="true" />
        <span className="font-medium text-xs">{status.label}</span>
      </div>
    </header>
  )
}
