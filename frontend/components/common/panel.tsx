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
    <Tag className={cn('flex min-h-0 flex-col rounded-lg border border-border bg-card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 px-4 pb-4', !title && !actions && 'pt-4', bodyClassName)}>{children}</div>
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
  tone?: 'default' | 'danger' | 'warning' | 'success'
  hint?: string
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-mono text-xl font-semibold tabular-nums',
          tone === 'danger' && 'text-destructive',
          tone === 'warning' && 'text-warning',
          tone === 'success' && 'text-success',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
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
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-foreground text-balance">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PreviewNotice({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <p className={cn('flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground', className)}>
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
      <span>
        {children ??
          'Preview: geodata is real (OSM, DEM), flood layers come from an analytical Manning model until solver results are available from the API.'}
      </span>
    </p>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground text-pretty">{description}</p>}
      {action}
    </div>
  )
}
