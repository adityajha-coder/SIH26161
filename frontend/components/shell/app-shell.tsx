'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { PlatformProvider } from '@/lib/platform-store'
import { SidebarNav } from './sidebar-nav'
import { MapPage } from '@/components/map/map-page'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMap = pathname === '/map'
  const [hasVisitedMap, setHasVisitedMap] = useState(isMap)

  useEffect(() => {
    if (isMap) {
      setHasVisitedMap(true)
    }
  }, [isMap])

  return (
    <PlatformProvider>
      <div className="fixed inset-0 h-full w-full overflow-hidden bg-[#0C0C0C] text-white">
        {/* Floating Side Navbar */}
        <SidebarNav />

        {/* Persistent 3D Flood Map: Stays warm in memory across all route switches */}
        <div
          aria-hidden={!isMap}
          className={cn(
            'fixed inset-0 z-0 h-full w-full',
            isMap
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          )}
          style={{
            visibility: isMap ? 'visible' : 'hidden',
          }}
        >
          {hasVisitedMap && <MapPage />}
        </div>

        {/* Main Content Area */}
        <main
          className={cn(
            'h-full w-full relative z-10',
            isMap
              ? 'p-0 overflow-hidden pointer-events-none'
              : 'pl-20 pr-4 py-4 lg:py-6 overflow-y-auto pointer-events-auto'
          )}
        >
          {children}
        </main>
      </div>
    </PlatformProvider>
  )
}
