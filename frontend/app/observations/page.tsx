'use client'

import { useMemo } from 'react'
import { Satellite, RefreshCw, Circle } from 'lucide-react'
import { Panel, PageHeader, EmptyState } from '@/components/common/panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { TEHRI } from '@/lib/case-study'
import { formatDateTime, relativeAge } from '@/lib/format'
import type { ObservationProduct } from '@/lib/types'
import { cn } from '@/lib/utils'

const OBSERVATION_SOURCES: ObservationProduct[] = [
  {
    id: 'obs-sentinel1',
    source: 'sentinel1',
    sourceName: 'Sentinel-1 GRD',
    collection: 'COPERNICUS/S1_GRD',
    acquiredAt: null,
    ingestedAt: null,
    status: 'not_configured',
    revisit: '~6 days',
    resolution: '10 m',
  },
  {
    id: 'obs-imerg',
    source: 'imerg',
    sourceName: 'GPM IMERG V07',
    collection: 'NASA/GPM_L3/IMERG_V07',
    acquiredAt: null,
    ingestedAt: null,
    status: 'not_configured',
    revisit: '30 min',
    resolution: '0.1°',
  },
  {
    id: 'obs-dswx',
    source: 'dswx',
    sourceName: 'OPERA DSWx-S1',
    collection: 'OPERA_L3_DSWX-S1_V1',
    acquiredAt: null,
    ingestedAt: null,
    status: 'not_configured',
    revisit: '6–12 days',
    resolution: '30 m',
  },
  {
    id: 'obs-gsmap',
    source: 'gsmap',
    sourceName: 'GSMaP Operational V8',
    collection: 'JAXA/GPM_L3/GSMaP/v8/operational',
    acquiredAt: null,
    ingestedAt: null,
    status: 'not_configured',
    revisit: '1 hour',
    resolution: '0.1°',
  },
]

const STATUS_CONFIG = {
  ok: { label: 'Active', color: 'text-success', dot: 'bg-success' },
  stale: { label: 'Stale', color: 'text-warning', dot: 'bg-warning' },
  no_acquisition: { label: 'No Acquisition', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  unavailable: { label: 'Unavailable', color: 'text-destructive', dot: 'bg-destructive' },
  not_configured: { label: 'Not Configured', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
} as const

export default function ObservationsPage() {
  const { mode, apiStatus } = usePlatform()
  const isApiMode = mode === 'api'

  const sources = useMemo(() => {
    return OBSERVATION_SOURCES
  }, [])

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Live Observation"
        description="Satellite Earth observation and rainfall telemetry for the case study AOI. Data sources are polled via Google Earth Engine."
        actions={
          <Button variant="outline" size="sm" disabled={!isApiMode}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        }
      />

      {/* AOI Context */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{TEHRI.name} — {TEHRI.river}</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              AOI: {TEHRI.bbox.join(', ')} · CRS: EPSG:4326
            </p>
          </div>
          <Badge variant="outline" className={cn('text-[10px]', isApiMode ? 'border-success/30 text-success' : 'border-warning/30 text-warning')}>
            {isApiMode ? 'GEE Worker Connected' : 'GEE Worker Not Connected'}
          </Badge>
        </div>
      </div>

      {/* Source Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sources.map((src) => {
          const cfg = STATUS_CONFIG[src.status]
          return (
            <Panel key={src.id} title={src.sourceName}>
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <Circle className={cn('size-2 fill-current', cfg.dot, cfg.color)} />
                  <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">Collection</dt>
                    <dd className="font-mono text-foreground mt-0.5 truncate" title={src.collection}>{src.collection}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Resolution</dt>
                    <dd className="font-mono text-foreground mt-0.5">{src.resolution}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Revisit</dt>
                    <dd className="font-mono text-foreground mt-0.5">{src.revisit}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Data Age</dt>
                    <dd className="font-mono text-foreground mt-0.5">{relativeAge(src.acquiredAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last Observed</dt>
                    <dd className="font-mono text-foreground mt-0.5">{formatDateTime(src.acquiredAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ingested At</dt>
                    <dd className="font-mono text-foreground mt-0.5">{formatDateTime(src.ingestedAt)}</dd>
                  </div>
                </dl>

                {src.status === 'not_configured' && (
                  <div className="rounded-md border border-dashed border-border px-3 py-2 text-[10px] text-muted-foreground">
                    Requires GEE service account and observation worker. Connect the Go API to enable polling.
                  </div>
                )}

                {src.status === 'stale' && (
                  <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-[10px] text-warning">
                    Data is older than expected revisit interval. The last valid observation is shown with its real timestamp.
                  </div>
                )}
              </div>
            </Panel>
          )
        })}
      </div>

      {/* Freshness Legend */}
      <Panel title="Freshness States">
        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <Circle className={cn('size-2 fill-current shrink-0', cfg.dot, cfg.color)} />
              <span className="text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
