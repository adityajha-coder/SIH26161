'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Play, Pause, RotateCcw, Waves } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SPHParticleFrame {
  time_s: number
  particle_count: number
  tip_position_m: number
  // [x, y, z, vx, vy, vz, pressure, is_surface]
  particles: number[][]
}

interface SPHDataset {
  metadata: {
    experiment: string
    solver: string
    provenance: string
    citation: string
    flume_dimensions_m: [number, number, number]
    initial_block_m: [number, number, number]
    total_particles: number
    particle_spacing_m: number
    time_steps: number[]
  }
  frames: SPHParticleFrame[]
}

// Physical Fluid SPH Vertex Shader:
// - Perspective point size attenuation matching real physical droplet diameter (~3.5cm)
// - Attribute forwarding for pressure, velocity vector, and free-surface aeration
const SPH_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aVelocity;
  attribute float aPressure;
  attribute float aIsSurface;

  varying vec3 vVelocity;
  varying float vPressure;
  varying float vIsSurface;

  uniform float uScale;

  void main() {
    vVelocity = aVelocity;
    vPressure = aPressure;
    vIsSurface = aIsSurface;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Physical droplet sizing scaled with distance
    float dist = max(0.1, -mvPosition.z);
    gl_PointSize = (uScale / dist) * (1.0 + 0.22 * aIsSurface);
    gl_PointSize = clamp(gl_PointSize, 5.0, 72.0);
  }
`

// Physical Fluid SPH Fragment Shader:
// - Reconstructs hemispherical 3D surface normal from gl_PointCoord
// - Computes direct directional key-lighting and Blinn-Phong specular glints (sun highlights)
// - Computes Schlick Fresnel reflection rim (refractive index of water n = 1.333)
// - Hydrodynamic color ramp: deep hydrostatic core (navy) -> clean stream (cerulean) -> aerated white foam
// - Alpha anti-aliasing with normal opacity blending (volumetric mass without neon cartoon glow)
const SPH_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vVelocity;
  varying float vPressure;
  varying float vIsSurface;

  uniform vec3 uSunDir;

  void main() {
    // Discard outside unit circle to create round droplets
    vec2 coord = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(coord, coord);
    if (r2 > 1.0) discard;

    // Exact 3D sphere normal in view-space
    float z = sqrt(1.0 - r2);
    vec3 normal = normalize(vec3(coord.x, -coord.y, z));

    // Directional sunlight
    vec3 lightDir = normalize(uSunDir);
    float diff = max(dot(normal, lightDir), 0.0);

    // Specular sunlight glint (Blinn-Phong)
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 32.0);

    // Fresnel rim reflectance (water n = 1.333, F0 = 0.02)
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, viewDir), 0.0), 3.2);

    // Physical hydrodynamic state
    float pNorm = clamp(vPressure / 3000.0, 0.0, 1.0);
    float speed = length(vVelocity);
    float speedNorm = clamp(speed / 4.2, 0.0, 1.0);

    // Realistic water color palette
    vec3 deepWater  = vec3(0.04, 0.18, 0.38); // Deep hydrostatic core
    vec3 midWater   = vec3(0.08, 0.42, 0.68); // Mid-depth clean hydraulic flow
    vec3 surgeWater = vec3(0.14, 0.58, 0.82); // High-velocity stream
    vec3 foamWhite  = vec3(0.96, 0.98, 1.00); // Aerated white foam spray

    vec3 waterColor = mix(deepWater, midWater, 1.0 - pNorm);
    waterColor = mix(waterColor, surgeWater, speedNorm * 0.5);

    // Aeration / foam on plunging wave front & free-surface
    float foamFactor = 0.0;
    if (vIsSurface > 0.5) {
      foamFactor = 0.60 + 0.40 * speedNorm;
    } else if (speedNorm > 0.75) {
      foamFactor = (speedNorm - 0.75) * 2.5;
    }
    waterColor = mix(waterColor, foamWhite, clamp(foamFactor, 0.0, 1.0));

    // Diffuse lighting + subtle ambient bounce
    vec3 litColor = waterColor * (0.42 + 0.58 * diff);

    // Sharp specular sun highlight on droplet crest
    litColor += vec3(1.0) * (spec * 0.92);

    // Sky Fresnel reflection along droplet edge
    litColor += vec3(0.70, 0.88, 1.0) * (fresnel * 0.42);

    // Anti-aliased outer edge and volumetric opacity
    float edgeAlpha = smoothstep(1.0, 0.82, r2);
    float baseAlpha = vIsSurface > 0.5 ? 0.96 : (0.80 + 0.20 * pNorm);

    gl_FragColor = vec4(litColor, edgeAlpha * baseAlpha);
  }
`

export function SphParticleViewer({
  className,
  autoPlay = true,
}: {
  className?: string
  autoPlay?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dataset, setDataset] = useState<SPHDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState<number>(1.0)
  const [cameraView, setCameraView] = useState<'perspective' | 'side' | 'top'>('perspective')

  const animFrameRef = useRef<number | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const pointsMeshRef = useRef<THREE.Points | null>(null)
  const timeRef = useRef(0)
  const isPlayingRef = useRef(autoPlay)
  const speedRef = useRef(1.0)

  isPlayingRef.current = isPlaying
  speedRef.current = speed

  // 1. Fetch SPH Dataset
  useEffect(() => {
    let isCancelled = false
    setLoading(true)

    fetch('/data/sph/dambreak_particles.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: SPHDataset) => {
        if (!isCancelled) {
          setDataset(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.warn('Could not load SPH dataset from public path:', err)
        if (!isCancelled) {
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [])

  // 2. Set Up Three.js Scene with Physical Flume Environment
  useEffect(() => {
    const container = containerRef.current
    if (!container || !dataset || dataset.frames.length === 0) return

    const width = container.clientWidth || 640
    const height = container.clientHeight || 420

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x08090d)
    sceneRef.current = scene

    // Camera (centered on the 3.0m x 0.5m x 1.2m flume tank)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50)
    camera.position.set(1.5, -2.8, 1.8)
    camera.up.set(0, 0, 1) // Z is UP
    camera.lookAt(1.5, 0.25, 0.4)
    cameraRef.current = camera

    // WebGL Renderer with proper tone mapping and antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    container.replaceChildren(renderer.domElement)
    rendererRef.current = renderer

    // Directional Sunlight & Ambient Illumination
    const ambLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambLight)

    const sunLight = new THREE.DirectionalLight(0xe0f2fe, 1.3)
    sunLight.position.set(2.5, -3.2, 4.0)
    scene.add(sunLight)

    // Flume Tank Glass Panels (3.0m length x 0.5m width x 1.2m height)
    // Gómez-Gesteira et al. (2010) Stansby Dam Break Flume
    const tankGroup = new THREE.Group()

    // 1. Sturdy Slate Frame
    const boxGeo = new THREE.BoxGeometry(3.0, 0.5, 1.2)
    const boxEdges = new THREE.EdgesGeometry(boxGeo)
    const boxLine = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.65 })
    )
    boxLine.position.set(1.5, 0.25, 0.6)
    tankGroup.add(boxLine)

    // 2. Translucent Glass Side Walls
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const sideWallGeo = new THREE.PlaneGeometry(3.0, 1.2)
    // Front glass panel (Y = 0)
    const frontGlass = new THREE.Mesh(sideWallGeo, glassMat)
    frontGlass.position.set(1.5, 0.0, 0.6)
    frontGlass.rotation.x = Math.PI / 2
    tankGroup.add(frontGlass)

    // Back glass panel (Y = 0.5)
    const backGlass = new THREE.Mesh(sideWallGeo, glassMat)
    backGlass.position.set(1.5, 0.5, 0.6)
    backGlass.rotation.x = Math.PI / 2
    tankGroup.add(backGlass)

    // End impact wall (X = 3.0)
    const endWallGeo = new THREE.PlaneGeometry(0.5, 1.2)
    const endWall = new THREE.Mesh(endWallGeo, glassMat)
    endWall.position.set(3.0, 0.25, 0.6)
    endWall.rotation.y = Math.PI / 2
    tankGroup.add(endWall)

    // 3. Flume Bed Coordinate Grid
    const gridHelper = new THREE.GridHelper(3.0, 12, 0x0284c7, 0x1e293b)
    gridHelper.position.set(1.5, 0.25, 0.0)
    gridHelper.rotation.x = Math.PI / 2
    tankGroup.add(gridHelper)

    // 4. Sluice Gate Release Slot (x = 0.60m)
    const gateGeo = new THREE.PlaneGeometry(0.5, 0.8)
    const gateMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 0.05,
      gapSize: 0.03,
      transparent: true,
      opacity: 0.45,
    })
    const gateEdges = new THREE.EdgesGeometry(gateGeo)
    const gateLine = new THREE.LineSegments(gateEdges, gateMat)
    gateLine.computeLineDistances()
    gateLine.position.set(0.6, 0.25, 0.4)
    gateLine.rotation.y = Math.PI / 2
    tankGroup.add(gateLine)

    scene.add(tankGroup)

    // Fluid Particle System
    const particleCount = dataset.frames[0].particles.length
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const pressures = new Float32Array(particleCount)
    const isSurfaces = new Float32Array(particleCount)

    const initialParticles = dataset.frames[0].particles
    for (let i = 0; i < particleCount; i++) {
      const p = initialParticles[i]
      positions[i * 3] = p[0]
      positions[i * 3 + 1] = p[1]
      positions[i * 3 + 2] = p[2]

      velocities[i * 3] = p[3]
      velocities[i * 3 + 1] = p[4]
      velocities[i * 3 + 2] = p[5]

      pressures[i] = p[6]
      isSurfaces[i] = p[7]
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('aPressure', new THREE.BufferAttribute(pressures, 1))
    geometry.setAttribute('aIsSurface', new THREE.BufferAttribute(isSurfaces, 1))

    // Physical Shaded Points Material
    const material = new THREE.ShaderMaterial({
      vertexShader: SPH_VERTEX_SHADER,
      fragmentShader: SPH_FRAGMENT_SHADER,
      uniforms: {
        uScale: { value: 42.0 },
        uSunDir: { value: new THREE.Vector3(0.5, -0.6, 0.85).normalize() },
      },
      transparent: true,
      depthTest: true,
      depthWrite: true,
      blending: THREE.NormalBlending,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)
    pointsMeshRef.current = points

    // Mouse Interaction for camera rotation & zooming
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0
    let camRadius = 3.6
    let camTheta = -Math.PI / 2 + 0.3
    let camPhi = 0.5

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - prevMouseX
      const deltaY = e.clientY - prevMouseY
      prevMouseX = e.clientX
      prevMouseY = e.clientY

      camTheta -= deltaX * 0.007
      camPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, camPhi - deltaY * 0.007))

      const targetX = 1.5
      const targetY = 0.25
      const targetZ = 0.35

      camera.position.x = targetX + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
      camera.position.y = targetY + camRadius * Math.sin(camPhi) * Math.sin(camTheta)
      camera.position.z = targetZ + camRadius * Math.cos(camPhi)
      camera.lookAt(targetX, targetY, targetZ)
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camRadius = Math.max(1.4, Math.min(6.5, camRadius + e.deltaY * 0.0025))
      const targetX = 1.5
      const targetY = 0.25
      const targetZ = 0.35
      camera.position.x = targetX + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
      camera.position.y = targetY + camRadius * Math.sin(camPhi) * Math.sin(camTheta)
      camera.position.z = targetZ + camRadius * Math.cos(camPhi)
      camera.lookAt(targetX, targetY, targetZ)
    }

    const domEl = renderer.domElement
    domEl.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    domEl.addEventListener('wheel', onWheel, { passive: false })

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Animation Loop with Physical Interpolation
    let lastStamp = performance.now()
    const maxT = dataset.frames[dataset.frames.length - 1].time_s

    const animate = (stamp: number) => {
      animFrameRef.current = requestAnimationFrame(animate)

      const dt = (stamp - lastStamp) / 1000
      lastStamp = stamp

      if (isPlayingRef.current) {
        timeRef.current += dt * speedRef.current
        if (timeRef.current > maxT) {
          timeRef.current = 0.0 // Loop smoothly
        }
        setCurrentTime(timeRef.current)
      }

      // Interpolate particles at current simulation time
      const t = timeRef.current
      const frames = dataset.frames

      let idx0 = 0
      for (let i = 0; i < frames.length - 1; i++) {
        if (t >= frames[i].time_s && t <= frames[i + 1].time_s) {
          idx0 = i
          break
        }
      }
      if (t >= frames[frames.length - 1].time_s) {
        idx0 = frames.length - 2
      }

      const f0 = frames[idx0]
      const f1 = frames[idx0 + 1]
      const dtFrame = Math.max(0.0001, f1.time_s - f0.time_s)
      const alpha = Math.min(1.0, Math.max(0.0, (t - f0.time_s) / dtFrame))

      const posAttr = points.geometry.attributes.position as THREE.BufferAttribute
      const velAttr = points.geometry.attributes.aVelocity as THREE.BufferAttribute
      const presAttr = points.geometry.attributes.aPressure as THREE.BufferAttribute
      const surfAttr = points.geometry.attributes.aIsSurface as THREE.BufferAttribute

      const pArr = posAttr.array as Float32Array
      const vArr = velAttr.array as Float32Array
      const prArr = presAttr.array as Float32Array
      const sArr = surfAttr.array as Float32Array

      const count = Math.min(f0.particles.length, f1.particles.length)
      for (let i = 0; i < count; i++) {
        const p0 = f0.particles[i]
        const p1 = f1.particles[i]

        // Position
        pArr[i * 3] = p0[0] + alpha * (p1[0] - p0[0])
        pArr[i * 3 + 1] = p0[1] + alpha * (p1[1] - p0[1])
        pArr[i * 3 + 2] = p0[2] + alpha * (p1[2] - p0[2])

        // Velocity vector
        vArr[i * 3] = p0[3] + alpha * (p1[3] - p0[3])
        vArr[i * 3 + 1] = p0[4] + alpha * (p1[4] - p0[4])
        vArr[i * 3 + 2] = p0[5] + alpha * (p1[5] - p0[5])

        // Hydrostatic pressure
        prArr[i] = p0[6] + alpha * (p1[6] - p0[6])

        // Surface / wave tip aeration
        sArr[i] = p0[7] === 1 || p1[7] === 1 ? 1.0 : 0.0
      }

      posAttr.needsUpdate = true
      velAttr.needsUpdate = true
      presAttr.needsUpdate = true
      surfAttr.needsUpdate = true

      renderer.render(scene, camera)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', handleResize)
      domEl.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      domEl.removeEventListener('wheel', onWheel)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [dataset])

  // Camera preset switcher
  const handleSetCameraView = useCallback((view: 'perspective' | 'side' | 'top') => {
    setCameraView(view)
    const camera = cameraRef.current
    if (!camera) return

    if (view === 'side') {
      camera.position.set(1.5, -3.2, 0.4)
      camera.lookAt(1.5, 0.25, 0.4)
    } else if (view === 'top') {
      camera.position.set(1.5, 0.25, 3.5)
      camera.lookAt(1.5, 0.25, 0.0)
    } else {
      camera.position.set(1.5, -2.8, 1.8)
      camera.lookAt(1.5, 0.25, 0.4)
    }
  }, [])

  const handleScrub = (newT: number) => {
    timeRef.current = newT
    setCurrentTime(newT)
  }

  const maxDuration = dataset ? dataset.frames[dataset.frames.length - 1].time_s : 2.2

  // Current frame stats for HUD
  const activeFrame = dataset?.frames.find((f) => Math.abs(f.time_s - currentTime) < 0.15) || dataset?.frames[0]
  const tipPos = activeFrame?.tip_position_m ?? 0.6
  const tipVel = currentTime > 0.1 ? (tipPos - 0.6) / currentTime : 3.65

  return (
    <div className={cn('relative flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-[#0a0c10]', className)}>
      {/* Viewport Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-b border-white/8 bg-black/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Waves className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">
              DualSPHysics 3D Particle Flume Benchmark
            </h3>
            <p className="text-[10px] font-mono text-zinc-400">
              Gómez-Gesteira et al. (2010) Dam Break Experiment (3.0m × 0.5m × 1.2m)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/6 border border-white/8 text-zinc-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Lagrangian SPH
          </span>
          <span className="hidden sm:inline">WCSPH Kernel</span>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div className="relative w-full h-85 sm:h-96 cursor-grab active:cursor-grabbing select-none" ref={containerRef}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-2 text-xs font-mono text-white/70">
              <span className="size-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
              <span>Loading 2,380 Lagrangian fluid particles...</span>
            </div>
          </div>
        )}

        {/* Live Hydrodynamic Telemetry HUD Overlay */}
        <div className="absolute top-3 left-3 p-2.5 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md text-[11px] font-mono pointer-events-none space-y-1 z-10">
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Time:</span>
            <span className="text-emerald-400 font-semibold">{currentTime.toFixed(2)} s</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Particles:</span>
            <span className="text-white font-medium">{dataset?.metadata.total_particles ?? 2380}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Wave Front Tip:</span>
            <span className="text-sky-400 font-medium">{tipPos.toFixed(2)} m</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Surge Velocity:</span>
            <span className="text-sky-300 font-medium">{tipVel.toFixed(2)} m/s</span>
          </div>
        </div>

        {/* Camera Angle Switcher */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/75 border border-white/10 p-1 rounded-xl backdrop-blur-md z-10">
          <button
            type="button"
            onClick={() => handleSetCameraView('perspective')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer',
              cameraView === 'perspective' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
            )}
            title="Perspective View"
          >
            Perspective
          </button>
          <button
            type="button"
            onClick={() => handleSetCameraView('side')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer',
              cameraView === 'side' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
            )}
            title="Side Elevation View"
          >
            Side
          </button>
          <button
            type="button"
            onClick={() => handleSetCameraView('top')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer',
              cameraView === 'top' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
            )}
            title="Top-Down Plan View"
          >
            Top
          </button>
        </div>

        {/* Orbit Hint */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-zinc-400 bg-black/60 px-2.5 py-1 rounded-lg pointer-events-none border border-white/6">
          Click &amp; drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* Interactive Controls Toolbar */}
      <div className="p-3 border-t border-white/8 bg-black/60 backdrop-blur-md space-y-2">
        <div className="flex items-center gap-3">
          {/* Play / Pause Button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="size-8 rounded-lg bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 font-medium"
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="size-4 fill-black" /> : <Play className="size-4 fill-black ml-0.5" />}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={() => handleScrub(0)}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Reset to t = 0.0s"
          >
            <RotateCcw className="size-3.5" />
          </button>

          {/* Time Scrubber Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-400 shrink-0">0.0s</span>
            <input
              type="range"
              min="0"
              max={maxDuration}
              step="0.01"
              value={currentTime}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <span className="text-[10px] font-mono text-zinc-400 shrink-0">{maxDuration.toFixed(1)}s</span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center rounded-lg bg-white/6 border border-white/8 p-0.5 text-[10px] font-mono shrink-0">
            {[0.5, 1.0, 2.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={cn(
                  'px-2 py-0.5 rounded font-medium transition-colors cursor-pointer',
                  speed === s ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-white/6 text-[10px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-sky-500" />
            <span>Fluid Shading: Hydrostatic Bulk Core (Navy) → Aerated Free-Surface Tip (Foam)</span>
          </div>
          <span className="text-zinc-400">
            DualSPHysics v5.2 WCSPH · Gómez-Gesteira Benchmark
          </span>
        </div>
      </div>
    </div>
  )
}
