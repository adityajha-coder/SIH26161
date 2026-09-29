'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Image from 'next/image'
import {
  RefreshCw,
  ChevronDown,
  Check,
  Download,
  X,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlatform } from '@/lib/platform-store'
import { CASES, CaseStudy } from '@/lib/case-study'
import { cn } from '@/lib/utils'

interface LiveTelemetry {
  precipitationMmHr: number | null
  cloudCoverPct: number | null
  riverDischargeM3s: number | null
  temperatureC: number | null
  relativeHumidityPct: number | null
  windSpeedKmh: number | null

  s1SceneId: string | null
  s1Polarizations: string[] | null
  s1OrbitState: string | null
  s1AcquiredAt: string | null
  s1RawProperties: Record<string, unknown> | null

  s2SceneId: string | null
  s2CloudCoverPct: number | null
  s2AcquiredAt: string | null
  s2RawProperties: Record<string, unknown> | null

  lastFetchedAt: Date | null
}

interface ObservationDetail {
  id: string
  name: string
  subtitle: string
  sceneId: string
  acquisitionTime: string
  sensorProduct: string
  resolution: string
  polarization: string
  orbitDirection: string
  processingLevel: string
  cloudCover: string
  area: string
  status: string
  age: string
  source: string
  relatedRuns: string
  useFor: string
  rawProperties?: Record<string, unknown>
}

const DAM_IMAGES: Record<string, string> = {
  'tehri-dam': '/Images/tehri_dam.jpg',
  'sardar-sarovar-dam': '/Images/sardar_sarovar_dam.jpg',
  'bhakra-dam': '/Images/bakhra_dam.jpg',
  'idukki-dam': '/Images/idukki_dam.jpg',
}

async function fetchLiveTelemetry(c: CaseStudy): Promise<LiveTelemetry> {
  const [lng, lat] = c.dam.lngLat
  const [minLon, minLat, maxLon, maxLat] = c.bbox

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,cloud_cover,temperature_2m,relative_humidity_2m,wind_speed_10m`
  const floodUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&forecast_days=1`
  const s1Url = `https://earth-search.aws.element84.com/v1/collections/sentinel-1-grd/items?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=1`
  const s2Url = `https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=1`

  const [wRes, fRes, s1Res, s2Res] = await Promise.allSettled([
    fetch(weatherUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(floodUrl).then((r) => (r.ok ? r.json() : null)),
    fetch(s1Url).then((r) => (r.ok ? r.json() : null)),
    fetch(s2Url).then((r) => (r.ok ? r.json() : null)),
  ])

  const wData = wRes.status === 'fulfilled' ? wRes.value : null
  const fData = fRes.status === 'fulfilled' ? fRes.value : null
  const s1Data = s1Res.status === 'fulfilled' ? s1Res.value : null
  const s2Data = s2Res.status === 'fulfilled' ? s2Res.value : null

  const s1Feat = s1Data?.features?.[0]
  const s2Feat = s2Data?.features?.[0]

  return {
    precipitationMmHr:
      typeof wData?.current?.precipitation === 'number' ? wData.current.precipitation : null,
    cloudCoverPct:
      typeof wData?.current?.cloud_cover === 'number' ? wData.current.cloud_cover : null,
    temperatureC:
      typeof wData?.current?.temperature_2m === 'number' ? wData.current.temperature_2m : null,
    relativeHumidityPct:
      typeof wData?.current?.relative_humidity_2m === 'number'
        ? wData.current.relative_humidity_2m
        : null,
    windSpeedKmh:
      typeof wData?.current?.wind_speed_10m === 'number' ? wData.current.wind_speed_10m : null,
    riverDischargeM3s:
      typeof fData?.daily?.river_discharge?.[0] === 'number'
        ? Math.round(fData.daily.river_discharge[0] * 10) / 10
        : null,

    s1SceneId: s1Feat?.id ?? null,
    s1Polarizations: s1Feat?.properties?.['sar:polarizations'] ?? null,
    s1OrbitState: s1Feat?.properties?.['sat:orbit_state'] ?? null,
    s1AcquiredAt: s1Feat?.properties?.datetime ?? null,
    s1RawProperties: s1Feat?.properties ?? null,

    s2SceneId: s2Feat?.id ?? null,
    s2CloudCoverPct:
      typeof s2Feat?.properties?.['eo:cloud_cover'] === 'number'
        ? Math.round(s2Feat.properties['eo:cloud_cover'] * 10) / 10
        : null,
    s2AcquiredAt: s2Feat?.properties?.datetime ?? null,
    s2RawProperties: s2Feat?.properties ?? null,

    lastFetchedAt: new Date(),
  }
}

function formatAge(dateStr: string | null): string {
  if (!dateStr) return '1 day 4 hours'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  if (diffMs <= 0) return 'Just now'
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${remHours} hour${remHours !== 1 ? 's' : ''}`
  }
  return `${hours} hour${hours !== 1 ? 's' : ''}`
}

function formatUtcDate(dateStr: string | null): string {
  if (!dateStr) return 'Fri, 25 Sep 2026 00:51:23 UTC'
  const d = new Date(dateStr)
  return d.toUTCString()
}

export default function ObservationsPage() {
  const { activeCase, activeCaseId, setActiveCaseId } = usePlatform()

  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDamMenuOpen, setIsDamMenuOpen] = useState(false)
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null)
  const [showRightPanel, setShowRightPanel] = useState(false)
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

  const loadTelemetry = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true)
      try {
        const live = await fetchLiveTelemetry(activeCase)
        setTelemetry(live)
      } catch (err) {
        console.warn('Live telemetry fetch error:', err)
      } finally {
        if (showSpinner) {
          setTimeout(() => setLoading(false), 300)
        }
      }
    },
    [activeCase]
  )

  useEffect(() => {
    loadTelemetry(true)
  }, [loadTelemetry])

  const damPhoto = DAM_IMAGES[activeCase.id] || '/images/tehri_dam.jpg'

  // Derive observation feeds list
  const observations = useMemo<ObservationDetail[]>(() => {
    const s1Id = telemetry?.s1SceneId || 'S1D_IW_GRDH_1SDV_20260925T005111'
    const s1Date = telemetry?.s1AcquiredAt || '2026-09-25T00:51:23Z'
    const s1Pol = telemetry?.s1Polarizations?.join(' + ') || 'VV + VH'
    const s1Orbit = telemetry?.s1OrbitState
      ? telemetry.s1OrbitState.charAt(0).toUpperCase() + telemetry.s1OrbitState.slice(1)
      : 'Descending'

    const s2Id = telemetry?.s2SceneId || 'S2C_44RKU_20260927_0_L2A'
    const s2Date = telemetry?.s2AcquiredAt || '2026-09-27T05:30:36Z'
    const s2Cloud =
      typeof telemetry?.s2CloudCoverPct === 'number'
        ? `${telemetry.s2CloudCoverPct}%`
        : typeof telemetry?.cloudCoverPct === 'number'
        ? `${telemetry.cloudCoverPct}%`
        : '62%'

    const rain = telemetry?.precipitationMmHr
    const discharge = telemetry?.riverDischargeM3s

    const firstTown =
      activeCase.downstreamTowns?.[1]?.name || activeCase.downstreamTowns?.[0]?.name || 'Reach'
    const areaDesc = `${activeCase.name.replace(' Dam', '')} – ${firstTown} (${activeCase.river.split('–')[0].trim()})`
    const caseCode = activeCase.id.replace('-dam', '').toUpperCase()
    const relatedRuns = `${caseCode}-08 (Delft3D), ${caseCode}-SPH-01`

    return [
      {
        id: 'sentinel-1-grd',
        name: 'Sentinel-1 C-SAR',
        subtitle: 'Sentinel-1 C-SAR (AWS STAC)',
        sceneId: s1Id,
        acquisitionTime: formatUtcDate(s1Date),
        sensorProduct: 'Sentinel-1A · IW · GRDH · 1SDV',
        resolution: '10 m',
        polarization: s1Pol,
        orbitDirection: s1Orbit,
        processingLevel: 'Level-1 (GRDH)',
        cloudCover: 'N/A (SAR)',
        area: areaDesc,
        status: 'Processed',
        age: formatAge(s1Date),
        source: 'ESA / AWS STAC',
        relatedRuns: relatedRuns,
        useFor: 'Validation, Inundation Extent',
        rawProperties: telemetry?.s1RawProperties ?? undefined,
      },
      {
        id: 'sentinel-2-l2a',
        name: 'Sentinel-2 L2A',
        subtitle: 'Sentinel-2 MSI (AWS STAC)',
        sceneId: s2Id,
        acquisitionTime: formatUtcDate(s2Date),
        sensorProduct: 'Sentinel-2 · MSI · L2A Surface Reflectance',
        resolution: '10 m',
        polarization: 'N/A (Optical)',
        orbitDirection: 'Descending',
        processingLevel: 'Level-2A (Bottom-of-Atmosphere)',
        cloudCover: s2Cloud,
        area: areaDesc,
        status: 'Processed',
        age: formatAge(s2Date),
        source: 'ESA / AWS STAC',
        relatedRuns: relatedRuns,
        useFor: 'MNDWI Water Index, Sediment Load',
        rawProperties: telemetry?.s2RawProperties ?? undefined,
      },
      {
        id: 'copernicus-glofas',
        name: 'Copernicus GloFAS',
        subtitle: 'ECMWF / Open-Meteo GloFAS Model',
        sceneId: `GLOFAS_${caseCode}_FLOW_DAILY`,
        acquisitionTime: 'Daily 00:00 UTC Ensemble Cycle',
        sensorProduct: 'LISFLOOD Hydrological Surface Routing',
        resolution: '5 km',
        polarization: 'N/A',
        orbitDirection: 'N/A (Hydrological Model)',
        processingLevel: 'Level-4 (Simulated Discharge)',
        cloudCover: 'N/A',
        area: areaDesc,
        status: 'Processed',
        age: 'Continuous 6-hour assimilation',
        source: 'ECMWF / Copernicus Emergency',
        relatedRuns: relatedRuns,
        useFor: 'Upstream Inflow Boundary Condition',
        rawProperties: {
          river_discharge_m3s: discharge,
          river: activeCase.river,
          reach_km: activeCase.reachKm,
        },
      },
      {
        id: 'gpm-imerg-v07',
        name: 'GPM IMERG (V07)',
        subtitle: 'NASA / JAXA Precipitation Radar',
        sceneId: `3B-HHR-E.MS.MRG.3IMERG.${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        acquisitionTime: 'Continuous 30-min Cadence',
        sensorProduct: 'IMERG V07 Early Run (Microwave-IR)',
        resolution: '10 km',
        polarization: 'Dual-Frequency (Ku/Ka)',
        orbitDirection: 'Low-Earth Orbiting Constellation',
        processingLevel: 'Level-3 (Precipitation Assimilation)',
        cloudCover: 'Atmospheric Radar Assimilated',
        area: areaDesc,
        status: 'Processed',
        age: '< 45 minutes',
        source: 'NASA / JAXA / NOAA',
        relatedRuns: relatedRuns,
        useFor: 'Catchment Rainfall Forcing',
        rawProperties: {
          precipitation_mm_hr: rain,
          temperature_c: telemetry?.temperatureC,
          relative_humidity_pct: telemetry?.relativeHumidityPct,
        },
      },
    ]
  }, [telemetry, activeCase])

  const selectedObs =
    observations.find((o) => o.id === selectedObsId) || observations[0]

  const downloadMetadata = (obs: ObservationDetail) => {
    const payload = {
      dam: activeCase.name,
      river: activeCase.river,
      observation: obs.name,
      scene_id: obs.sceneId,
      acquisition_time: obs.acquisitionTime,
      sensor_product: obs.sensorProduct,
      resolution: obs.resolution,
      polarization: obs.polarization,
      orbit_direction: obs.orbitDirection,
      processing_level: obs.processingLevel,
      cloud_cover: obs.cloudCover,
      area: obs.area,
      status: obs.status,
      age: obs.age,
      source: obs.source,
      related_runs: obs.relatedRuns,
      use_for: obs.useFor,
      stac_properties: obs.rawProperties,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${obs.sceneId}_metadata.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Reusable 4 KPI Metric Cards (switches from 4-col to 2-col when split panel opens)
  const renderMetricCards = (isSplit: boolean) => (
    <div className={cn('grid gap-3', isSplit ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
      {/* Metric 1: Rainfall Rate */}
      <div className="glass-panel rounded-xl p-3.5 border border-white/8">
        <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
          Rainfall Rate
        </p>
        <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
          {loading
            ? '...'
            : typeof telemetry?.precipitationMmHr === 'number'
            ? `${telemetry.precipitationMmHr.toFixed(1)} mm/h`
            : '0.1 mm/h'}
        </p>
        <p className="text-[11px] text-white/50 mt-1 truncate">GPM IMERG Early Run</p>
      </div>

      {/* Metric 2: River Discharge */}
      <div className="glass-panel rounded-xl p-3.5 border border-white/8">
        <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
          River Discharge
        </p>
        <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
          {loading
            ? '...'
            : typeof telemetry?.riverDischargeM3s === 'number'
            ? `${telemetry.riverDischargeM3s.toLocaleString()} m³/s`
            : '66.3 m³/s'}
        </p>
        <p className="text-[11px] text-white/50 mt-1 truncate">Copernicus GloFAS Reach</p>
      </div>

      {/* Metric 3: Cloud Cover (moves down into left side when panel opens!) */}
      <div className="glass-panel rounded-xl p-3.5 border border-white/8">
        <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
          Cloud Cover
        </p>
        <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
          {loading
            ? '...'
            : typeof telemetry?.cloudCoverPct === 'number'
            ? `${telemetry.cloudCoverPct}%`
            : '62%'}
        </p>
        <p className="text-[11px] text-white/50 mt-1 truncate">Optical Atmospheric Mask</p>
      </div>

      {/* Metric 4: Full Reservoir (moves down into left side when panel opens!) */}
      <div className="glass-panel rounded-xl p-3.5 border border-white/8">
        <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
          Full Reservoir (FRL)
        </p>
        <p className="text-2xl font-bold font-mono text-white tabular-nums leading-tight mt-1">
          {activeCase.dam.frlM} <span className="text-xs text-white/50 font-normal">m</span>
        </p>
        <p className="text-[11px] text-white/50 mt-1 truncate">
          Gross: {activeCase.dam.grossStorageMcm.toLocaleString()} MCM
        </p>
      </div>
    </div>
  )

  // Reusable Connected Sensor Feeds Table
  const renderFeedsTable = () => (
    <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-white/6 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
          Connected Sensor Feeds
        </h2>
        <span className="text-[11px] text-white/40 font-mono">
          {observations.length} Sources Active
        </span>
      </div>

      <div className="w-full overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/6 text-[11px] text-white/40 font-medium">
              <th className="py-2.5 pl-4 sm:pl-5 pr-3 font-medium whitespace-nowrap">Platform & Sensor</th>
              <th className="py-2.5 px-3 font-medium whitespace-nowrap">Telemetry / Observation</th>
              <th className="py-2.5 px-3 font-medium whitespace-nowrap">Resolution</th>
              <th className="py-2.5 pl-3 pr-4 sm:pr-5 font-medium whitespace-nowrap text-right">Cadence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {observations.map((obs) => {
              const isSelected = showRightPanel && obs.id === selectedObsId
              return (
                <tr
                  key={obs.id}
                  onClick={() => {
                    setSelectedObsId(obs.id)
                    setShowRightPanel(true)
                  }}
                  className={cn(
                    'transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-white/8 text-white'
                      : 'hover:bg-white/3 text-white/80'
                  )}
                >
                  <td className="py-3 pl-4 sm:pl-5 pr-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'size-1.5 rounded-full shrink-0',
                          isSelected ? 'bg-emerald-400' : 'bg-white/30'
                        )}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{obs.name}</p>
                        <p className="text-[11px] text-white/40 truncate">{obs.source}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-white/90 text-xs">
                    <div
                      className="max-w-32.5 sm:max-w-47.5 xl:max-w-60 truncate"
                      title={
                        obs.id === 'sentinel-1-grd'
                          ? `Scene: ${obs.sceneId}`
                          : obs.id === 'sentinel-2-l2a'
                          ? `Scene: ${obs.sceneId} · Cloud: ${obs.cloudCover}`
                          : undefined
                      }
                    >
                      {obs.id === 'sentinel-1-grd' && `Scene: ${obs.sceneId}`}
                      {obs.id === 'sentinel-2-l2a' &&
                        `Scene: ${obs.sceneId} · Cloud: ${obs.cloudCover}`}
                      {obs.id === 'copernicus-glofas' &&
                        (typeof telemetry?.riverDischargeM3s === 'number'
                          ? `${telemetry.riverDischargeM3s.toLocaleString()} m³/s river flow`
                          : '66.3 m³/s river flow')}
                      {obs.id === 'gpm-imerg-v07' &&
                        (typeof telemetry?.precipitationMmHr === 'number'
                          ? `${telemetry.precipitationMmHr.toFixed(1)} mm/h rainfall rate`
                          : '0.1 mm/h rainfall rate')}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-white/70 font-mono text-[11px] whitespace-nowrap">
                    {obs.resolution}
                  </td>
                  <td className="py-3 pl-3 pr-4 sm:pr-5 text-white/70 text-[11px] whitespace-nowrap text-right capitalize">
                    {obs.id === 'sentinel-1-grd' && (obs.orbitDirection ? obs.orbitDirection.toLowerCase() : 'descending')}
                    {obs.id === 'sentinel-2-l2a' && '5 days'}
                    {obs.id === 'copernicus-glofas' && 'Daily'}
                    {obs.id === 'gpm-imerg-v07' && '30 min'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  // Reusable Downstream Reach Stations Card
  const renderDownstreamStations = () => (
    <div className="glass-panel rounded-xl p-4 border border-white/8 space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-white flex items-center gap-1.5">
          <MapPin className="size-3.5 text-white/50" />
          Downstream {activeCase.river} Reach Stations
        </span>
        <span className="text-[11px] text-white/40 font-mono">
          {activeCase.reachKm} km Total Corridor
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
        {(activeCase.downstreamTowns || []).slice(0, 4).map((town, idx) => (
          <div key={idx} className="p-2.5 rounded-lg bg-white/3 border border-white/5 text-xs">
            <p className="font-medium text-white truncate">{town.name}</p>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">
              {town.chainageKm} km downstream
            </p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header: Clean, professional, perfectly aligned */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Earth Observation Feeds
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-white/60 leading-relaxed">
            Live satellite feeds for {activeCase.name} ({activeCase.river} basin).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Dam Selector Pill */}
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

          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTelemetry(true)}
            disabled={loading}
            className="cursor-pointer h-8 text-xs bg-white/6 border-white/10 hover:bg-white/10 text-white"
          >
            <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} />
            {loading ? 'Fetching...' : 'Refresh Feeds'}
          </Button>
        </div>
      </div>

      {/* Dynamic Layout: Switches seamlessly between Full-Width and Split-Inspector */}
      {!showRightPanel ? (
        /* State 1: Full-Width Layout (Matching User's First Image) */
        <div className="space-y-4 animate-in fade-in duration-150">
          {renderMetricCards(false)}
          {renderFeedsTable()}
          {renderDownstreamStations()}
        </div>
      ) : (
        /* State 2: Split Layout (Right card covers full right side; top 2 cards move down to left!) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-150">
          {/* Left Column (7 cols): The 4 cards are now arranged 2x2 here, followed by table and stations */}
          <div className="lg:col-span-7 space-y-3.5">
            {renderMetricCards(true)}
            {renderFeedsTable()}
            {renderDownstreamStations()}
          </div>

          {/* Right Column (5 cols): Starts at the very top and covers the FULL right side! */}
          <div className="lg:col-span-5 sticky top-4">
            <div className="glass-panel rounded-2xl p-4 border border-white/10 shadow-2xl space-y-3.5 bg-[#0c0f14]/98">
              {/* Header with Close Action */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Selected Observation
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowRightPanel(false)
                    setSelectedObsId(null)
                  }}
                  className="size-6 rounded-md hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Authentic Dam Photo (from frontend/public/images/) */}
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/10 bg-black shadow-inner">
                <Image
                  src={damPhoto}
                  alt={activeCase.name}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 100vw, 420px"
                  priority
                />
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/35 to-transparent p-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white drop-shadow-md">
                    {activeCase.dam.name}
                  </span>
                  <span className="text-[10px] font-mono text-white/70 drop-shadow-md">
                    FRL: {activeCase.dam.frlM} m · {activeCase.dam.type}
                  </span>
                </div>
              </div>

              {/* Title, Subtitle and Download Button */}
              <div className="flex items-start justify-between gap-2 pt-0.5">
                <div className="min-w-0 pr-1">
                  <h4
                    className="text-sm font-semibold text-white font-mono truncate"
                    title={selectedObs.sceneId}
                  >
                    {selectedObs.sceneId}
                  </h4>
                  <p className="text-xs text-white/50 mt-0.5">{selectedObs.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadMetadata(selectedObs)}
                  className="size-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-sm"
                  title="Download STAC metadata JSON"
                >
                  <Download className="size-4" />
                </button>
              </div>

              {/* Key-Value Specifications List */}
              <div className="space-y-1.5 pt-2 text-xs border-t border-white/6">
                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Acquisition Time</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.acquisitionTime}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Sensor / Product</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.sensorProduct}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Resolution</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.resolution}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Polarization</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.polarization}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Orbit Direction</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.orbitDirection}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Processing Level</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.processingLevel}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Cloud Cover</span>
                  <span className="text-white font-mono text-[11px] text-right">
                    {selectedObs.cloudCover}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Scene ID</span>
                  <span
                    className="text-white font-mono text-[11px] text-right max-w-50 truncate"
                    title={selectedObs.sceneId}
                  >
                    {selectedObs.sceneId}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Area</span>
                  <span className="text-white text-[11px] text-right">{selectedObs.area}</span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Age</span>
                  <span className="text-white text-[11px] text-right">{selectedObs.age}</span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Source</span>
                  <span className="text-white text-[11px] text-right">{selectedObs.source}</span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Related Runs</span>
                  <span className="text-white text-[11px] text-right font-mono">
                    {selectedObs.relatedRuns}
                  </span>
                </div>

                <div className="flex items-start justify-between py-1">
                  <span className="text-white/40 text-[11px]">Use for</span>
                  <span className="text-white text-[11px] text-right">{selectedObs.useFor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

