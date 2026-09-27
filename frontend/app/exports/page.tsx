'use client'

import { Download, FileJson, FileText, Map as MapIcon, FileArchive } from 'lucide-react'
import { Panel, PageHeader, EmptyState } from '@/components/common/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { SOLVERS } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const EXPORT_FORMATS = [
  {
    id: 'geojson' as const,
    name: 'GeoJSON',
    description: 'Flood extent polygons with depth, velocity, and arrival-time attributes. Lightweight browser-consumable format.',
    icon: FileJson,
    ext: '.geojson',
    mime: 'application/geo+json',
  },
  {
    id: 'kml' as const,
    name: 'KML / KMZ',
    description: 'Flood extent boundary, depth contours, and affected settlements. Opens in Google Earth and QGIS.',
    icon: MapIcon,
    ext: '.kml',
    mime: 'application/vnd.google-earth.kml+xml',
  },
  {
    id: 'shp' as const,
    name: 'Shapefile (ZIP)',
    description: 'Flood polygons with .prj, .dbf, .shx components packaged as ZIP. Standard GIS interchange format.',
    icon: FileArchive,
    ext: '.zip',
    mime: 'application/zip',
  },
  {
    id: 'report' as const,
    name: 'Executive Report',
    description: 'Scenario summary, comparison metrics, impact statistics, and key maps in a markdown dossier.',
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
        title="GIS Export"
        description="Download simulation results in standard geospatial formats. All exports include scenario metadata, solver version, CRS, and run timestamp."
        actions={
          <Badge variant="outline" className="font-mono text-[10px]">
            <Download className="mr-1 size-3" />
            {hasRun ? `Run: ${activeRun.id}` : 'No completed run'}
          </Badge>
        }
      />

      {/* Run Context */}
      {activeRun && (
        <div className="rounded-lg border border-border bg-card p-4">
          <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Scenario</dt>
              <dd className="mt-0.5 font-mono text-foreground">{activeScenario?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Solver</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {SOLVERS[activeRun.solver].name} {SOLVERS[activeRun.solver].version}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className={cn(
                'mt-0.5 font-mono font-semibold',
                activeRun.status === 'done' ? 'text-success' : 'text-warning',
              )}>
                {activeRun.status.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CRS</dt>
              <dd className="mt-0.5 font-mono text-foreground">EPSG:32644 (UTM 44N)</dd>
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{fmt.name}</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">{fmt.ext}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{fmt.description}</p>
                  <div className="mt-3">
                    {isApiMode && downloadUrl ? (
                      <a
                        href={downloadUrl}
                        download
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground transition-all"
                      >
                        <Download className="mr-1.5 size-3.5" />
                        Download {fmt.name}
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        <Download className="mr-1.5 size-3.5" />
                        {!hasRun ? 'No completed run' : 'API not connected'}
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
      <Panel title="Export Metadata">
        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
          Every export includes: scenario ID, solver name and version, DEM provenance (Copernicus GLO-30, EPSG:32644),
          simulation timestamp, breach equation (Froehlich 2008), and mass-balance residual. Shapefiles include a .prj
          file with the correct coordinate reference system. KML files embed scenario metadata in ExtendedData elements.
        </p>
      </Panel>
    </div>
  )
}
