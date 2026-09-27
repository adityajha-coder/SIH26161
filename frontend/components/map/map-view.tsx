'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import { Plus, Minus, Compass, Maximize2, X } from 'lucide-react'
import { TEHRI } from '@/lib/case-study'
import { ATTRIBUTION, TILES, CESIUM_ION_TOKEN } from '@/lib/config'
import type { FloodBands } from '@/lib/flood-model'
import { formatClock, formatNumber } from '@/lib/format'
import { useGeoData } from '@/lib/geo'
import { cn } from '@/lib/utils'
import {
  DEFAULT_LAYERS,
  DEPTH_STOPS,
  VELOCITY_STOPS,
  ARRIVAL_STOPS,
  interpolateRampColor,
  type BaseMode,
  type LayerVisibility,
} from './map-style'

type CesiumType = typeof import('cesium')

let cesiumPromise: Promise<CesiumType> | null = null

function loadCesium(): Promise<CesiumType> {
  if (typeof window === 'undefined') {
    return new Promise(() => {})
  }
  if (!cesiumPromise) {
    cesiumPromise = (async () => {
      ;(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium'
      const Cesium = await import('cesium')
      if (CESIUM_ION_TOKEN) {
        Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN
      }
      return Cesium
    })()
  }
  return cesiumPromise
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
  showMaxExtent?: boolean
  cameraTarget?: { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce?: number } | null
}

interface PopupState {
  x: number
  y: number
  title: string
  rows: [string, string][]
}

// ── Strategic Corridor Hubs that always warrant prominent regional labels ──
const KEY_CORRIDOR_HUBS = new Set([
  'Tehri',
  'New Tehri',
  'Koteshwar',
  'Devprayag',
  'Rishikesh',
  'Haridwar',
  'Srinagar',
  'Chamba',
  'Kirtinagar',
  'Muni Ki Reti',
  'Kaudiyala',
  'Shivpuri',
  'Byasi',
  'Maletha',
])

interface DataSourcesMap {
  river: import('cesium').CustomDataSource
  reservoir: import('cesium').CustomDataSource
  roads: import('cesium').CustomDataSource
  dam: import('cesium').CustomDataSource
  settlements: import('cesium').CustomDataSource
  exposure: import('cesium').CustomDataSource
  flood: import('cesium').CustomDataSource
}

interface CachedViewerInstance {
  container: HTMLDivElement
  viewer: import('cesium').Viewer
  Cesium: CesiumType
  dataSources: DataSourcesMap
  currentBaseLayer: import('cesium').ImageryLayer | null
}

// Global cached singleton for primary interactive map to eliminate reload on tab/route switch
let persistentInstance: CachedViewerInstance | null = null

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
  center,
  zoom,
  pitch,
  bearing,
  className,
  label,
  ariaLabel,
  showMaxExtent = false,
  cameraTarget,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const cesiumRef = useRef<CesiumType | null>(null)
  const dataSourcesRef = useRef<Partial<DataSourcesMap>>({})
  const currentBaseLayerRef = useRef<import('cesium').ImageryLayer | null>(null)

  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [popup, setPopup] = useState<PopupState | null>(null)

  const geo = useGeoData()
  const layers: LayerVisibility = { ...DEFAULT_LAYERS, ...layerOverrides }
  if (base === 'terrain') layers.terrain3d = true

  // Helper to switch base imagery
  const updateBaseImagery = useCallback((Cesium: CesiumType, viewer: import('cesium').Viewer, mode: BaseMode) => {
    if (currentBaseLayerRef.current) {
      viewer.imageryLayers.remove(currentBaseLayerRef.current, true)
      currentBaseLayerRef.current = null
    }

    let url: string = TILES.satellite
    let credit: string = ATTRIBUTION.satellite

    if (mode === 'hillshade' || mode === 'contour') {
      url = TILES.dark
      credit = ATTRIBUTION.dark
    }

    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      credit,
      maximumLevel: 18,
    })

    const layer = viewer.imageryLayers.addImageryProvider(provider)
    currentBaseLayerRef.current = layer
    if (persistentInstance) {
      persistentInstance.currentBaseLayer = layer
    }
  }, [])

  // 1. Initialize or Re-Attach Cached Cesium Viewer
  useEffect(() => {
    let cancelled = false

    // Check if we can re-use the persistent instance (instant mount, zero reload)
    if (interactive && persistentInstance && !persistentInstance.viewer.isDestroyed()) {
      const inst = persistentInstance
      cesiumRef.current = inst.Cesium
      viewerRef.current = inst.viewer
      dataSourcesRef.current = inst.dataSources
      currentBaseLayerRef.current = inst.currentBaseLayer

      if (containerRef.current) {
        containerRef.current.appendChild(inst.container)
        inst.viewer.resize()
      }

      setReady(true)

      return () => {
        cancelled = true
        if (inst.container.parentElement) {
          inst.container.parentElement.removeChild(inst.container)
        }
        setReady(false)
      }
    }

    loadCesium()
      .then(async (Cesium) => {
        if (cancelled || !containerRef.current) return
        cesiumRef.current = Cesium

        const c = center ?? [78.47, 30.29]
        const z = zoom ?? 10.5
        const p = pitch ?? (base === 'terrain' ? 55 : 0)
        const b = bearing ?? (base === 'terrain' ? 190 : 0)
        const alt = Math.max(1500, 36000000 / Math.pow(2, z))

        // Create internal container for the viewer
        const viewerContainer = document.createElement('div')
        viewerContainer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;'
        containerRef.current.appendChild(viewerContainer)

        // Create hidden credit container to prevent default banner clutter
        const creditDiv = document.createElement('div')
        creditDiv.style.display = 'none'

        const viewer = new Cesium.Viewer(viewerContainer, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          scene3DOnly: true,
          creditContainer: creditDiv,
        })
        viewerRef.current = viewer

        // Atmospheric & Rendering Settings
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0C0C0C')
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0C0C0C')
        viewer.scene.globe.depthTestAgainstTerrain = true
        viewer.scene.verticalExaggeration = exaggeration
        viewer.scene.globe.enableLighting = false

        // Interactive controller permissions
        if (!interactive) {
          viewer.scene.screenSpaceCameraController.enableRotate = false
          viewer.scene.screenSpaceCameraController.enableTranslate = false
          viewer.scene.screenSpaceCameraController.enableZoom = false
          viewer.scene.screenSpaceCameraController.enableTilt = false
          viewer.scene.screenSpaceCameraController.enableLook = false
        }

        // Initialize DataSources
        const riverDs = new Cesium.CustomDataSource('river')
        const reservoirDs = new Cesium.CustomDataSource('reservoir')
        const roadsDs = new Cesium.CustomDataSource('roads')
        const damDs = new Cesium.CustomDataSource('dam')
        const settlementsDs = new Cesium.CustomDataSource('settlements')
        const exposureDs = new Cesium.CustomDataSource('exposure')
        const floodDs = new Cesium.CustomDataSource('flood')

        await Promise.all([
          viewer.dataSources.add(riverDs),
          viewer.dataSources.add(reservoirDs),
          viewer.dataSources.add(roadsDs),
          viewer.dataSources.add(damDs),
          viewer.dataSources.add(settlementsDs),
          viewer.dataSources.add(exposureDs),
          viewer.dataSources.add(floodDs),
        ])

        const dsMap: DataSourcesMap = {
          river: riverDs,
          reservoir: reservoirDs,
          roads: roadsDs,
          dam: damDs,
          settlements: settlementsDs,
          exposure: exposureDs,
          flood: floodDs,
        }
        dataSourcesRef.current = dsMap

        // Set Initial Camera
        const cesiumPitch = Cesium.Math.toRadians(p - 90)
        const cesiumHeading = Cesium.Math.toRadians(b)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(c[0], c[1], alt),
          orientation: {
            heading: cesiumHeading,
            pitch: cesiumPitch,
            roll: 0.0,
          },
        })

        // Try Loading World Terrain asynchronously
        try {
          const terrain = await Cesium.createWorldTerrainAsync({
            requestVertexNormals: true,
            requestWaterMask: true,
          })
          if (!cancelled && viewer && !viewer.isDestroyed()) {
            viewer.terrainProvider = terrain
          }
        } catch {
          // Terrain offline fallback continues seamlessly with ellipsoid
        }

        // Set Base Imagery Layer
        updateBaseImagery(Cesium, viewer, base)

        // Mouse click and hover handlers for rich popups
        if (interactive) {
          const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

          // Click handler
          handler.setInputAction((movement: { position: { x: number; y: number } }) => {
            const winPos = new Cesium.Cartesian2(movement.position.x, movement.position.y)
            const picked = viewer.scene.pick(winPos)
            if (Cesium.defined(picked) && picked.id && picked.id.properties) {
              const props = picked.id.properties.getValue(Cesium.JulianDate.now())
              if (!props) return

              // Check if settlement / asset
              if (props.name && (props.kind || props.population)) {
                const rows: [string, string][] = [['Type', props.kind ?? 'Settlement']]
                if (props.population && props.population !== 'null') {
                  rows.push(['Population', formatNumber(Number(props.population))])
                }
                if (props.arrivalS) rows.push(['Arrival', formatClock(Number(props.arrivalS))])
                if (props.depthM) rows.push(['Water Depth', `${formatNumber(Number(props.depthM), 1)} m`])

                setPopup({
                  x: movement.position.x,
                  y: movement.position.y,
                  title: String(props.name),
                  rows,
                })
                return
              }

              // Check if flood polygon
              if (props.depthM !== undefined || props.chainageKm !== undefined) {
                setPopup({
                  x: movement.position.x,
                  y: movement.position.y,
                  title: `Chainage ${formatNumber(Number(props.chainageKm ?? 0), 1)} km`,
                  rows: [
                    ['Depth', `${formatNumber(Number(props.depthM ?? 0), 1)} m`],
                    ['Peak Depth', `${formatNumber(Number(props.peakDepthM ?? props.depthM ?? 0), 1)} m`],
                    ['Velocity', `${formatNumber(Number(props.velocityMs ?? 0), 1)} m/s`],
                    ['Arrival', formatClock(Number(props.arrivalS ?? 0))],
                    ['Discharge', `${formatNumber(Number(props.dischargeM3s ?? 0))} m³/s`],
                  ],
                })
                return
              }
            }
            setPopup(null)
          }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

          // Hover handler for cursor pointer
          handler.setInputAction((movement: { endPosition: { x: number; y: number } }) => {
            const winPos = new Cesium.Cartesian2(movement.endPosition.x, movement.endPosition.y)
            const picked = viewer.scene.pick(winPos)
            if (Cesium.defined(picked) && picked.id && picked.id.properties) {
              viewer.scene.canvas.style.cursor = 'pointer'
            } else {
              viewer.scene.canvas.style.cursor = 'default'
            }
          }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        }

        // Cache for subsequent page visits if interactive
        if (interactive) {
          persistentInstance = {
            container: viewerContainer,
            viewer,
            Cesium,
            dataSources: dsMap,
            currentBaseLayer: currentBaseLayerRef.current,
          }
        }

        // ResizeObserver
        const ro = new ResizeObserver(() => {
          if (viewer && !viewer.isDestroyed()) {
            viewer.resize()
          }
        })
        ro.observe(containerRef.current)

        if (!cancelled) {
          setReady(true)
        }
      })
      .catch((err) => {
        console.error('Cesium failed to initialize:', err)
        setFailed(true)
      })

    return () => {
      cancelled = true
      if (interactive && persistentInstance) {
        // Keep instance warm in memory; detach DOM element without destroying WebGL context
        if (persistentInstance.container.parentElement) {
          persistentInstance.container.parentElement.removeChild(persistentInstance.container)
        }
      } else if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
      setReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Base Mode & Exaggeration Updates
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium) return

    updateBaseImagery(Cesium, viewer, base)
    viewer.scene.verticalExaggeration = exaggeration
  }, [ready, base, exaggeration, updateBaseImagery])

  // 3. Smooth Camera Angle Flight when switching between 3D Terrain and 2D Satellite
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium) return

    const c = center ?? [78.47, 30.29]
    const z = zoom ?? (base === 'terrain' ? 10.8 : 9.8)
    const p = pitch ?? (base === 'terrain' ? 60 : 0)
    const b = bearing ?? (base === 'terrain' ? 190 : 0)
    const alt = Math.max(1500, 36000000 / Math.pow(2, z))

    const cesiumPitch = Cesium.Math.toRadians(p - 90)
    const cesiumHeading = Cesium.Math.toRadians(b)

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(c[0], c[1], alt),
      orientation: {
        heading: cesiumHeading,
        pitch: cesiumPitch,
        roll: 0.0,
      },
      duration: 1.0,
    })
  }, [ready, base, center?.[0], center?.[1], zoom, pitch, bearing]) // eslint-disable-line react-hooks/exhaustive-deps

  // 4. Hydrology & Basemap Data Loaders (River, Reservoir, Roads, Dam, Decluttered Settlements)
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    const ds = dataSourcesRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !ds.river) return

    // ── River Network
    ds.river.entities.removeAll()
    if (geo.river?.features) {
      for (const f of geo.river.features) {
        const coords = extractPolylineCoords(f.geometry)
        for (const line of coords) {
          if (line.length >= 2) {
            ds.river.entities.add({
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(flattenCoords(line)),
                width: 3.5,
                material: Cesium.Color.fromCssColorString('#38bdf8'),
                clampToGround: true,
              },
            })
          }
        }
      }
    }

    // ── Reservoir
    ds.reservoir?.entities.removeAll()
    if (geo.reservoir?.features && ds.reservoir) {
      for (const f of geo.reservoir.features) {
        const rings = extractPolygonRings(f.geometry)
        for (const ring of rings) {
          if (ring.length >= 3) {
            ds.reservoir.entities.add({
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(flattenCoords(ring)),
                material: Cesium.Color.fromCssColorString('#0284c7').withAlpha(0.65),
                classificationType: Cesium.ClassificationType.TERRAIN,
              },
            })
          }
        }
      }
    }

    // ── Roads
    ds.roads?.entities.removeAll()
    if (geo.roads?.features && ds.roads) {
      for (const f of geo.roads.features) {
        const lines = extractPolylineCoords(f.geometry)
        for (const line of lines) {
          if (line.length >= 2) {
            ds.roads.entities.add({
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(flattenCoords(line)),
                width: 1.5,
                material: Cesium.Color.fromCssColorString('#cbd5e1').withAlpha(0.6),
                clampToGround: true,
              },
            })
          }
        }
      }
    }

    // ── Tehri Dam Marker
    ds.dam?.entities.removeAll()
    if (ds.dam) {
      ds.dam.entities.add({
        position: Cesium.Cartesian3.fromDegrees(TEHRI.dam.lngLat[0], TEHRI.dam.lngLat[1]),
        properties: { name: TEHRI.dam.name, kind: 'Major Hydroelectric Dam' },
        point: {
          pixelSize: 11,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#0b1220'),
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: TEHRI.dam.name,
          font: '600 12px "Poppins", sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#0b1220'),
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(12, 12, 12, 0.85)'),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
          pixelOffset: new Cesium.Cartesian2(0, -18),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
    }

    // ── Decluttered Settlements with Strict Hierarchy ──
    ds.settlements?.entities.removeAll()
    if (geo.settlements?.features && ds.settlements) {
      for (const f of geo.settlements.features) {
        if (f.geometry.type === 'Point') {
          const [lng, lat] = f.geometry.coordinates as [number, number]
          const p = (f.properties ?? {}) as { name: string; kind?: string; population?: number }
          const kind = p.kind ?? 'hamlet'
          const isCityOrTown = kind === 'city' || kind === 'town'
          const isKeyHub = isCityOrTown || KEY_CORRIDOR_HUBS.has(p.name)

          // 1. Strategic Regional Hubs (Haridwar, Rishikesh, Devprayag, Tehri, etc.)
          if (isKeyHub) {
            ds.settlements.entities.add({
              position: Cesium.Cartesian3.fromDegrees(lng, lat),
              properties: p,
              point: {
                pixelSize: 8,
                color: Cesium.Color.fromCssColorString('#fbbf24'),
                outlineColor: Cesium.Color.fromCssColorString('#1f2937'),
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
              label: {
                text: p.name,
                font: '600 12px "Poppins", sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.fromCssColorString('#f8fafc'),
                outlineColor: Cesium.Color.fromCssColorString('#0b1220'),
                outlineWidth: 2,
                showBackground: true,
                backgroundColor: Cesium.Color.fromCssColorString('rgba(12, 12, 12, 0.85)'),
                backgroundPadding: new Cesium.Cartesian2(6, 3),
                pixelOffset: new Cesium.Cartesian2(0, -14),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 140000),
              },
            })
            continue
          }

          // 2. Villages (Only show point up to 25km, label ONLY within 10km)
          if (kind === 'village') {
            ds.settlements.entities.add({
              position: Cesium.Cartesian3.fromDegrees(lng, lat),
              properties: p,
              point: {
                pixelSize: 4,
                color: Cesium.Color.fromCssColorString('#fbbf24'),
                outlineColor: Cesium.Color.fromCssColorString('#1f2937'),
                outlineWidth: 1.5,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 28000),
              },
              label: {
                text: p.name,
                font: '500 10px "Poppins", sans-serif',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.fromCssColorString('#e2e8f0'),
                outlineColor: Cesium.Color.fromCssColorString('#0b1220'),
                outlineWidth: 1.5,
                showBackground: true,
                backgroundColor: Cesium.Color.fromCssColorString('rgba(12, 12, 12, 0.8)'),
                backgroundPadding: new Cesium.Cartesian2(4, 2),
                pixelOffset: new Cesium.Cartesian2(0, -10),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000),
              },
            })
            continue
          }

          // 3. Hamlets (Tiny clusters: points only within 5km, labels only within 3km)
          if (kind === 'hamlet') {
            ds.settlements.entities.add({
              position: Cesium.Cartesian3.fromDegrees(lng, lat),
              properties: p,
              point: {
                pixelSize: 2.5,
                color: Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.7),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000),
              },
              label: {
                text: p.name,
                font: '400 9px "Poppins", sans-serif',
                fillColor: Cesium.Color.fromCssColorString('#94a3b8'),
                outlineColor: Cesium.Color.fromCssColorString('#0b1220'),
                outlineWidth: 1,
                pixelOffset: new Cesium.Cartesian2(0, -8),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000),
              },
            })
          }
        }
      }
    }
  }, [ready, geo.river, geo.reservoir, geo.roads, geo.settlements])

  // 5. Exposure Layer (Hospitals, Schools, Critical Assets)
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    const ds = dataSourcesRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !ds.exposure) return

    ds.exposure.entities.removeAll()
    if (!exposure?.features) return

    for (const f of exposure.features) {
      if (f.geometry.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates as [number, number]
        const p = (f.properties ?? {}) as { name: string; kind?: string; population?: number; arrivalS?: number; depthM?: number }
        const isMed = p.kind === 'hospital' || p.kind === 'clinic'
        const isEdu = p.kind === 'school' || p.kind === 'college'
        const col = isMed ? '#ef4444' : isEdu ? '#ffffff' : '#f59e0b'

        ds.exposure.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          properties: p,
          point: {
            pixelSize: 7,
            color: Cesium.Color.fromCssColorString(col),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 45000),
          },
          label: {
            text: p.name,
            font: '500 10px "Poppins", sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: Cesium.Color.fromCssColorString(col),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString('rgba(12, 12, 12, 0.8)'),
            backgroundPadding: new Cesium.Cartesian2(4, 2),
            pixelOffset: new Cesium.Cartesian2(0, -12),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 18000),
          },
        })
      }
    }
  }, [ready, exposure])

  // 6. Flood Inundation Polygons (Geometry + Ramp Color Clamped to Ground)
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    const ds = dataSourcesRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !ds.flood) return

    ds.flood.entities.removeAll()
    if (!flood?.features || flood.features.length === 0) return

    const isArrival = Boolean(layers.arrivalTime)
    const isVelocity = Boolean(layers.floodVelocity)

    for (let i = 0; i < flood.features.length; i++) {
      const f = flood.features[i]
      const p = (f.properties ?? {}) as {
        depthM?: number
        velocityMs?: number
        arrivalS?: number
        chainageKm?: number
        peakDepthM?: number
        dischargeM3s?: number
      }

      // Pick color according to active simulation metric
      let hexColor = '#2563eb'
      if (isArrival) {
        hexColor = interpolateRampColor(p.arrivalS ?? 0, ARRIVAL_STOPS)
      } else if (isVelocity) {
        hexColor = interpolateRampColor(p.velocityMs ?? 0, VELOCITY_STOPS)
      } else {
        hexColor = interpolateRampColor(p.depthM ?? 0, DEPTH_STOPS)
      }

      const rings = extractPolygonRings(f.geometry)
      for (const ring of rings) {
        if (ring.length >= 3) {
          const flat = flattenCoords(ring)
          ds.flood.entities.add({
            properties: p,
            show: showMaxExtent || (timeS !== undefined ? (p.arrivalS ?? 0) <= timeS : true),
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
              material: Cesium.Color.fromCssColorString(hexColor).withAlpha(floodOpacity),
              classificationType: Cesium.ClassificationType.TERRAIN,
            },
          })
        }
      }
    }
  }, [ready, flood, layers.arrivalTime, layers.floodVelocity, layers.floodDepth, floodOpacity, showMaxExtent])

  // 7. Fast Simulation Playback Slider Updates (Throttle-free entity.show update)
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ready || !ds.flood) return

    const t = timeS ?? 0
    const entities = ds.flood.entities.values

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i]
      const arrival = Number((e.properties?.arrivalS as { getValue?: () => unknown })?.getValue?.() ?? 0)
      e.show = showMaxExtent || arrival <= t
    }
  }, [ready, timeS, showMaxExtent])

  // 8. Layer Visibility Toggles
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ready) return

    if (ds.river) ds.river.show = Boolean(layers.river)
    if (ds.reservoir) ds.reservoir.show = Boolean(layers.dam)
    if (ds.dam) ds.dam.show = Boolean(layers.dam)
    if (ds.roads) ds.roads.show = Boolean(layers.roads)
    if (ds.settlements) ds.settlements.show = Boolean(layers.settlements)
    if (ds.exposure) ds.exposure.show = Boolean(layers.exposure)
    if (ds.flood) ds.flood.show = Boolean(layers.floodDepth || layers.floodVelocity || layers.arrivalTime)
  }, [
    ready,
    layers.river,
    layers.dam,
    layers.roads,
    layers.settlements,
    layers.exposure,
    layers.floodDepth,
    layers.floodVelocity,
    layers.arrivalTime,
  ])

  // 9. Smooth Camera Target Fly-To
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !cameraTarget) return

    const targetAlt = cameraTarget.zoom ? Math.max(1400, 36000000 / Math.pow(2, cameraTarget.zoom)) : 18000
    const heading = cameraTarget.bearing !== undefined ? Cesium.Math.toRadians(cameraTarget.bearing) : viewer.camera.heading
    const pitchVal = cameraTarget.pitch !== undefined ? Cesium.Math.toRadians(cameraTarget.pitch - 90) : viewer.camera.pitch

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cameraTarget.center[0], cameraTarget.center[1], targetAlt),
      orientation: {
        heading,
        pitch: pitchVal,
        roll: 0.0,
      },
      duration: 1.4,
    })
  }, [ready, cameraTarget?.nonce, cameraTarget?.center?.[0], cameraTarget?.center?.[1], cameraTarget?.zoom, cameraTarget?.pitch, cameraTarget?.bearing])

  // Camera Navigation Controls
  const handleZoom = (inOut: 'in' | 'out') => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    const alt = viewer.camera.positionCartographic.height
    const factor = inOut === 'in' ? 0.65 : 1.45
    viewer.camera.zoomIn(alt * (1 - factor) * -1)
  }

  const handleResetHeading = () => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || viewer.isDestroyed() || !Cesium) return
    const current = viewer.camera.positionCartographic
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(current.longitude, current.latitude, current.height),
      orientation: {
        heading: 0,
        pitch: viewer.camera.pitch,
        roll: 0,
      },
      duration: 0.8,
    })
  }

  const handleTiltToggle = () => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || viewer.isDestroyed() || !Cesium) return
    const isTilted = Cesium.Math.toDegrees(viewer.camera.pitch) < -45
    const nextPitch = isTilted ? -90 : -35
    const current = viewer.camera.positionCartographic
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(current.longitude, current.latitude, current.height),
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(nextPitch),
        roll: 0,
      },
      duration: 0.8,
    })
  }

  return (
    <div className={cn('relative overflow-hidden bg-[#0C0C0C]', className)} role="region" aria-label={ariaLabel ?? label ?? 'Cesium 3D Globe'}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Loading & Error States */}
      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-[#0C0C0C]">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-white/60 animate-ping" />
            Initializing Cesium 3D Globe…
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive bg-[#0C0C0C]">
          3D Globe failed to initialize (WebGL unavailable)
        </div>
      )}

      {/* Sleek On-Map Navigation Controls */}
      {interactive && showNavigation && ready && (
        <div className="pointer-events-auto absolute top-20 right-4 z-10 flex flex-col gap-1 rounded-2xl map-hud-panel p-1">
          <button
            type="button"
            onClick={() => handleZoom('in')}
            title="Zoom In"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('out')}
            title="Zoom Out"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Minus className="size-3.5" />
          </button>
          <div className="my-0.5 h-px w-full bg-white/[0.08]" />
          <button
            type="button"
            onClick={handleResetHeading}
            title="Reset North Orientation"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Compass className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleTiltToggle}
            title="Toggle 3D Perspective Tilt"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      )}

      {/* Rich Interactive Entity Popup */}
      {popup && (
        <div
          className="cesium-hud-popup absolute max-w-[270px] -translate-x-1/2 -translate-y-[calc(100%+12px)] pointer-events-auto"
          style={{ left: popup.x, top: popup.y }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-1.5 mb-2">
            <span className="font-semibold text-white text-xs">{popup.title}</span>
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {popup.rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-[11px] text-white/60">
                <span>{k}</span>
                <span className="font-mono font-medium text-white tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Label Badge */}
      {label && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-xl bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground border border-white/[0.06] backdrop-blur-md">
          {label}
        </span>
      )}
    </div>
  )
}

// ── Helpers for GeoJSON parsing into Cesium geometries ───────────────
function flattenCoords(positions: Position[]): number[] {
  const out: number[] = []
  for (const pos of positions) {
    out.push(pos[0], pos[1])
  }
  return out
}

function extractPolylineCoords(geometry: Geometry): Position[][] {
  if (geometry.type === 'LineString') {
    return [geometry.coordinates]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates
  }
  return []
}

function extractPolygonRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(1)
  }
  return []
}
