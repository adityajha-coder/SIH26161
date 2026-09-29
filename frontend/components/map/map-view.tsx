'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { FeatureCollection, Geometry, Position } from 'geojson'
import {
  Plus,
  Minus,
  Compass,
  Maximize2,
  X,
  Video,
  Play,
  Pause,
  SkipForward,
  SkipBack,
} from 'lucide-react'
import { CASES, type CaseStudy } from '@/lib/case-study'
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
  activeCase?: CaseStudy
  onSelectCase?: (caseId: string) => void
  isDroneTour?: boolean
  onToggleDroneTour?: (active: boolean) => void
}

// Drone Tour Helper Types & Functions
interface TourWaypoint {
  name: string
  lngLat: [number, number]
  chainageKm: number
  description?: string
}

function buildTourWaypoints(activeCase?: CaseStudy): TourWaypoint[] {
  if (!activeCase) {
    return [
      { name: 'Tehri Dam Crest (Breach Point)', lngLat: [78.4808, 30.3778], chainageKm: 0 },
      { name: 'Koteshwar Dam Reach', lngLat: [78.4972, 30.2622], chainageKm: 15 },
      { name: 'Devprayag Confluence (Alaknanda + Bhagirathi)', lngLat: [78.5986, 30.1459], chainageKm: 42 },
      { name: 'Byasi / Kaudiyala Canyon', lngLat: [78.4500, 30.1100], chainageKm: 65 },
      { name: 'Rishikesh Himalayan Gateway', lngLat: [78.2932, 30.1086], chainageKm: 84 },
      { name: 'Haridwar Gangetic Floodplain', lngLat: [78.1710, 29.9565], chainageKm: 105 },
    ]
  }

  const list: TourWaypoint[] = []

  // 1. Dam breach inception point
  list.push({
    name: `${activeCase.dam.name} (Breach Point)`,
    lngLat: activeCase.dam.lngLat,
    chainageKm: 0,
    description: `${activeCase.dam.type} · Elev ${activeCase.dam.crestElevationM || activeCase.dam.heightM}m`,
  })

  // 2. Downstream towns & key corridor landmarks
  if (activeCase.downstreamTowns && activeCase.downstreamTowns.length > 0) {
    for (const town of activeCase.downstreamTowns) {
      list.push({
        name: town.name,
        lngLat: town.lngLat,
        chainageKm: town.chainageKm,
        description: `Corridor Sector · Chainage ${town.chainageKm} km`,
      })
    }
  } else if (activeCase.riverReachCoordinates && activeCase.riverReachCoordinates.length > 1) {
    for (let i = 1; i < activeCase.riverReachCoordinates.length; i++) {
      const coord = activeCase.riverReachCoordinates[i]
      const approxKm = Math.round((i / (activeCase.riverReachCoordinates.length - 1)) * activeCase.reachKm)
      list.push({
        name: `${activeCase.river} Sector ${i}`,
        lngLat: coord,
        chainageKm: approxKm,
      })
    }
  }

  return list.sort((a, b) => a.chainageKm - b.chainageKm)
}

function computeBearing(p1: [number, number], p2: [number, number]): number {
  const lon1 = (p1[0] * Math.PI) / 180
  const lat1 = (p1[1] * Math.PI) / 180
  const lon2 = (p2[0] * Math.PI) / 180
  const lat2 = (p2[1] * Math.PI) / 180
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}

function getTourAltitude(caseId?: string, chainageRatio = 0): number {
  if (caseId === 'sardar-sarovar-dam') return 1600
  if (caseId === 'bhakra-dam') return 1900
  if (caseId === 'idukki-dam') return 2200
  // Default (Tehri / Himalayan canyon descent): 2600m down to 1500m
  return Math.round(2600 - chainageRatio * 1100)
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
  activeCase,
  onSelectCase,
  isDroneTour: isDroneTourProp,
  onToggleDroneTour,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const cesiumRef = useRef<CesiumType | null>(null)
  const dataSourcesRef = useRef<Partial<DataSourcesMap>>({})
  const currentBaseLayerRef = useRef<import('cesium').ImageryLayer | null>(null)
  const lastFlownCaseIdRef = useRef<string | null>(null)
  const lastFlownBaseRef = useRef<BaseMode | null>(null)
  const isFirstFlightRef = useRef(true)
  const loadedCaseIdRef = useRef<string | null>(null)
  const spraySystemRef = useRef<any>(null)
  const crestEntityRef = useRef<any>(null)

  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [popup, setPopup] = useState<PopupState | null>(null)

  // 3D Drone Tour / Follow the Wave Camera Animation State 
  const [internalDroneTour, setInternalDroneTour] = useState(false)
  const isDroneTour = isDroneTourProp !== undefined ? isDroneTourProp : internalDroneTour
  const [tourPaused, setTourPaused] = useState(false)
  const [tourSpeed, setTourSpeed] = useState<1 | 2 | 4>(1)
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0)

  const tourActiveRef = useRef(false)
  const tourPausedRef = useRef(false)
  const tourSpeedRef = useRef<1 | 2 | 4>(1)
  const currentWaypointIndexRef = useRef(0)

  const tourWaypoints = useMemo(() => buildTourWaypoints(activeCase), [activeCase])

  const flyToTourWaypoint = useCallback(
    (index: number) => {
      const viewer = viewerRef.current
      const Cesium = cesiumRef.current
      if (!viewer || viewer.isDestroyed() || !Cesium) return

      const waypoints = buildTourWaypoints(activeCase)
      if (waypoints.length === 0) return

      const safeIdx = Math.max(0, Math.min(index, waypoints.length - 1))
      currentWaypointIndexRef.current = safeIdx
      setCurrentWaypointIdx(safeIdx)

      const curr = waypoints[safeIdx]
      const next = waypoints[(safeIdx + 1) % waypoints.length]

      const headingDeg = computeBearing(curr.lngLat, next.lngLat)
      const headingRad = Cesium.Math.toRadians(headingDeg)
      const pitchRad = Cesium.Math.toRadians(-32)

      const maxKm = activeCase?.reachKm || 100
      const ratio = Math.min(1, Math.max(0, curr.chainageKm / maxKm))
      const alt = getTourAltitude(activeCase?.id, ratio)

      const duration = Math.max(2.5, 7.0 / tourSpeedRef.current)

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(curr.lngLat[0], curr.lngLat[1], alt),
        orientation: {
          heading: headingRad,
          pitch: pitchRad,
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.SINUSOIDAL_IN_OUT,
        complete: () => {
          if (!tourActiveRef.current || tourPausedRef.current) return
          if (safeIdx === waypoints.length - 1) {
            // Reached terminus of corridor - hold 2.5s then loop to breach inception
            setTimeout(() => {
              if (tourActiveRef.current && !tourPausedRef.current) {
                flyToTourWaypoint(0)
              }
            }, 2500)
          } else {
            flyToTourWaypoint(safeIdx + 1)
          }
        },
        cancel: () => {
          // Flight interrupted or cancelled
        },
      })
    },
    [activeCase]
  )

  const handleToggleDroneTour = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const nextState = !isDroneTour
    tourActiveRef.current = nextState
    tourPausedRef.current = false
    setTourPaused(false)
    if (isDroneTourProp === undefined) {
      setInternalDroneTour(nextState)
    }
    if (onToggleDroneTour) {
      onToggleDroneTour(nextState)
    }

    if (nextState) {
      flyToTourWaypoint(0)
    } else {
      viewer.camera.cancelFlight()
    }
  }, [isDroneTour, isDroneTourProp, onToggleDroneTour, flyToTourWaypoint])

  const handleTogglePauseTour = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (tourPaused) {
      tourPausedRef.current = false
      setTourPaused(false)
      flyToTourWaypoint(currentWaypointIndexRef.current)
    } else {
      tourPausedRef.current = true
      setTourPaused(true)
      viewer.camera.cancelFlight()
    }
  }, [tourPaused, flyToTourWaypoint])

  const handleNextWaypoint = useCallback(() => {
    const next = (currentWaypointIndexRef.current + 1) % tourWaypoints.length
    flyToTourWaypoint(next)
  }, [tourWaypoints.length, flyToTourWaypoint])

  const handlePrevWaypoint = useCallback(() => {
    const prev = (currentWaypointIndexRef.current - 1 + tourWaypoints.length) % tourWaypoints.length
    flyToTourWaypoint(prev)
  }, [tourWaypoints.length, flyToTourWaypoint])

  const handleCycleTourSpeed = useCallback(() => {
    const nextSpeed: 1 | 2 | 4 = tourSpeed === 1 ? 2 : tourSpeed === 2 ? 4 : 1
    tourSpeedRef.current = nextSpeed
    setTourSpeed(nextSpeed)
    if (!tourPausedRef.current && tourActiveRef.current) {
      flyToTourWaypoint(currentWaypointIndexRef.current)
    }
  }, [tourSpeed, flyToTourWaypoint])

  const handleStopDroneTour = useCallback(() => {
    const viewer = viewerRef.current
    if (viewer && !viewer.isDestroyed()) {
      viewer.camera.cancelFlight()
    }
    tourActiveRef.current = false
    tourPausedRef.current = false
    setTourPaused(false)
    if (isDroneTourProp === undefined) {
      setInternalDroneTour(false)
    }
    if (onToggleDroneTour) {
      onToggleDroneTour(false)
    }
  }, [isDroneTourProp, onToggleDroneTour])

  // Reset or re-fly if active dam changes during active tour
  useEffect(() => {
    if (tourActiveRef.current) {
      currentWaypointIndexRef.current = 0
      setCurrentWaypointIdx(0)
      flyToTourWaypoint(0)
    }
  }, [activeCase?.id, flyToTourWaypoint])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tourActiveRef.current = false
    }
  }, [])

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

        const c = center ?? (activeCase?.center ?? activeCase?.dam.lngLat ?? [78.47, 30.29])
        const z = zoom ?? (activeCase?.zoom ?? 10.5)
        const p = pitch ?? (activeCase?.pitch ?? (base === 'terrain' ? 55 : 0))
        const b = bearing ?? (activeCase?.bearing ?? (base === 'terrain' ? 190 : 0))
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

              // Check if dam marker
              if (props.caseId) {
                const rows: [string, string][] = [
                  ['Structure', props.kind ?? 'Dam'],
                  ['River Basin', props.river ?? '—'],
                  ['Structural Height', props.height ?? '—'],
                  ['Gross Storage', props.storage ?? '—'],
                ]
                if (props.state) rows.push(['State', props.state])
                if (props.isActive) rows.push(['Status', 'Active Benchmark Case'])
                setPopup({
                  x: movement.position.x,
                  y: movement.position.y,
                  title: String(props.name),
                  rows,
                })
                if (onSelectCase && props.caseId !== activeCase?.id) {
                  onSelectCase(props.caseId)
                }
                return
              }

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
      if (spraySystemRef.current && viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.scene.primitives.remove(spraySystemRef.current)
        } catch {
          // ignore
        }
        spraySystemRef.current = null
      }
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

  // 3. Smooth Camera Angle Flight when switching between 3D Terrain and 2D Satellite or switching active dam
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium) return

    // Prevent camera jump/re-flight on initial render or re-mounting
    if (isFirstFlightRef.current) {
      isFirstFlightRef.current = false
      lastFlownCaseIdRef.current = activeCase?.id ?? null
      lastFlownBaseRef.current = base
      return
    }

    // Only fly if base or activeCase actually changed
    if (lastFlownCaseIdRef.current === activeCase?.id && lastFlownBaseRef.current === base) {
      return
    }
    lastFlownCaseIdRef.current = activeCase?.id ?? null
    lastFlownBaseRef.current = base

    const c = center ?? (activeCase?.center ?? activeCase?.dam.lngLat ?? [78.47, 30.29])
    const z = zoom ?? (activeCase?.zoom ?? (base === 'terrain' ? 10.8 : 9.8))
    const p = pitch ?? (activeCase?.pitch ?? (base === 'terrain' ? 60 : 0))
    const b = bearing ?? (activeCase?.bearing ?? (base === 'terrain' ? 190 : 0))
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
      duration: 1.4,
    })
  }, [ready, base, activeCase?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 4. Hydrology & Basemap Data Loaders (River, Reservoir, Roads, Dam, Decluttered Settlements)
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    const ds = dataSourcesRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !ds.river) return

    // Avoid clearing and re-rendering if already loaded for this case study
    if (loadedCaseIdRef.current === activeCase?.id && ds.river.entities.values.length > 0) {
      return
    }
    loadedCaseIdRef.current = activeCase?.id ?? null

    // ── River Network
    ds.river.entities.removeAll()
    if (activeCase?.id === 'tehri-dam' && geo.river?.features) {
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
    } else if (activeCase?.riverReachCoordinates && activeCase.riverReachCoordinates.length >= 2) {
      ds.river.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(flattenCoords(activeCase.riverReachCoordinates)),
          width: 4.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString('#38bdf8'),
          }),
          clampToGround: true,
        },
      })
    }

    // ── Reservoir
    ds.reservoir?.entities.removeAll()
    if (geo.reservoir?.features && ds.reservoir && (!activeCase || activeCase.id === 'tehri-dam')) {
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
    if (geo.roads?.features && ds.roads && (!activeCase || activeCase.id === 'tehri-dam')) {
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

    // All Dam Markers
    ds.dam?.entities.removeAll()
    if (ds.dam) {
      for (const cs of CASES) {
        const isActive = activeCase ? cs.id === activeCase.id : cs.id === 'tehri-dam'
        ds.dam.entities.add({
          position: Cesium.Cartesian3.fromDegrees(cs.dam.lngLat[0], cs.dam.lngLat[1]),
          properties: {
            caseId: cs.id,
            name: cs.dam.name,
            kind: `${cs.dam.type} (${cs.state})`,
            height: cs.dam.heightM > 0 ? `${cs.dam.heightM} m` : 'Debris Lake',
            storage: cs.dam.grossStorageMcm > 0 ? `${cs.dam.grossStorageMcm} MCM` : '—',
            river: cs.river,
            state: cs.state,
            isActive,
          },
          point: {
            pixelSize: isActive ? 14 : 9,
            color: isActive ? Cesium.Color.fromCssColorString('#38bdf8') : Cesium.Color.WHITE,
            outlineColor: isActive ? Cesium.Color.fromCssColorString('#0284c7') : Cesium.Color.fromCssColorString('#0b1220'),
            outlineWidth: isActive ? 3.5 : 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: isActive ? `★ ${cs.dam.name}` : cs.dam.name,
            font: isActive ? '700 13px "Poppins", sans-serif' : '600 11px "Poppins", sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: isActive ? Cesium.Color.fromCssColorString('#38bdf8') : Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#0b1220'),
            outlineWidth: 3,
            showBackground: true,
            backgroundColor: isActive
              ? Cesium.Color.fromCssColorString('rgba(14, 165, 233, 0.35)')
              : Cesium.Color.fromCssColorString('rgba(12, 12, 12, 0.85)'),
            backgroundPadding: new Cesium.Cartesian2(6, 4),
            pixelOffset: new Cesium.Cartesian2(0, -18),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        })
      }
    }

    // Decluttered Settlements with Strict Hierarchy
    ds.settlements?.entities.removeAll()
    if (activeCase?.id === 'tehri-dam' && geo.settlements?.features && ds.settlements) {
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

    // ── Downstream Risk Centers for activeCase
    if (activeCase?.downstreamTowns && ds.settlements) {
      for (const town of activeCase.downstreamTowns) {
        ds.settlements.entities.add({
          position: Cesium.Cartesian3.fromDegrees(town.lngLat[0], town.lngLat[1]),
          properties: {
            name: town.name,
            kind: 'Downstream Risk Center',
            chainageKm: town.chainageKm,
          },
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#fbbf24'),
            outlineColor: Cesium.Color.fromCssColorString('#1f2937'),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: `${town.name} (${town.chainageKm} km)`,
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
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 160000),
          },
        })
      }
    }
  }, [ready, activeCase, geo.river, geo.reservoir, geo.roads, geo.settlements])

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

  // 6. Flood Inundation Polygons with Physical Water Multi-Depth Attenuation
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    const ds = dataSourcesRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !ds.flood) return

    ds.flood.entities.removeAll()
    crestEntityRef.current = null
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
        band?: number
      }

      // Pick color and alpha according to physical hydrodynamic state
      let hexColor = '#0284c7'
      let bandAlpha = floodOpacity
      if (isArrival) {
        hexColor = interpolateRampColor(p.arrivalS ?? 0, ARRIVAL_STOPS)
        bandAlpha = p.band === 0 ? floodOpacity * 0.48 : p.band === 1 ? floodOpacity * 0.72 : floodOpacity * 0.90
      } else if (isVelocity) {
        hexColor = interpolateRampColor(p.velocityMs ?? 0, VELOCITY_STOPS)
        bandAlpha = p.band === 0 ? floodOpacity * 0.52 : p.band === 1 ? floodOpacity * 0.74 : floodOpacity * 0.92
      } else {
        hexColor = interpolateRampColor(p.depthM ?? 0, DEPTH_STOPS)
        // Multi-depth extinction for realistic water:
        // Band 0 (shallow margin): soft edge blending with terrain DEM
        // Band 1 (mid channel): rich hydraulic azure
        // Band 2 (core thalweg): deep dense navy in river canyon
        if (p.band === 0) {
          bandAlpha = floodOpacity * 0.42
        } else if (p.band === 1) {
          bandAlpha = floodOpacity * 0.68
        } else {
          bandAlpha = floodOpacity * 0.88
        }
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
              material: Cesium.Color.fromCssColorString(hexColor).withAlpha(bandAlpha),
              classificationType: Cesium.ClassificationType.TERRAIN,
            },
          })
        }
      }
    }
  }, [ready, flood, layers.arrivalTime, layers.floodVelocity, layers.floodDepth, floodOpacity, showMaxExtent])

  // 7. Dynamic Flood Playback & Wave Front Particle System Updates
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    const ds = dataSourcesRef.current
    if (!ready || !viewer || viewer.isDestroyed() || !Cesium || !ds.flood) return

    const t = timeS ?? 0
    const entities = ds.flood.entities.values

    // Update flood polygon entity visibility according to wave arrival
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i]
      if (e.id === 'active-bore-crest') continue
      const raw = (e.properties as any)?.arrivalS
      const arrival = typeof raw?.getValue === 'function'
        ? Number(raw.getValue() ?? (raw as any)?._value ?? 0)
        : Number((raw as any)?._value ?? raw ?? 0)
      e.show = showMaxExtent || arrival <= t
    }

    // Initialize or update the turbulent wave front spray ParticleSystem
    if (!spraySystemRef.current && viewer.scene) {
      const sprayCanvas = document.createElement('canvas')
      sprayCanvas.width = 32
      sprayCanvas.height = 32
      const ctx = sprayCanvas.getContext('2d')
      if (ctx) {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
        grad.addColorStop(0.35, 'rgba(224, 242, 254, 0.80)')
        grad.addColorStop(0.7, 'rgba(186, 230, 253, 0.25)')
        grad.addColorStop(1, 'rgba(186, 230, 253, 0.0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(16, 16, 16, 0, Math.PI * 2)
        ctx.fill()
      }

      const spray = new Cesium.ParticleSystem({
        image: sprayCanvas,
        startColor: new Cesium.Color(1.0, 1.0, 1.0, 0.85),
        endColor: new Cesium.Color(0.70, 0.85, 1.0, 0.0),
        startScale: 1.2,
        endScale: 4.8,
        minimumParticleLife: 0.6,
        maximumParticleLife: 1.5,
        minimumSpeed: 4.0,
        maximumSpeed: 14.0,
        imageSize: new Cesium.Cartesian2(24, 24),
        emissionRate: 50,
        emitter: new Cesium.CircleEmitter(30.0),
        modelMatrix: Cesium.Matrix4.IDENTITY,
        show: false,
      })
      viewer.scene.primitives.add(spray)
      spraySystemRef.current = spray
    }

    const spray = spraySystemRef.current
    const isFloodLayerVisible = Boolean(layers.floodDepth || layers.floodVelocity || layers.arrivalTime)

    // Position the spray system at the active moving wave front tip
    if (t <= 0 || !flood?.features || flood.features.length === 0 || showMaxExtent || !isFloodLayerVisible) {
      if (spray) spray.show = false
      if (crestEntityRef.current) crestEntityRef.current.show = false
      return
    }

    // Find the latest station or feature reached by current time
    let activeFeature: any = null
    let maxArrival = -1

    let totalMaxArrival = 0
    for (let i = 0; i < flood.features.length; i++) {
      const f = flood.features[i]
      const arr = Number(f.properties?.arrivalS ?? 0)
      if (arr > totalMaxArrival) totalMaxArrival = arr
      if (arr <= t && arr > maxArrival) {
        maxArrival = arr
        activeFeature = f
      }
    }

    // When the flood wave has completed reaching the final terminus, dissipate the surge spray
    if (totalMaxArrival > 0 && t >= totalMaxArrival + 15) {
      if (spray) spray.show = false
      if (crestEntityRef.current) crestEntityRef.current.show = false
      return
    }

    if (!activeFeature || maxArrival < 0) {
      if (spray) spray.show = false
      if (crestEntityRef.current) crestEntityRef.current.show = false
      return
    }

    // Extract tip coordinates
    const geom = activeFeature.geometry
    let tipLngLat: [number, number] | null = null
    if (geom.type === 'Polygon' && geom.coordinates[0]?.[0]) {
      tipLngLat = geom.coordinates[0][0] as [number, number]
    } else if (geom.type === 'MultiPolygon' && geom.coordinates[0]?.[0]?.[0]) {
      tipLngLat = geom.coordinates[0][0][0] as [number, number]
    }

    if (tipLngLat) {
      if (spray) {
        spray.show = true
        const cart = Cesium.Cartesian3.fromDegrees(tipLngLat[0], tipLngLat[1], 15)
        spray.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(cart)
      }

      // Dynamic wave front bore crest entity
      if (!crestEntityRef.current) {
        crestEntityRef.current = ds.flood.entities.add({
          id: 'active-bore-crest',
          position: Cesium.Cartesian3.fromDegrees(tipLngLat[0], tipLngLat[1]),
          ellipse: {
            semiMajorAxis: 75,
            semiMinorAxis: 45,
            material: Cesium.Color.fromCssColorString('#f8fafc').withAlpha(0.65),
            classificationType: Cesium.ClassificationType.TERRAIN,
          },
        })
      } else {
        crestEntityRef.current.position = Cesium.Cartesian3.fromDegrees(tipLngLat[0], tipLngLat[1]) as any
        crestEntityRef.current.show = true
      }
    } else {
      if (spray) spray.show = false
      if (crestEntityRef.current) crestEntityRef.current.show = false
    }
  }, [ready, timeS, showMaxExtent, flood, layers.floodDepth, layers.floodVelocity, layers.arrivalTime])

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
    const floodVisible = Boolean(layers.floodDepth || layers.floodVelocity || layers.arrivalTime)
    if (ds.flood) ds.flood.show = floodVisible
    if (spraySystemRef.current && !floodVisible) {
      spraySystemRef.current.show = false
    }
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

  const currentWp = tourWaypoints[currentWaypointIdx] || tourWaypoints[0]

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
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('out')}
            title="Zoom Out"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
          >
            <Minus className="size-3.5" />
          </button>
          <div className="my-0.5 h-px w-full bg-white/8" />
          <button
            type="button"
            onClick={handleResetHeading}
            title="Reset North Orientation"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
          >
            <Compass className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleTiltToggle}
            title="Toggle 3D Perspective Tilt"
            className="flex size-7 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <div className="my-0.5 h-px w-full bg-white/8" />
          <button
            type="button"
            onClick={handleToggleDroneTour}
            title={isDroneTour ? 'Stop Drone Tour' : 'Follow the Wave · 3D Drone Tour'}
            className={cn(
              'flex size-7 items-center justify-center rounded-xl transition-all cursor-pointer relative',
              isDroneTour
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50'
                : 'text-white/70 hover:text-white hover:bg-white/8'
            )}
          >
            <Video className="size-3.5" />
            {isDroneTour && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>
        </div>
      )}


      {/* ── 3D Drone Tour Broadcast Telemetry HUD Overlay ─────────── */}
      {isDroneTour && ready && (
        <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="map-hud-panel-solid flex items-center gap-3 rounded-2xl px-4 py-2 border border-cyan-500/40 shadow-2xl backdrop-blur-2xl">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-mono text-[11px] font-black tracking-wider text-cyan-300 uppercase">
                Drone Tour
              </span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            {/* Current Waypoint / Landmark */}
            <div className="flex items-center gap-2 max-w-xs sm:max-w-md truncate">
              <span className="text-xs font-bold text-white truncate">
                {currentWp.name}
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80 shrink-0">
                {currentWp.chainageKm} km
              </span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            {/* Flight Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevWaypoint}
                title="Previous Sector"
                className="flex size-6 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipBack className="size-3" />
              </button>

              <button
                type="button"
                onClick={handleTogglePauseTour}
                title={tourPaused ? 'Resume Drone Tour' : 'Pause Drone Tour'}
                className="flex size-6 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                {tourPaused ? <Play className="size-3" /> : <Pause className="size-3" />}
              </button>

              <button
                type="button"
                onClick={handleNextWaypoint}
                title="Next Sector"
                className="flex size-6 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SkipForward className="size-3" />
              </button>

              <button
                type="button"
                onClick={handleCycleTourSpeed}
                title="Tour Flight Speed"
                className="rounded-lg bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer"
              >
                {tourSpeed}×
              </button>

              <button
                type="button"
                onClick={handleStopDroneTour}
                title="Exit Drone Tour"
                className="flex size-6 items-center justify-center rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 hover:text-white transition-colors ml-1 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>

          {/* Sub-telemetry strip */}
          <div className="flex items-center gap-2.5 text-[9px] font-mono text-white/50 bg-[#0C0C0C]/85 px-3 py-0.5 rounded-full border border-white/5 backdrop-blur-md">
            <span>PITCH -32°</span>
            <span>•</span>
            <span>ALT ~{getTourAltitude(activeCase?.id, currentWp.chainageKm / (activeCase?.reachKm || 100))}M</span>
            <span>•</span>
            <span className="text-cyan-400 font-bold">
              SECTOR {currentWaypointIdx + 1} / {tourWaypoints.length}
            </span>
            {tourPaused && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-bold animate-pulse">PAUSED</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rich Interactive Entity Popup */}
      {popup && (
        <div
          className="cesium-hud-popup absolute max-w-67.5 -translate-x-1/2 -translate-y-[calc(100%+12px)] pointer-events-auto"
          style={{ left: popup.x, top: popup.y }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/8 pb-1.5 mb-2">
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
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-xl bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground border border-white/6 backdrop-blur-md">
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
