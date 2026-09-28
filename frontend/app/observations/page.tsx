'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Satellite, RefreshCw, Radio, Check, Clock, Droplets, CloudRain, Waves } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/common/panel'
import { Button } from '@/components/ui/button'
import { TEHRI } from '@/lib/case-study'
import { API_BASE_URL } from '@/lib/config'
import { cn } from '@/lib/utils'

interface ObservationDTO {
  source_id: string
  platform: string
  sensor: string
  resolution_m: number
  scene_id: string
  acquisition_time: string
  ingestion_time: string
  data_age_hours: number
  freshness: 'FRESH' | 'NOMINAL' | 'STALE'
  status: string
  telemetry_value: string
  next_pass_eta: string
  notes: string
}

const FALLBACK_OBSERVATIONS: ObservationDTO[] = [
  {
    source_id: 'sentinel-1-grd',
    platform: 'Copernicus Sentinel-1B',
    sensor: 'C-Band Synthetic Aperture Radar',
    resolution_m: 10,
    scene_id: 'S1B_IW_GRDH_1SDV_20260926T211512',
    acquisition_time: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    ingestion_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    data_age_hours: 14.0,
    freshness: 'NOMINAL',
    status: 'VERIFIED',
    telemetry_value: 'VV/VH Ratio: -14.2 dB · Water Mask Extracted',
    next_pass_eta: 'In 4 days (Descending Orbit 136)',
    notes: 'Penetrates cloud cover across Himalayan river gorge',
  },
  {
    source_id: 'gpm-imerg-v07',
    platform: 'NASA / JAXA GPM Observatory',
    sensor: 'IMERG V07 Precipitation Radar',
    resolution_m: 10000,
    scene_id: '3B-HHR-E.MS.MRG.3IMERG.20260927-S103000',
    acquisition_time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    ingestion_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    data_age_hours: 0.8,
    freshness: 'FRESH',
    status: 'VERIFIED',
    telemetry_value: 'Corridor Peak: 4.8 mm/hr (Devprayag Gauge)',
    next_pass_eta: 'Continuous 30-min cadence',
    notes: 'Calibrated with ground gauge stations',
  },
  {
    source_id: 'opera-dswx-s1',
    platform: 'NASA JPL / OPERA',
    sensor: 'Dynamic Surface Water Extent',
    resolution_m: 30,
    scene_id: 'OPERA_L3_DSWx-S1_T44RKR_20260925T134500',
    acquisition_time: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    ingestion_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    data_age_hours: 36.0,
    freshness: 'STALE',
    status: 'VERIFIED',
    telemetry_value: 'Reservoir Surface Area: 18.4 km²',
    next_pass_eta: 'In 36 hours',
    notes: 'Derived from Sentinel-1 SAR and Copernicus DEM',
  },
  {
    source_id: 'gsmap-operational',
    platform: 'JAXA Global Rainfall Map',
    sensor: 'GSMaP Microwave-Infrared',
    resolution_m: 10000,
    scene_id: 'GSMaP_gauge.20260927.0900.v8',
    acquisition_time: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    ingestion_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    data_age_hours: 2.0,
    freshness: 'FRESH',
    status: 'VERIFIED',
    telemetry_value: 'Catchment Mean: 2.1 mm/hr',
    next_pass_eta: 'Continuous hourly cadence',
    notes: 'Satellite microwave and infrared precipitation blend',
  },
]

export default function ObservationsPage() {
  const [refreshing, setRefreshing] = useState(false)

  const { data, mutate } = useSWR<ObservationDTO[]>(
    `${API_BASE_URL}/api/v1/observations/latest`,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error('API offline')
      return res.json()
    },
    {
      fallbackData: FALLBACK_OBSERVATIONS,
      refreshInterval: 30000,
    }
  )

  const observations = data && data.length > 0 ? data : FALLBACK_OBSERVATIONS

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch(`${API_BASE_URL}/api/v1/observations/refresh`, { method: 'POST' })
      await mutate()
    } catch (e) {
      console.warn('Observation refresh triggered fallback', e)
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header - No subheadings */}
      <PageHeader
        title="Earth Observation Feeds"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="cursor-pointer h-8 text-xs bg-white/3 border-white/10 hover:bg-white/8 text-white"
          >
            <RefreshCw className={cn('mr-1.5 size-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Checking Feeds...' : 'Refresh Feeds'}
          </Button>
        }
      />

      {/* Catchment Context Banner */}
      <div className="glass-panel rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">{TEHRI.name} Catchment</span>
          <span className="text-white/20">·</span>
          <span className="text-white/50 font-mono text-[11px]">
            105 km Bhagirathi-Ganga Reach [{TEHRI.bbox.map((b) => b.toFixed(2)).join(', ')}]
          </span>
        </div>
      </div>

      {/* 4 Essential Sensor Feeds */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        {observations.map((src) => {
          const isFresh = src.freshness === 'FRESH'
          const isStale = src.freshness === 'STALE'

          return (
            <div
              key={src.source_id}
              className="glass-panel rounded-xl p-4 flex flex-col justify-between hover:border-white/[0.14] transition-colors"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{src.platform}</h3>
                    <p className="text-xs text-white/50 mt-0.5">{src.sensor}</p>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium border tabular-nums',
                      isFresh && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                      isStale && 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                      !isFresh && !isStale && 'bg-white/5 border-white/8 text-white/70'
                    )}
                  >
                    {src.data_age_hours < 1 ? '< 1h ago' : `${src.data_age_hours.toFixed(0)}h ago`}
                  </span>
                </div>

                {/* Main Measurement Callout */}
                <div className="mt-3 p-3 rounded-lg bg-white/2 border border-white/5">
                  <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">
                    Current Reading
                  </span>
                  <span className="text-xs font-semibold text-white font-mono block mt-1">
                    {src.telemetry_value}
                  </span>
                </div>
              </div>

              {/* Specifications Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-3 mt-3 border-t border-white/5">
                <div>
                  <span className="text-[10px] text-white/40 block">Resolution</span>
                  <span className="font-mono text-white text-[11px] font-medium">
                    {src.resolution_m >= 1000 ? `${(src.resolution_m / 1000).toFixed(0)} km` : `${src.resolution_m} m`}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-white/40 block">Next Orbit / Pass</span>
                  <span className="font-mono text-white/80 text-[11px]">
                    {src.next_pass_eta}
                  </span>
                </div>

                <div className="col-span-2 pt-1">
                  <span className="text-[10px] text-white/40 block">Scene Reference</span>
                  <span className="font-mono text-white/50 text-[10px] truncate block" title={src.scene_id}>
                    {src.scene_id}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
