'use client'

import { useMemo } from 'react'
import { Satellite, RefreshCw, Circle } from 'lucide-react'
import { Panel, PageHeader, EmptyState } from '@/components/common/panel'
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
    sourceName: 'Sentinel-1 GRD SAR',
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
    sourceName: 'GPM IMERG V07 Precipitation',
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
    sourceName: 'OPERA DSWx-S1 Dynamic Surface Water',
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
    sourceName: 'JAXA GSMaP Rainfall Gauge',
    collection: 'JAXA/GPM_L3/GSMaP/v8/operational',
    acquiredAt: null,
    ingestedAt: null,
    status: 'not_configured',
    revisit: '1 hour',
    resolution: '0.1°',
  },
]

const STATUS_CONFIG = {
  ok: { label: 'Active Pipeline', color: 'text-[#23a55a]', dot: 'bg-[#23a55a]', shadow: 'shadow-[0_0_8px_rgba(35,165,90,0.6)]' },
  stale: { label: 'Revisit Stale', color: 'text-[#f0b232]', dot: 'bg-[#f0b232]', shadow: 'shadow-[0_0_8px_rgba(240,178,50,0.6)]' },
  no_acquisition: { label: 'No Overpass Found', color: 'text-[#949ba4]', dot: 'bg-[#949ba4]', shadow: 'none' },
  unavailable: { label: 'Catalog Offline', color: 'text-[#f23f43]', dot: 'bg-[#f23f43]', shadow: 'shadow-[0_0_8px_rgba(242,63,67,0.6)]' },
  not_configured: { label: 'Telemetry Standby', color: 'text-[#949ba4]', dot: 'bg-[#949ba4]', shadow: 'none' },
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
        title="Earth Observation Telemetry"
        description="Satellite remote sensing ingestion and real-time precipitation radar for the Bhagirathi catchment area via Google Earth Engine."
        actions={
          <Button variant="outline" size="sm" disabled={!isApiMode}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Poll Feeds
          </Button>
        }
      />

      {/* AOI Context */}
      <div className="glass-panel rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#5865f2]" />
            {TEHRI.name} — {TEHRI.river}
          </p>
          <p className="text-xs text-[#949ba4] font-mono mt-1">
            BBox: [{TEHRI.bbox.join(', ')}] · Coordinate System: EPSG:4326 (WGS 84)
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#dbdee1]">
          <span className={cn('size-2 rounded-full', isApiMode ? 'bg-[#23a55a] shadow-[0_0_8px_rgba(35,165,90,0.6)]' : 'bg-[#f0b232] shadow-[0_0_8px_rgba(240,178,50,0.6)]')} />
          <span className="font-semibold">{isApiMode ? 'GEE Worker Connected' : 'GEE Standby Mode'}</span>
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
                  <span className={cn('size-2 rounded-full', cfg.dot, cfg.shadow)} />
                  <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="glass-panel-subtle p-2.5 rounded-lg">
                    <dt className="text-[#949ba4]">Collection</dt>
                    <dd className="font-mono text-white mt-0.5 truncate text-[11px]" title={src.collection}>{src.collection}</dd>
                  </div>
                  <div className="glass-panel-subtle p-2.5 rounded-lg">
                    <dt className="text-[#949ba4]">Resolution</dt>
                    <dd className="font-mono text-[#7983f5] mt-0.5 font-semibold text-[11px]">{src.resolution}</dd>
                  </div>
                  <div className="glass-panel-subtle p-2.5 rounded-lg">
                    <dt className="text-[#949ba4]">Revisit Cycle</dt>
                    <dd className="font-mono text-white mt-0.5 text-[11px]">{src.revisit}</dd>
                  </div>
                  <div className="glass-panel-subtle p-2.5 rounded-lg">
                    <dt className="text-[#949ba4]">Data Age</dt>
                    <dd className="font-mono text-white mt-0.5 text-[11px]">{relativeAge(src.acquiredAt)}</dd>
                  </div>
                  <div className="glass-panel-subtle p-2.5 rounded-lg">
                    <dt className="text-[#949ba4]">Last Acquired</dt>
                    <dd className="font-mono text-white mt-0.5 text-[11px]">{formatDateTime(src.acquiredAt)}</dd>
                  </div>
                  <div className="glass-panel-subtle p-2.5 rounded-lg">
                    <dt className="text-[#949ba4]">Pipeline Ingestion</dt>
                    <dd className="font-mono text-white mt-0.5 text-[11px]">{formatDateTime(src.ingestedAt)}</dd>
                  </div>
                </dl>

                {src.status === 'not_configured' && (
                  <div className="glass-panel-subtle rounded-lg border border-dashed border-white/[0.08] p-3 text-xs text-[#949ba4] leading-relaxed">
                    GEE service credentials verified. Start the local observation daemon with active network to stream live radar scenes.
                  </div>
                )}
              </div>
            </Panel>
          )
        })}
      </div>

      {/* Freshness Legend */}
      <Panel title="Sensor Telemetry Status States">
        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className={cn('size-2 rounded-full shrink-0', cfg.dot, cfg.shadow)} />
              <span className="text-[#dbdee1] font-medium">{cfg.label}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
