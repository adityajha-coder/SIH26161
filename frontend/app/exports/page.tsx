'use client'

import { useState } from 'react'
import { Download, FileJson, FileText, Map as MapIcon, FileArchive, CheckCircle2, Waves, Building2 } from 'lucide-react'
import { Panel, PageHeader } from '@/components/common/panel'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS } from '@/lib/types'
import { api } from '@/lib/api'
import { TEHRI, SARDAR_SAROVAR, BHAKRA, IDUKKI, type CaseStudy } from '@/lib/case-study'
import { cn } from '@/lib/utils'

const CASE_STUDIES: CaseStudy[] = [TEHRI, SARDAR_SAROVAR, BHAKRA, IDUKKI]

const EXPORT_FORMATS = [
  {
    id: 'shp' as const,
    name: 'ESRI Shapefile Archive',
    description: 'Standard multi-file bundle (.shp, .shx, .dbf, .prj) projected to WGS 84 (EPSG:4326) / UTM for ArcGIS and QGIS analysis.',
    icon: FileArchive,
    ext: '.zip',
    mime: 'application/zip',
    primary: true,
  },
  {
    id: 'kml' as const,
    name: 'Google Earth KML / KMZ',
    description: 'Vector flood perimeter and downstream impact settlement placemarks formatted for Google Earth 3D inspection.',
    icon: MapIcon,
    ext: '.kml',
    mime: 'application/vnd.google-earth.kml+xml',
    primary: true,
  },
  {
    id: 'geojson' as const,
    name: 'GeoJSON Boundary & Feature Grid',
    description: 'High-resolution flood extent polygon with maximum depth, velocity vectors, and wavefront arrival time attributes.',
    icon: FileJson,
    ext: '.geojson',
    mime: 'application/geo+json',
    primary: false,
  },
  {
    id: 'report' as const,
    name: 'Executive Technical Dossier',
    description: 'Comprehensive hydrological assessment report containing scenario parameters, mass balance verification, and exposure tables.',
    icon: FileText,
    ext: '.md',
    mime: 'text/markdown',
    primary: false,
  },
]

export default function ExportsPage() {
  const { activeRun, activeScenario } = usePlatform()
  
  // Default to scenario case if active, otherwise Tehri
  const initialCaseId = (activeScenario as any)?.caseId || (activeScenario as any)?.case_id || TEHRI.id
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId)

  const selectedCase = CASE_STUDIES.find((c) => c.id === selectedCaseId) ?? TEHRI
  const targetRunId = (activeRun && activeRun.status === 'done') ? activeRun.id : `${selectedCase.id}-simulation-run`
  const targetScenarioName = activeScenario?.name ?? `${selectedCase.name} Dam Break & Inundation Analysis`
  const targetEngineName = activeRun ? `${SOLVERS[activeRun.solver].name} ${SOLVERS[activeRun.solver].version}` : 'Delft3D FM & DualSPHysics (Coupled)'

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="GIS & Hydrological Exports"
      />

      {/* Case Study Selection for Dynamic Exports */}
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#949ba4]">Target Benchmark Dam / River Reach</h2>
            <p className="text-xs text-white/60 mt-0.5">Select a case study to generate case-tailored GIS polygons, station points, and technical reports</p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 self-start sm:self-auto">
            {selectedCase.reachKm} km Reach · {selectedCase.river}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
          {CASE_STUDIES.map((c) => {
            const isSelected = c.id === selectedCaseId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCaseId(c.id)}
                className={cn(
                  'flex flex-col text-left p-3 rounded-lg border transition-all duration-150 cursor-pointer',
                  isSelected
                    ? 'border-white/50 bg-white/10 text-white shadow-sm'
                    : 'border-white/8 bg-white/2 text-[#949ba4] hover:border-white/20 hover:text-white'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-white truncate">{c.name}</span>
                  {isSelected && <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />}
                </div>
                <span className="text-[10px] text-white/50 mt-1 truncate">{c.state}</span>
                <span className="text-[10px] font-mono text-white/70 mt-0.5">{c.reachKm} km reach</span>
              </button>
            )
          })}
        </div>
      </div>

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
            <dt className="text-[#949ba4]">Package Status</dt>
            <dd className="mt-1 font-mono font-semibold flex items-center gap-1.5 text-[#23a55a]">
              <span className="size-1.5 rounded-full bg-[#23a55a]" />
              READY FOR QGIS / ARCGIS / GOOGLE EARTH
            </dd>
          </div>
          <div className="glass-panel-subtle p-3 rounded-lg">
            <dt className="text-[#949ba4]">Spatial Reference</dt>
            <dd className="mt-1 font-mono text-white font-semibold">EPSG:4326 / EPSG:32644</dd>
          </div>
        </dl>
      </div>

      {/* Downstream Stations Preview for Selected Dam */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-white font-medium">
          <Building2 className="size-3.5 text-[#949ba4]" />
          <span>Downstream Stations:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCase.downstreamTowns.map((t, idx) => (
            <span key={t.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/8 text-[11px] font-mono text-white/80">
              {t.name} <span className="text-white/40">({t.chainageKm} km)</span>
              {idx < selectedCase.downstreamTowns.length - 1 && <span className="text-white/20 ml-1">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = fmt.icon
          const downloadUrl = api.exportUrl(targetRunId, fmt.id, selectedCase.id)
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
                  <p className="mt-1.5 text-xs text-[#949ba4] leading-relaxed">{fmt.description}</p>
                  <div className="mt-4">
                    <a
                      href={downloadUrl}
                      download
                      className="inline-flex items-center justify-center rounded-lg bg-white hover:bg-white/90 text-black px-3.5 h-8 text-xs font-semibold transition-all duration-150 cursor-pointer"
                    >
                      <Download className="mr-1.5 size-3.5" />
                      Download {selectedCase.name} {fmt.name} ({fmt.ext})
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
          Every exported dataset includes: target case study ({selectedCase.name}, {selectedCase.river}), solver identification and hydrodynamic algorithm version, DEM origin (GLO-30 Copernicus DEM, EPSG:32644),
          simulation epoch timestamp, breach hydrograph derivation equations (Froehlich 2008), and mass-balance residual verification. ESRI shapefiles incorporate coordinate projection sidecars (.prj) for direct ingestion in ArcGIS and QGIS.
        </p>
      </Panel>
    </div>
  )
}
