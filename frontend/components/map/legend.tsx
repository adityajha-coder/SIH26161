import { cn } from '@/lib/utils'
import { ARRIVAL_STOPS, DEPTH_STOPS, VELOCITY_STOPS } from './map-style'

function gradient(stops: [number, string][]) {
  const max = stops[stops.length - 1][0]
  return `linear-gradient(to right, ${stops.map(([v, c]) => `${c} ${(v / max) * 100}%`).join(', ')})`
}

const RAMPS = {
  depth: { title: 'Flood depth', stops: DEPTH_STOPS, unit: 'm', fmt: (v: number) => String(v) },
  velocity: { title: 'Velocity', stops: VELOCITY_STOPS, unit: 'm/s', fmt: (v: number) => String(v) },
  arrival: { title: 'Arrival time', stops: ARRIVAL_STOPS, unit: 'h', fmt: (v: number) => String(v / 3600) },
}

export function RampLegend({ kind, className }: { kind: keyof typeof RAMPS; className?: string }) {
  const r = RAMPS[kind]
  const first = r.stops[0][0]
  const last = r.stops[r.stops.length - 1][0]
  return (
    <div className={cn('w-44 rounded-md border border-border bg-background/90 px-2.5 py-2', className)}>
      <p className="mb-1 text-[11px] font-medium text-foreground">
        {r.title} <span className="font-normal text-muted-foreground">({r.unit})</span>
      </p>
      <div className="h-2 rounded-sm" style={{ background: gradient(r.stops) }} aria-hidden="true" />
      <div className="mt-0.5 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{r.fmt(first)}</span>
        <span>{r.fmt(Math.round((first + last) / 2))}</span>
        <span>{r.fmt(last)}+</span>
      </div>
    </div>
  )
}

export function SymbolLegend({ className }: { className?: string }) {
  const items = [
    { label: 'Inundated area', swatch: <span className="size-3 rounded-sm bg-[#dc2626]/80" /> },
    { label: 'Villages', swatch: <span className="size-3 rounded-full border-2 border-white bg-[#f59e0b]" /> },
    { label: 'Hospitals', swatch: <span className="size-3 rounded-full border-2 border-white bg-[#ef4444]" /> },
    { label: 'Schools', swatch: <span className="size-3 rounded-full border-2 border-white bg-[#3b82f6]" /> },
    { label: 'Roads', swatch: <span className="h-0.5 w-3 bg-slate-200" /> },
  ]
  return (
    <ul className={cn('space-y-1 rounded-md border border-border bg-background/90 px-2.5 py-2', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-[11px] text-foreground">
          <span className="flex w-3 justify-center" aria-hidden="true">
            {i.swatch}
          </span>
          {i.label}
        </li>
      ))}
    </ul>
  )
}
