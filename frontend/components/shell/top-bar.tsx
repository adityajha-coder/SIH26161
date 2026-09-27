'use client'

import { useState } from 'react'
import { Menu, PanelLeft } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { SidebarNav } from './sidebar-nav'

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}) {
  const { activeScenario } = usePlatform()
  const [open, setOpen] = useState(false)

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
    </header>
  )
}
