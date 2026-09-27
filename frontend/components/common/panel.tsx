import { cn } from '@/lib/utils'

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = 'section',
}: {
  title?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  as?: 'section' | 'div' | 'article'
}) {
  return (
    <Tag className={cn('glass-panel flex min-h-0 flex-col rounded-xl overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 border-b border-white/[0.05]">
          {title && (
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#5865f2]" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </Tag>
  )
}

export function StatTile({
  label,
  value,
  unit,
  tone = 'default',
  hint,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  tone?: 'default' | 'danger' | 'warning' | 'success' | 'discord'
  hint?: string
}) {
  return (
    <div className="glass-panel-subtle rounded-lg p-3 transition-colors hover:border-white/[0.12]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-xl font-bold tracking-tight tabular-nums',
          tone === 'danger' && 'text-[#f23f43]',
          tone === 'warning' && 'text-[#f0b232]',
          tone === 'success' && 'text-[#23a55a]',
          tone === 'discord' && 'text-[#7983f5]',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground text-balance flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-[#5865f2] shadow-[0_0_8px_rgba(88,101,242,0.8)]" aria-hidden="true" />
          {title}
        </h1>
        {description && <p className="mt-1 max-w-3xl text-xs sm:text-sm text-muted-foreground text-pretty leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PreviewNotice({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('glass-panel-subtle flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs text-muted-foreground', className)}>
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#f0b232] shadow-[0_0_6px_rgba(240,178,50,0.6)]" aria-hidden="true" />
      <span className="leading-relaxed">
        {children ??
          'Preview: geodata is real (OSM, DEM), flood layers come from an analytical Manning model until solver results are available from the API.'}
      </span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="glass-panel-subtle flex h-full min-h-48 flex-col items-center justify-center gap-2.5 rounded-xl border-dashed border-white/[0.1] p-8 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground text-pretty leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

