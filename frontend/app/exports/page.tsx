'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Download,
  FileJson,
  FileText,
  Map as MapIcon,
  FileArchive,
  ChevronDown,
  Check,
} from 'lucide-react'
import { Panel, PageHeader } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS } from '@/lib/types'
import { api } from '@/lib/api'
import { CASES } from '@/lib/case-study'
import { cn } from '@/lib/utils'

const EXPORT_FORMATS = [
  {
    id: 'geojson' as const,
    name: 'GeoJSON Boundary & Grid',
    icon: FileJson,
    ext: '.geojson',
    mime: 'application/geo+json',
  },
  {
    id: 'kml' as const,
    name: 'Google Earth KML / KMZ',
    icon: MapIcon,
    ext: '.kml',
    mime: 'application/vnd.google-earth.kml+xml',
  },
  {
    id: 'shp' as const,
    name: 'ESRI Shapefile Archive',
    icon: FileArchive,
    ext: '.zip',
    mime: 'application/zip',
  },
  {
    id: 'report' as const,
    name: 'Executive Technical Dossier',
    icon: FileText,
    ext: '.md',
    mime: 'text/markdown',
  },
]

export default function ExportsPage() {
  const { activeRun, activeScenario, activeCase, activeCaseId, setActiveCaseId } = usePlatform()

  const [isDamMenuOpen, setIsDamMenuOpen] = useState(false)
  const damMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (damMenuRef.current && !damMenuRef.current.contains(event.target as Node)) {
        setIsDamMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const targetRunId = activeRun && activeRun.status === 'done' ? activeRun.id : `${activeCase.id}-simulation-run`
  const targetScenarioName = activeScenario?.name ?? `${activeCase.name} PMF Overtopping Analysis`
  const targetEngineName = activeRun ? `${SOLVERS[activeRun.solver].name} ${SOLVERS[activeRun.solver].version}` : 'Delft3D FM (D-Flow FM 2024.03)'

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="GIS & Hydrological Exports"
        actions={
          <div className="relative" ref={damMenuRef}>
            <button
              type="button"
              onClick={() => setIsDamMenuOpen((prev) => !prev)}
              aria-expanded={isDamMenuOpen}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/6 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer shadow-sm backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              <span className="font-semibold text-white">{activeCase.name}</span>
              <span className="text-[11px] text-white/50 hidden sm:inline">({activeCase.state})</span>
              <ChevronDown
                className={cn(
                  'size-3.5 text-white/50 transition-transform duration-200 shrink-0',
                  isDamMenuOpen && 'rotate-180 text-white'
                )}
              />
            </button>

            {isDamMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#121212]/98 border border-white/12 p-1.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                  Select Benchmark Dam
                </div>
                <div className="space-y-1">
                  {CASES.map((c) => {
                    const isSelected = c.id === activeCaseId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setActiveCaseId(c.id)
                          setIsDamMenuOpen(false)
                        }}
                        className={cn(
                          'w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-white/12 text-white border border-white/10'
                            : 'text-white/70 hover:bg-white/6 hover:text-white'
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-white truncate">{c.name}</p>
                          <p className="text-[11px] text-white/40 truncate">
                            {c.river} · {c.state}
                          </p>
                        </div>
                        {isSelected && <Check className="size-4 text-emerald-400 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        }
      />

      {/* Run Context */}
      <div className="glass-panel rounded-xl p-4">
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div className="glass-panel-subtle p-3 rounded-lg">
            <dt className="text-[#949ba4]">Scenario Target</dt>
            <dd className="mt-1 font-mono text-white font-semibold truncate">{targetScenarioName}</dd>
          </div>
          <div className="glass-panel-subtle p-3 rounded-lg">
            <dt className="text-[#949ba4]">Hydrodynamic Engine</dt>
            <dd className="mt-1 font-mono text-white font-semibold truncate">
              {targetEngineName}
            </dd>
          </div>
          <div className="glass-panel-subtle p-3 rounded-lg">
            <dt className="text-[#949ba4]">Spatial Reference</dt>
            <dd className="mt-1 font-mono text-white font-semibold">EPSG:4326 / EPSG:32644</dd>
          </div>
          <div
            onClick={() => setIsDamMenuOpen((prev) => !prev)}
            className="glass-panel-subtle p-3 rounded-lg cursor-pointer hover:border-white/20 transition-colors group"
          >
            <dt className="text-[#949ba4] flex items-center justify-between">
              <span>Target Dam</span>
              <span className="text-[10px] text-white/40 group-hover:text-white/70 transition-colors">Select ▼</span>
            </dt>
            <dd className="mt-1 font-mono text-white font-semibold truncate">
              {activeCase.name}
            </dd>
          </div>
        </dl>
      </div>

      {/* Export Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = fmt.icon
          const downloadUrl = api.exportUrl(targetRunId, fmt.id, activeCase.id)
          return (
            <Panel key={fmt.id}>
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/3 text-white">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{fmt.name}</h3>
                    <span className="font-mono text-xs font-bold text-white/90">{fmt.ext}</span>
                  </div>
                  <div className="mt-4">
                    <a
                      href={downloadUrl}
                      download
                      className="inline-flex items-center justify-center rounded-lg bg-white hover:bg-white/90 text-black px-3.5 h-8 text-xs font-semibold transition-all duration-150 cursor-pointer"
                    >
                      <Download className="mr-1.5 size-3.5" />
                      Download {fmt.name} ({fmt.ext})
                    </a>
                  </div>
                </div>
              </div>
            </Panel>
          )
        })}
      </div>

      {/* Metadata Notice */}
      <Panel title="Export Provenance Metadata">
        <p className="text-xs text-[#949ba4] leading-relaxed pt-1">
          Every exported dataset includes: target case study ({activeCase.name}, {activeCase.river}), solver identification and algorithm version, DEM origin (GLO-30 Copernicus DEM, EPSG:32644),
          simulation epoch timestamp, breach hydrograph derivation equations (Froehlich 2008), and mass-balance residual verification. ESRI shapefiles incorporate coordinate projection sidecars (.prj).
        </p>
      </Panel>
    </div>
  )
}
