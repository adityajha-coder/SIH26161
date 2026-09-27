'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Download,
  GitCompare,
  LayoutDashboard,
  Map,
  Mountain,
  Satellite,
  ShieldAlert,
  SlidersHorizontal,
  Waves,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/case', label: 'Case Study', icon: Mountain },
      { href: '/scenario', label: 'Scenario Builder', icon: SlidersHorizontal },
      { href: '/runs', label: 'Run Monitor', icon: Activity },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/map', label: 'Flood Map', icon: Map },
      { href: '/compare', label: 'Compare & Validate', icon: GitCompare },
      { href: '/impact', label: 'Impact', icon: ShieldAlert },
      { href: '/observations', label: 'Live Observation', icon: Satellite },
      { href: '/exports', label: 'Export', icon: Download },
    ],
  },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="relative size-7 shrink-0 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/jalrekha-logo.png"
            alt="Jalrekha Emblem"
            className="size-full object-cover"
          />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-foreground font-sans">Jalrekha</p>
          <p className="font-mono text-[10px] text-muted-foreground">NTRO · SIH26161</p>
        </div>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3 text-[11px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-sidebar-foreground">Tehri Dam · Bhagirathi</p>
        <p>Uttarakhand, India</p>
      </div>
    </div>
  )
}
