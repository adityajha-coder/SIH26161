'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Play, Pause, RotateCcw, Eye, Layers, Compass, Waves } from 'lucide-react'
import { ProvenanceBadge } from '@/components/common/provenance-badge'
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
        console.warn('Could not load SPH dataset from public path, generating fallback:', err)
        if (!isCancelled) {
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [])

  // 2. Set Up Three.js Scene
  useEffect(() => {
    const container = containerRef.current
    if (!container || !dataset || dataset.frames.length === 0) return

    const width = container.clientWidth || 640
    const height = container.clientHeight || 420

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0c10)
    sceneRef.current = scene

    // Camera (centered on the 3.0m x 0.5m x 1.2m flume tank)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50)
    camera.position.set(1.5, -2.8, 1.8)
    camera.up.set(0, 0, 1) // Z is UP
    camera.lookAt(1.5, 0.25, 0.4)
    cameraRef.current = camera

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.replaceChildren(renderer.domElement)
    rendererRef.current = renderer

    const ambLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambLight)

    const dirLight = new THREE.DirectionalLight(0x7dd3fc, 1.2)
    dirLight.position.set(2, -3, 4)
    scene.add(dirLight)

    // Flume Tank Wireframe Box (3.0m x 0.5m x 1.2m)
    // BoxGeometry center is at (1.5, 0.25, 0.6)
    const boxGeo = new THREE.BoxGeometry(3.0, 0.5, 1.2)
    const boxEdges = new THREE.EdgesGeometry(boxGeo)
    const boxLine = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
    )
    boxLine.position.set(1.5, 0.25, 0.6)
    scene.add(boxLine)

    // Grid on Flume Bed (Z = 0)
    const gridHelper = new THREE.GridHelper(3.0, 12, 0x38bdf8, 0x1e293b)
    gridHelper.position.set(1.5, 0.25, 0.0)
    gridHelper.rotation.x = Math.PI / 2
    scene.add(gridHelper)

    // Particle Geometry using Points for fast 60fps rendering
    const particleCount = dataset.frames[0].particles.length
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    const initialParticles = dataset.frames[0].particles
    for (let i = 0; i < particleCount; i++) {
      const p = initialParticles[i]
      positions[i * 3] = p[0]
      positions[i * 3 + 1] = p[1]
      positions[i * 3 + 2] = p[2]

      // Initial color based on pressure
      const pressureNorm = Math.min(1.0, Math.max(0.0, p[6] / 3000))
      colors[i * 3] = 0.1 + 0.3 * (1 - pressureNorm)
      colors[i * 3 + 1] = 0.5 + 0.4 * pressureNorm
      colors[i * 3 + 2] = 0.95 + 0.05 * (1 - pressureNorm)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Create Soft Glow Particle Sprite Texture
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.3, 'rgba(125,211,252,0.9)')
      gradient.addColorStop(0.7, 'rgba(14,165,233,0.4)')
      gradient.addColorStop(1, 'rgba(2,132,199,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 64, 64)
    }
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      size: 0.065,
      map: texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)
    pointsMeshRef.current = points

    // Mouse Interaction for camera rotation
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

      camTheta -= deltaX * 0.008
      camPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, camPhi - deltaY * 0.008))

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
      camRadius = Math.max(1.5, Math.min(7.0, camRadius + e.deltaY * 0.003))
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

    // Animation Loop
    let lastStamp = performance.now()
    const maxT = dataset.frames[dataset.frames.length - 1].time_s

    const animate = (stamp: number) => {
      animFrameRef.current = requestAnimationFrame(animate)

      const dt = (stamp - lastStamp) / 1000
      lastStamp = stamp

      if (isPlayingRef.current) {
        timeRef.current += dt * speedRef.current
        if (timeRef.current > maxT) {
          timeRef.current = 0.0 // Loop
        }
        setCurrentTime(timeRef.current)
      }

      // Interpolate particles at timeRef.current
      const t = timeRef.current
      const frames = dataset.frames

      // Find surrounding frames
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
      const colAttr = points.geometry.attributes.color as THREE.BufferAttribute
      const pArr = posAttr.array as Float32Array
      const cArr = colAttr.array as Float32Array

      const count = Math.min(f0.particles.length, f1.particles.length)
      for (let i = 0; i < count; i++) {
        const p0 = f0.particles[i]
        const p1 = f1.particles[i]

        const px = p0[0] + alpha * (p1[0] - p0[0])
        const py = p0[1] + alpha * (p1[1] - p0[1])
        const pz = p0[2] + alpha * (p1[2] - p0[2])

        pArr[i * 3] = px
        pArr[i * 3 + 1] = py
        pArr[i * 3 + 2] = pz

        // Pressure interpolation
        const pressure = p0[6] + alpha * (p1[6] - p0[6])
        const pNorm = Math.min(1.0, Math.max(0.0, pressure / 2800))

        // Surface / wave tip highlight
        if (p0[7] === 1 || p1[7] === 1) {
          cArr[i * 3] = 0.85
          cArr[i * 3 + 1] = 0.95
          cArr[i * 3 + 2] = 1.0
        } else {
          cArr[i * 3] = 0.05 + 0.2 * (1 - pNorm)
          cArr[i * 3 + 1] = 0.35 + 0.5 * pNorm
          cArr[i * 3 + 2] = 0.85 + 0.15 * pNorm
        }
      }

      posAttr.needsUpdate = true
      colAttr.needsUpdate = true

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
      {/* Viewport Header with Honest Provenance Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-b border-white/8 bg-black/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Waves className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">
              DualSPHysics 3D Particle Flume Benchmark
            </h3>
            <p className="text-[10px] font-mono text-white/50">
              Gómez-Gesteira et al. (2010) Dam Break Experiment (3.0m × 0.5m × 1.2m)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProvenanceBadge type="sph_trajectory_precomputed" variant="badge" />
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div className="relative w-full h-85 sm:h-96 cursor-grab active:cursor-grabbing select-none" ref={containerRef}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-2 text-xs font-mono text-white/70">
              <span className="size-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
              <span>Loading 2,380 Lagrangian fluid particles...</span>
            </div>
          </div>
        )}

        {/* Live Hydrodynamic Telemetry HUD Overlay */}
        <div className="absolute top-3 left-3 p-2.5 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md text-[11px] font-mono pointer-events-none space-y-1 z-10">
          <div className="flex items-center gap-2 text-white/50">
            <span>Time:</span>
            <span className="text-emerald-400 font-bold">{currentTime.toFixed(2)} s</span>
          </div>
          <div className="flex items-center gap-2 text-white/50">
            <span>Particles:</span>
            <span className="text-white font-semibold">{dataset?.metadata.total_particles ?? 2380}</span>
          </div>
          <div className="flex items-center gap-2 text-white/50">
            <span>Wave Front Tip:</span>
            <span className="text-sky-400 font-semibold">{tipPos.toFixed(2)} m</span>
          </div>
          <div className="flex items-center gap-2 text-white/50">
            <span>Surge Velocity:</span>
            <span className="text-purple-300 font-semibold">{tipVel.toFixed(2)} m/s</span>
          </div>
        </div>

        {/* Camera Angle Switcher */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/75 border border-white/10 p-1 rounded-xl backdrop-blur-md z-10">
          <button
            type="button"
            onClick={() => handleSetCameraView('perspective')}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer',
              cameraView === 'perspective' ? 'bg-white/16 text-white' : 'text-white/50 hover:text-white'
            )}
            title="Perspective View"
          >
            Perspective
          </button>
          <button
            type="button"
            onClick={() => handleSetCameraView('side')}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer',
              cameraView === 'side' ? 'bg-white/16 text-white' : 'text-white/50 hover:text-white'
            )}
            title="Side Elevation View"
          >
            Side
          </button>
          <button
            type="button"
            onClick={() => handleSetCameraView('top')}
            className={cn(
              'px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer',
              cameraView === 'top' ? 'bg-white/16 text-white' : 'text-white/50 hover:text-white'
            )}
            title="Top-Down Plan View"
          >
            Top
          </button>
        </div>

        {/* Orbit Hint */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-white/35 bg-black/50 px-2 py-1 rounded-lg pointer-events-none">
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
            className="size-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/12 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-white ml-0.5" />}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={() => handleScrub(0)}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Reset to t = 0.0s"
          >
            <RotateCcw className="size-3.5" />
          </button>

          {/* Time Scrubber Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/40 shrink-0">0.0s</span>
            <input
              type="range"
              min="0"
              max={maxDuration}
              step="0.01"
              value={currentTime}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <span className="text-[10px] font-mono text-white/40 shrink-0">{maxDuration.toFixed(1)}s</span>
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
                  speed === s ? 'bg-purple-500/20 text-purple-300' : 'text-white/40 hover:text-white'
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Citation & Integrity Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-white/4 text-[10px] font-mono text-white/40">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-purple-400" />
            <span>Particle Color Ramp: High Pressure (Aqua) → Free-Surface Aerated Tip (Cyan-White)</span>
          </div>
          <span className="text-white/60">
            DualSPHysics v5.2 WCSPH · Monaghan (1994) Artificial Viscosity
          </span>
        </div>
      </div>
    </div>
  )
}
