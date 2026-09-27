'use client'

import { useState } from 'react'
import { Menu, PanelLeft } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { cn } from '@/lib/utils'
import { SidebarNav } from './sidebar-nav'

const STATUS_COPY = {
  connected: { label: 'Connected', dot: 'bg-[#23a55a]', shadow: 'shadow-[0_0_8px_rgba(35,165,90,0.6)]' },
  checking: { label: 'Checking', dot: 'bg-[#f0b232]', shadow: 'shadow-[0_0_8px_rgba(240,178,50,0.6)]' },
  unreachable: { label: 'Offline / Preview', dot: 'bg-[#f23f43]', shadow: 'shadow-[0_0_8px_rgba(242,63,67,0.6)]' },
  not_configured: { label: 'Preview Mode', dot: 'bg-[#f0b232]', shadow: 'shadow-[0_0_8px_rgba(240,178,50,0.6)]' },
} as const

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}) {
  const { activeScenario, apiStatus } = usePlatform()
  const [open, setOpen] = useState(false)
  const status = STATUS_COPY[apiStatus]

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0c0f17]/85 backdrop-blur-md px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-white/[0.08]" aria-label="Open navigation" />}>
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-[#090c13] p-0 border-r border-white/[0.08]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Desktop show sidebar button when collapsed */}
        {onToggleSidebar && !sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Show sidebar"
            className="hidden lg:flex size-8 items-center justify-center rounded-lg text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <PanelLeft className="size-4.5" />
          </button>
        )}

        {/* Clear, focused header title */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <span>{activeScenario?.name ?? 'Tehri Dam Simulation Platform'}</span>
            {activeScenario?.type && (
              <span className="text-xs font-normal text-white/70 font-mono">
                · {String(activeScenario.type).replace('_', ' ')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Clean status indicator on the right */}
      <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white backdrop-blur-sm">
        <span className={cn('size-2 rounded-full', status.dot, status.shadow)} aria-hidden="true" />
        <span className="font-medium text-xs text-white">{status.label}</span>
      </div>
    </header>
  )
}
