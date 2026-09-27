'use client'

import { usePathname } from 'next/navigation'
import { PlatformProvider } from '@/lib/platform-store'
import { SidebarNav } from './sidebar-nav'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMap = pathname === '/map'

  return (
    <PlatformProvider>
      <div className="fixed inset-0 h-full w-full overflow-hidden bg-[#0C0C0C] text-white">
        {/* Floating Side Navbar matching user reference image */}
        <SidebarNav />

        {/* Main Content Area */}
        <main
          className={cn(
            'h-full w-full',
            isMap
              ? 'p-0 overflow-hidden'
              : 'pl-20 pr-4 py-4 lg:py-6 overflow-y-auto'
          )}
        >
          {children}
        </main>
      </div>
    </PlatformProvider>
  )
}
