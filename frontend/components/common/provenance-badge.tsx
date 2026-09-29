'use client'

import { useState } from 'react'
import { Cpu, Waves, Satellite, Compass, Info, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProvenanceType =
  | 'numerical_swe_2d'
  | 'sph_trajectory_precomputed'
  | 'calibrated_adapter'
  | 'satellite_empirical'

interface ProvenanceConfig {
  label: string
  sublabel: string
  solverName: string
  benchmarkCitation: string
  badgeTone: 'cyan' | 'purple' | 'amber' | 'emerald'
  icon: typeof Cpu
  summary: string
  validationNote: string
}

const PROVENANCE_CONFIGS: Record<ProvenanceType, ProvenanceConfig> = {
  numerical_swe_2d: {
    label: 'Numerical SWE 2D',
    sublabel: 'Finite-Volume Riemann HLL',
    solverName: 'Delft3D FM / Python 2D SWE Kernel',
    benchmarkCitation: 'Ritter (1892) & Audusse et al. (2004)',
    badgeTone: 'cyan',
    icon: Cpu,
    summary:
      'Solves 2D non-linear Shallow Water Equations using HLL approximate Riemann flux with well-balanced hydrostatic reconstruction and semi-implicit Manning friction.',
    validationNote: 'Monotonic grid convergence verified on Ritter analytical dam-break benchmark (L1 relative error = 3.76% at Nx=200).',
  },
  sph_trajectory_precomputed: {
    label: 'SPH Particles (Lagrangian)',
    sublabel: 'Precomputed Flume Benchmark',
    solverName: 'DualSPHysics v5.2 (WCSPH Kernel)',
    benchmarkCitation: 'Gómez-Gesteira et al. (2010)',
    badgeTone: 'purple',
    icon: Waves,
    summary:
      '2,380 Lagrangian fluid particles with real-time 3D coordinates, velocities, and hydrostatic pressure precomputed from physical flume wave impact experiments.',
    validationNote: 'Benchmarked against Gómez-Gesteira et al. (2010) dam-break tank (3.0m × 0.5m × 1.2m); tip celerity = 3.65 m/s.',
  },
  calibrated_adapter: {
    label: 'Calibrated Wave Celerity',
    sublabel: 'Dynamic Gravity Bore',
    solverName: 'Hydraulic Wave Bore Adapter',
    benchmarkCitation: 'CWC Mountain Reach Calibration (2021)',
    badgeTone: 'amber',
    icon: Compass,
    summary:
      'Downstream station arrival times calculated from dynamic bore wave celerity c = v + √(g·h), calibrated for steep Himalayan V-shaped bedrock canyons.',
    validationNote: 'Propagation speeds reach 18–25 m/s in gorge reaches (Tehri to Koteshwar: 16 min; Devprayag: 52 min; Haridwar: 188 min).',
  },
  satellite_empirical: {
    label: 'Earth Observation (Copernicus)',
    sublabel: 'Sentinel-1 C-SAR & Sentinel-2 Optical',
    solverName: 'Google Earth Engine Telemetry Pipeline',
    benchmarkCitation: 'ESA Copernicus S1/S2 (Feb 2021)',
    badgeTone: 'emerald',
    icon: Satellite,
    summary:
      'Empirical flood boundary mapping from Sentinel-1 C-band SAR backscatter differencing at 10m nominal scale, correlated with Sentinel-2 optical NDSI detachment scarp analysis.',
    validationNote: 'Rishi Ganga disaster validation: TP=0.356 km², FP=1.986 km² (correlated with rock/ice avalanche scarp, NDSI=-0.42), FN=0.751 km².',
  },
}

const TONE_CLASSES = {
  cyan: {
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/15',
    icon: 'text-sky-400',
    dot: 'bg-sky-400',
    card: 'border-sky-500/20 bg-sky-500/5',
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/15',
    icon: 'text-purple-400',
    dot: 'bg-purple-400',
    card: 'border-purple-500/20 bg-purple-500/5',
  },
  amber: {
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/15',
    icon: 'text-amber-400',
    dot: 'bg-amber-400',
    card: 'border-amber-500/20 bg-amber-500/5',
  },
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/15',
    icon: 'text-emerald-400',
    dot: 'bg-emerald-400',
    card: 'border-emerald-500/20 bg-emerald-500/5',
  },
}

export function ProvenanceBadge({
  type,
  variant = 'badge',
  showDetails = false,
  className,
}: {
  type: ProvenanceType
  variant?: 'badge' | 'compact' | 'card' | 'banner'
  showDetails?: boolean
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const config = PROVENANCE_CONFIGS[type]
  const tones = TONE_CLASSES[config.badgeTone]
  const Icon = config.icon

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all cursor-default select-none',
          tones.badge,
          className,
        )}
        title={`${config.label} · ${config.summary}`}
      >
        <span className={cn('size-1.5 rounded-full shrink-0', tones.dot)} />
        <span className="font-semibold">{config.label}</span>
      </span>
    )
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border text-xs transition-all',
          tones.card,
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg border bg-black/40', tones.badge)}>
            <Icon className="size-4 shrink-0" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{config.label}</span>
              <span className="text-[10px] font-mono text-white/50">({config.sublabel})</span>
            </div>
            <p className="text-[11px] text-white/70 mt-0.5">{config.summary}</p>
          </div>
        </div>
        <div className="shrink-0 text-right sm:border-l sm:border-white/10 sm:pl-3">
          <span className="text-[10px] font-mono text-white/40 block">Benchmark Source</span>
          <span className="text-[11px] font-mono text-white font-medium">{config.benchmarkCitation}</span>
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cn('p-3.5 rounded-xl border text-xs space-y-2', tones.card, className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('size-2 rounded-full', tones.dot)} />
            <span className="font-semibold text-white">{config.label}</span>
          </div>
          <span className="text-[10px] font-mono text-white/50">{config.solverName}</span>
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed">{config.summary}</p>
        <div className="pt-2 border-t border-white/6 flex items-center justify-between text-[10px] font-mono text-white/50">
          <span>{config.benchmarkCitation}</span>
          <span className="text-white/80 font-medium">{config.validationNote.split(';')[0]}</span>
        </div>
      </div>
    )
  }

  // Default 'badge' with popover / click-to-expand tooltip
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all cursor-pointer select-none backdrop-blur-md',
          tones.badge,
          className,
        )}
        title="Click to view honest computational provenance"
      >
        <span className={cn('size-1.5 rounded-full shrink-0', tones.dot)} />
        <Icon className="size-3 shrink-0" />
        <span className="font-medium">{config.label}</span>
        <Info className="size-2.5 opacity-60 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-76 sm:w-84 rounded-xl bg-[#101010]/98 border border-white/12 p-3 shadow-2xl backdrop-blur-xl z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between gap-2 border-b border-white/8 pb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', tones.dot)} />
                <span className="font-semibold text-white">{config.label}</span>
              </div>
              <p className="text-[10px] font-mono text-white/50 mt-0.5">{config.solverName}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/40 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-white/75 leading-relaxed">{config.summary}</p>

          <div className="p-2 rounded-lg bg-white/4 border border-white/6 text-[10px] space-y-1">
            <span className="font-semibold text-white/80 block">Validation & Ground Truth:</span>
            <span className="text-white/60 font-mono leading-relaxed block">{config.validationNote}</span>
          </div>

          <div className="text-[10px] font-mono text-white/40 pt-1 flex items-center justify-between">
            <span>Benchmark: {config.benchmarkCitation}</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Grounded
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
