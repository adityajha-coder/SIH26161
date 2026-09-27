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
    <div className={cn('glass-panel-subtle w-full rounded-xl border border-white/[0.08] px-3 py-2.5', className)}>
      <p className="mb-1.5 text-xs font-semibold text-white">
        {r.title} <span className="font-normal text-[#949ba4]">({r.unit})</span>
      </p>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: gradient(r.stops) }} aria-hidden="true" />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[#949ba4]">
        <span>{r.fmt(first)}</span>
        <span>{r.fmt(Math.round((first + last) / 2))}</span>
        <span>{r.fmt(last)}+</span>
      </div>
    </div>
  )
}

export function SymbolLegend({ className }: { className?: string }) {
  const items = [
    { label: 'Inundated extent', swatch: <span className="size-2.5 rounded-sm bg-[#f23f43]/85" /> },
    { label: 'Settlements', swatch: <span className="size-2.5 rounded-full border border-white bg-[#f0b232]" /> },
    { label: 'Healthcare units', swatch: <span className="size-2.5 rounded-full border border-white bg-[#f23f43]" /> },
    { label: 'Schools', swatch: <span className="size-2.5 rounded-full border border-white bg-[#5865f2]" /> },
    { label: 'Primary roads', swatch: <span className="h-0.5 w-3 bg-slate-300" /> },
  ]
  return (
    <ul className={cn('glass-panel-subtle space-y-1.5 rounded-xl border border-white/[0.08] px-3 py-2.5', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2.5 text-xs text-[#dbdee1]">
          <span className="flex w-3 justify-center" aria-hidden="true">
            {i.swatch}
          </span>
          {i.label}
        </li>
      ))}
    </ul>
  )
}
