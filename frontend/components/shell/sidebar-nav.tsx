'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Map,
  LayoutDashboard,
  ShieldAlert,
  GitCompare,
  Satellite,
  SlidersHorizontal,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const NAV_ITEMS = [
  { href: '/map', label: 'Flood Map & 3D Simulation', icon: Map },
  { href: '/', label: 'Digital Twin Studio & Scenario Engine', icon: LayoutDashboard },
  { href: '/impact', label: 'Downstream Impact & Vulnerability', icon: ShieldAlert },
  { href: '/compare', label: 'Cross-Solver Validation', icon: GitCompare },
  { href: '/observations', label: 'Satellite Earth Observation', icon: Satellite },
  { href: '/exports', label: 'GIS Package Export', icon: Download },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Side Navigation"
      className="fixed left-3.5 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0C0C0C]/90 backdrop-blur-2xl p-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.85)]"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <div key={item.href} className="relative group">
            <Link
              href={item.href}
              aria-label={item.label}
              className={cn(
                'flex size-10 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer',
                active
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              )}
            >
              <Icon className="size-4.5" />
            </Link>

            {/* Hover Tooltip */}
            <div className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#121214]/95 px-2.5 py-1 text-xs font-medium text-white shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              {item.label}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
