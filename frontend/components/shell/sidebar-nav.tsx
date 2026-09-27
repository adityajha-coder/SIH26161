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
  PanelLeftClose,
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

export function SidebarNav({
  onNavigate,
  onCollapse,
}: {
  onNavigate?: () => void
  onCollapse?: () => void
}) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col bg-[#090c13] text-white">
      {/* Brand Header with Hide Button */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.08] px-4">
        <div className="flex items-center gap-3">
          <div className="relative size-8 shrink-0 overflow-hidden rounded-lg border border-[#5865f2]/40 bg-[#5865f2]/10 shadow-[0_0_12px_rgba(88,101,242,0.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/jalrekha-logo.png"
              alt="Jalrekha Emblem"
              className="size-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white font-sans flex items-center gap-1.5">
              Jalrekha
              <span className="size-1.5 rounded-full bg-[#5865f2]" />
            </p>
            <p className="font-mono text-[10px] text-white/70">NTRO · SIH26161</p>
          </div>
        </div>

        {/* Hide Sidebar Button */}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Hide sidebar"
            className="flex size-7 items-center justify-center rounded-lg text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Primary" className="flex-1 space-y-6 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-2 text-xs font-semibold text-white/90">
              {group.label}
            </p>
            <ul className="space-y-1">
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
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150',
                        active
                          ? 'bg-[#5865f2]/20 text-white font-semibold border-l-2 border-[#5865f2] shadow-[0_0_12px_rgba(88,101,242,0.15)]'
                          : 'text-white/90 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0', active ? 'text-[#7983f5]' : 'text-white/80')} aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Station Footer */}
      <div className="border-t border-white/[0.08] p-3.5 text-xs leading-relaxed text-white bg-[#080a10]">
        <p className="font-semibold text-white flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[#23a55a]" />
          Tehri Dam · Bhagirathi
        </p>
        <p className="text-[11px] mt-0.5 text-white/70">Uttarakhand, India</p>
      </div>
    </div>
  )
}
