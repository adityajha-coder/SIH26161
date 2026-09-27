'use client'

import { useEffect, useRef, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from 'maplibre-gl'
import { TEHRI } from '@/lib/case-study'
import { TILES } from '@/lib/config'
import type { FloodBands } from '@/lib/flood-model'
import { formatClock, formatNumber } from '@/lib/format'
import { useGeoData } from '@/lib/geo'
import { cn } from '@/lib/utils'
import { buildStyle, DEFAULT_LAYERS, type BaseMode, type LayerVisibility } from './map-style'

type MapLib = typeof import('maplibre-gl')
type DemSourceT = { sharedDemProtocolUrl: string; contourProtocolUrl: (o: object) => string }

let libPromise: Promise<{ maplibregl: MapLib; dem: DemSourceT }> | null = null

function loadLib() {
  if (!libPromise) {
    libPromise = (async () => {
      const maplibregl = await import('maplibre-gl')
      // Turbopack cannot resolve MapLibre v6's import.meta.url worker; serve it from /public (copied on postinstall).
      maplibregl.setWorkerUrl(`${window.location.origin}/maplibre/maplibre-gl-worker.mjs`)
      const mlcontour = (await import('maplibre-contour')).default
      const dem = new mlcontour.DemSource({
        url: TILES.terrarium,
        encoding: 'terrarium',
        maxzoom: 13,
        worker: true,
      })
      dem.setupMaplibre(maplibregl as never)
      return { maplibregl, dem: dem as unknown as DemSourceT }
    })()
  }
  return libPromise
}

export interface MapViewProps {
  base: BaseMode
  layers?: Partial<LayerVisibility>
  exaggeration?: number
  timeS?: number
  flood?: FloodBands | null
  exposure?: FeatureCollection | null
  floodOpacity?: number
  interactive?: boolean
  showNavigation?: boolean
  bounds?: [number, number, number, number]
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  className?: string
  label?: string
  ariaLabel?: string
}

const RESERVOIR_DAM_BOUNDS: [number, number, number, number] = [78.1, 29.93, 78.66, 30.46]

export function MapView({
  base,
  layers: layerOverrides,
  exaggeration = 1.5,
  timeS,
  flood,
  exposure,
  floodOpacity = 0.72,
  interactive = true,
  showNavigation = true,
  bounds = RESERVOIR_DAM_BOUNDS,
  center,
  zoom,
  pitch,
  bearing,
  className,
  label,
  ariaLabel,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const geo = useGeoData()
  const layers: LayerVisibility = { ...DEFAULT_LAYERS, ...layerOverrides }
  if (base === 'terrain') layers.terrain3d = true

  useEffect(() => {
    let cancelled = false
    let map: MLMap | null = null
    loadLib()
      .then(({ maplibregl, dem }) => {
        if (cancelled || !container.current) return
        const contourUrl = dem.contourProtocolUrl({
          thresholds: { 9: [200, 1000], 10: [100, 500], 11: [100, 500], 12: [50, 250], 13: [20, 100], 14: [10, 50] },
          elevationKey: 'ele',
          levelKey: 'level',
          contourLayer: 'contours',
        })
        map = new maplibregl.Map({
          container: container.current,
          style: buildStyle(contourUrl, dem.sharedDemProtocolUrl),
          bounds: center ? undefined : bounds,
          center: center,
          zoom: zoom,
          pitch: pitch ?? 0,
          bearing: bearing ?? 0,
          maxPitch: 80,
          interactive,
          attributionControl: interactive ? { compact: true } : false,
          fadeDuration: 0,
        })
        mapRef.current = map
        if (interactive && showNavigation) {
          map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
          map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
        }
        map.on('load', () => {
          if (cancelled) return
          container.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
          setReady(true)
        })
        const el = container.current
        const ro = new ResizeObserver(() => map?.resize())
        ro.observe(el)
        map.once('remove', () => ro.disconnect())
        if (interactive) attachPopups(maplibregl, map)
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const set = (id: string, data: unknown) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as never)
    if (geo.river) set('river', geo.river)
    if (geo.reservoir) set('reservoir', geo.reservoir)
    if (geo.roads) set('roads', geo.roads)
    if (geo.settlements) set('settlements', geo.settlements)
    set('dam', {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name: TEHRI.dam.name }, geometry: { type: 'Point', coordinates: TEHRI.dam.lngLat } }],
    })
  }, [ready, geo.river, geo.reservoir, geo.roads, geo.settlements])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('flood') as GeoJSONSource).setData((flood ?? { type: 'FeatureCollection', features: [] }) as never)
  }, [ready, flood])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('exposure') as GeoJSONSource).setData((exposure ?? { type: 'FeatureCollection', features: [] }) as never)
  }, [ready, exposure])

  const layerKey = JSON.stringify(layers)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const vis = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')

    vis('satellite', base === 'satellite' || base === 'terrain')
    const showHillshade = base === 'hillshade' || base === 'contour' || layers.hillshade
    vis('hillshade', showHillshade)
    map.setPaintProperty('bg', 'background-color', base === 'hillshade' ? '#c6ccd6' : base === 'contour' ? '#231d15' : '#0c1322')
    map.setPaintProperty('hillshade', 'hillshade-exaggeration', base === 'hillshade' ? 0.85 : base === 'contour' ? 0.35 : 0.45)
    map.setPaintProperty('hillshade', 'hillshade-highlight-color', base === 'contour' ? '#3a3024' : '#ffffff')
    map.setPaintProperty('hillshade', 'hillshade-shadow-color', base === 'contour' ? '#0f0c08' : '#1f2430')
    const showContours = base === 'contour' || layers.contours
    vis('contour-lines', showContours)
    vis('contour-labels', showContours)
    vis('river-line', layers.river)
    vis('reservoir-fill', layers.dam)
    vis('reservoir-line', layers.dam)
    vis('dam-point', layers.dam)
    vis('dam-label', layers.dam)
    vis('roads-line', layers.roads)
    vis('flood-depth', layers.floodDepth)
    vis('flood-velocity', layers.floodVelocity)
    vis('flood-arrival', layers.arrivalTime)
    vis('observed-flood', layers.observedFlood)
    vis('settlements-circle', layers.settlements)
    vis('settlements-label', layers.settlements)
    vis('exposure-circle', layers.exposure)

    if (layers.terrain3d) {
      map.setTerrain({ source: 'dem', exaggeration })
      if (map.getPitch() < 20 && interactive) map.easeTo({ pitch: 60, duration: 800 })
    } else {
      map.setTerrain(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, base, layerKey, exaggeration, interactive])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const timeFilter = timeS === undefined ? null : (['<=', ['get', 'arrivalS'], timeS] as const)
    map.setFilter('flood-depth', timeFilter as never)
    map.setFilter('flood-velocity', timeFilter as never)
    map.setFilter('flood-arrival', (timeFilter ? ['all', ['==', ['get', 'band'], 0], timeFilter] : ['==', ['get', 'band'], 0]) as never)
  }, [ready, timeS])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    for (const id of ['flood-depth', 'flood-velocity', 'flood-arrival']) map.setPaintProperty(id, 'fill-opacity', floodOpacity)
  }, [ready, floodOpacity])

  return (
    <div className={cn('relative overflow-hidden bg-[#0c1322]', className)} role="region" aria-label={ariaLabel ?? label ?? 'Map'}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading map…</div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive">Map failed to load</div>
      )}
      {label && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground">
          {label}
        </span>
      )}
    </div>
  )
}

function attachPopups(maplibregl: MapLib, map: MLMap) {
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
  const html = (title: string, rows: [string, string][]) =>
    `<p style="font-weight:600;margin-bottom:4px">${escapeHtml(title)}</p>` +
    rows.map(([k, v]) => `<p style="display:flex;justify-content:space-between;gap:12px;color:#8d9ab5">${k}<span style="color:#e6ebf5;font-family:var(--font-mono)">${escapeHtml(v)}</span></p>`).join('')

  const onFlood = (e: MapMouseEvent & { features?: { properties: Record<string, number> }[] }) => {
    const p = e.features?.[0]?.properties
    if (!p) return
    const assetLayers = ['settlements-circle', 'exposure-circle'].filter(
      (l) => map.getLayoutProperty(l, 'visibility') !== 'none',
    )
    if (map.queryRenderedFeatures(e.point, { layers: assetLayers }).length) return
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        html(`Chainage ${formatNumber(p.chainageKm, 1)} km`, [
          ['Depth', `${formatNumber(p.depthM, 1)} m`],
          ['Peak depth', `${formatNumber(p.peakDepthM, 1)} m`],
          ['Velocity', `${formatNumber(p.velocityMs, 1)} m/s`],
          ['Arrival', formatClock(p.arrivalS)],
          ['Discharge', `${formatNumber(p.dischargeM3s)} m³/s`],
        ]),
      )
      .addTo(map)
  }
  const onAsset = (e: MapMouseEvent & { features?: { properties: Record<string, string> }[] }) => {
    const p = e.features?.[0]?.properties
    if (!p) return
    const rows: [string, string][] = [['Type', p.kind]]
    if (p.population && p.population !== 'null') rows.push(['Population', formatNumber(Number(p.population))])
    if (p.arrivalS) rows.push(['Arrival', formatClock(Number(p.arrivalS))])
    if (p.depthM) rows.push(['Depth', `${formatNumber(Number(p.depthM), 1)} m`])
    popup.setLngLat(e.lngLat).setHTML(html(p.name, rows)).addTo(map)
  }
  for (const id of ['flood-depth', 'flood-velocity', 'flood-arrival']) {
    map.on('click', id, onFlood as never)
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
  }
  for (const id of ['settlements-circle', 'exposure-circle']) {
    map.on('click', id, onAsset as never)
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
  }
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
