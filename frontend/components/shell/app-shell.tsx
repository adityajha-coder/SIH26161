import { PlatformProvider } from '@/lib/platform-store'
import { SidebarNav } from './sidebar-nav'
import { TopBar } from './top-bar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
          <SidebarNav />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </PlatformProvider>
  )
}
