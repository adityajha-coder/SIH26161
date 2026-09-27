'use client'

import { Download, FileJson, FileText, Map as MapIcon, FileArchive } from 'lucide-react'
import { Panel, PageHeader, EmptyState } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const EXPORT_FORMATS = [
  {
    id: 'geojson' as const,
    name: 'GeoJSON Boundary & Grid',
    description: 'High-resolution flood extent polygons with water depth, velocity vectors, and wavefront arrival time attributes. Consumable by web GIS engines.',
    icon: FileJson,
    ext: '.geojson',
    mime: 'application/geo+json',
  },
  {
    id: 'kml' as const,
    name: 'Google Earth KML / KMZ',
    description: 'Vector contours and inundated settlement point layers packaged for Google Earth 3D and field reconnaissance visualization.',
    icon: MapIcon,
    ext: '.kml',
    mime: 'application/vnd.google-earth.kml+xml',
  },
  {
    id: 'shp' as const,
    name: 'ESRI Shapefile Archive',
    description: 'Standard multi-file bundle (.shp, .shx, .dbf, .prj) projected to UTM 44N (EPSG:32644) for ArcGIS and QGIS analysis.',
    icon: FileArchive,
    ext: '.zip',
    mime: 'application/zip',
  },
  {
    id: 'report' as const,
    name: 'Executive Technical Dossier',
    description: 'Comprehensive hydrological assessment report containing scenario parameters, mass balance verification, and downstream asset exposure tables.',
    icon: FileText,
    ext: '.md',
    mime: 'text/markdown',
  },
]

export default function ExportsPage() {
  const { activeRun, activeScenario, mode } = usePlatform()
  const isApiMode = mode === 'api'
  const hasRun = activeRun && activeRun.status === 'done'

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="GIS & Hydrological Exports"
        description="Download geospatial simulation bundles in standard GIS formats. Every package embeds CRS projection, solver provenance, and Froehlich parameter records."
      />

      {/* Run Context */}
      {activeRun && (
        <div className="glass-panel rounded-xl p-4">
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="glass-panel-subtle p-3 rounded-lg">
              <dt className="text-[#949ba4]">Scenario Target</dt>
              <dd className="mt-1 font-mono text-white font-semibold truncate">{activeScenario?.name ?? '—'}</dd>
            </div>
            <div className="glass-panel-subtle p-3 rounded-lg">
              <dt className="text-[#949ba4]">Hydrodynamic Engine</dt>
              <dd className="mt-1 font-mono text-[#7983f5] font-semibold truncate">
                {SOLVERS[activeRun.solver].name} {SOLVERS[activeRun.solver].version}
              </dd>
            </div>
            <div className="glass-panel-subtle p-3 rounded-lg">
              <dt className="text-[#949ba4]">Job Execution Status</dt>
              <dd className={cn(
                'mt-1 font-mono font-semibold flex items-center gap-1.5',
                activeRun.status === 'done' ? 'text-[#23a55a]' : 'text-[#f0b232]',
              )}>
                <span className={cn('size-1.5 rounded-full', activeRun.status === 'done' ? 'bg-[#23a55a]' : 'bg-[#f0b232]')} />
                {activeRun.status.toUpperCase()}
              </dd>
            </div>
            <div className="glass-panel-subtle p-3 rounded-lg">
              <dt className="text-[#949ba4]">Spatial Reference</dt>
              <dd className="mt-1 font-mono text-white font-semibold">EPSG:32644 (UTM 44N)</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Export Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = fmt.icon
          const downloadUrl = hasRun ? api.exportUrl(activeRun.id, fmt.id) : null
          return (
            <Panel key={fmt.id}>
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#5865f2] shadow-[0_0_12px_rgba(88,101,242,0.15)]">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{fmt.name}</h3>
                    <span className="font-mono text-xs font-bold text-[#7983f5]">{fmt.ext}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#949ba4] leading-relaxed">{fmt.description}</p>
                  <div className="mt-4">
                    {isApiMode && downloadUrl ? (
                      <a
                        href={downloadUrl}
                        download
                        className="inline-flex items-center justify-center rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-white px-3.5 h-8 text-xs font-semibold shadow-[0_4px_16px_rgba(88,101,242,0.25)] transition-all duration-150"
                      >
                        <Download className="mr-1.5 size-3.5" />
                        Download {fmt.name}
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="text-xs">
                        <Download className="mr-1.5 size-3.5" />
                        {!hasRun ? 'Requires Completed Run' : 'API Standby'}
                      </Button>
                    )}
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
          Every exported dataset includes: scenario ID, solver identification and algorithm version, DEM origin (GLO-30 Copernicus DEM, EPSG:32644),
          simulation epoch timestamp, breach hydrograph derivation equations (Froehlich 2008), and mass-balance residual verification. ESRI shapefiles incorporate coordinate projection sidecars (.prj).
        </p>
      </Panel>
    </div>
  )
}
