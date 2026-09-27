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
  const targetRunId = (activeRun && activeRun.status === 'done') ? activeRun.id : 'tehri-dam-break-calibrated'
  const targetScenarioName = activeScenario?.name ?? 'Tehri Dam Overtopping PMF (Calibrated Baseline)'
  const targetEngineName = activeRun ? `${SOLVERS[activeRun.solver].name} ${SOLVERS[activeRun.solver].version}` : 'Delft3D FM (D-Flow FM 2024.03)'

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="GIS & Hydrological Exports"
        description="Download geospatial simulation bundles in standard GIS formats (.shp ZIP, .kml, .geojson). Every package embeds CRS projection, solver provenance, and Froehlich parameter records."
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
            <dt className="text-[#949ba4]">Package Status</dt>
            <dd className="mt-1 font-mono font-semibold flex items-center gap-1.5 text-[#23a55a]">
              <span className="size-1.5 rounded-full bg-[#23a55a]" />
              READY FOR QGIS / GOOGLE EARTH
            </dd>
          </div>
          <div className="glass-panel-subtle p-3 rounded-lg">
            <dt className="text-[#949ba4]">Spatial Reference</dt>
            <dd className="mt-1 font-mono text-white font-semibold">EPSG:4326 / EPSG:32644</dd>
          </div>
        </dl>
      </div>

      {/* Export Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORT_FORMATS.map((fmt) => {
          const Icon = fmt.icon
          const downloadUrl = api.exportUrl(targetRunId, fmt.id)
          return (
            <Panel key={fmt.id}>
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white">
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
          Every exported dataset includes: scenario ID, solver identification and algorithm version, DEM origin (GLO-30 Copernicus DEM, EPSG:32644),
          simulation epoch timestamp, breach hydrograph derivation equations (Froehlich 2008), and mass-balance residual verification. ESRI shapefiles incorporate coordinate projection sidecars (.prj).
        </p>
      </Panel>
    </div>
  )
}
