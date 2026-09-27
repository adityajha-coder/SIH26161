'use client'

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { Hydrograph } from '@/lib/breach'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

const config = {
  base: { label: 'Base Q(t)', color: 'var(--chart-1)' },
  low: { label: 'Low', color: 'var(--chart-2)' },
  high: { label: 'High', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function HydrographChart({
  base,
  low,
  high,
  className,
}: {
  base: Hydrograph
  low?: Hydrograph
  high?: Hydrograph
  className?: string
}) {
  const data = base.points.map((p, i) => ({
    h: +(p.t / 3600).toFixed(2),
    base: Math.round(p.q),
    low: low ? Math.round(low.points[i]?.q ?? 0) : undefined,
    high: high ? Math.round(high.points[i]?.q ?? 0) : undefined,
  }))

  return (
    <ChartContainer config={config} className={cn('aspect-auto h-48 w-full', className)}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="hydroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#ffffff" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="h" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} minTickGap={24} tick={{ fill: '#949ba4', fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#949ba4', fontSize: 11 }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => `t = ${p?.[0]?.payload?.h ?? ''} h`}
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                  <span className="font-mono text-white font-semibold">{Number(value).toLocaleString('en-IN')} m³/s</span>
                </div>
              )}
            />
          }
        />
        <Area dataKey="base" type="monotone" stroke="#ffffff" fill="url(#hydroFill)" strokeWidth={2.5} />
        {low && <Line dataKey="low" type="monotone" stroke="#a1a1aa" strokeDasharray="4 3" dot={false} strokeWidth={1.5} />}
        {high && <Line dataKey="high" type="monotone" stroke="#f0b232" strokeDasharray="4 3" dot={false} strokeWidth={1.5} />}
      </AreaChart>
    </ChartContainer>
  )
}
