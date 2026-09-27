'use client'

import { useState } from 'react'
import { PlatformProvider } from '@/lib/platform-store'
import { SidebarNav } from './sidebar-nav'
import { TopBar } from './top-bar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <PlatformProvider>
      <div className="flex h-screen min-h-screen w-full overflow-hidden bg-background">
        <aside
          className={`shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out h-full ${
            sidebarOpen ? 'w-60' : 'w-0 border-r-0'
          } hidden lg:flex lg:flex-col overflow-hidden`}
        >
          <div className="w-60 h-full flex flex-col">
            <SidebarNav onCollapse={() => setSidebarOpen(false)} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
          <TopBar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </PlatformProvider>
  )
}
