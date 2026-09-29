'use client'

import Link from 'next/link'
import {
  Map,
  LayoutDashboard,
  ShieldAlert,
  Download,
  ArrowRight,
  Compass,
  SlidersHorizontal,
  Waves,
  ArrowLeft,
  MousePointer,
  Play,
  Clock,
  FileCheck,
} from 'lucide-react'

const SIMPLE_STEPS = [
  {
    num: '1',
    title: 'Pick a Dam',
    subtitle: 'Choose your benchmark river corridor',
    icon: Compass,
    actionText: 'Select on Home Page',
    actionHref: '/',
    bullets: [
      'Choose from 5 major Indian dams: Tehri (Uttarakhand), Sardar Sarovar (Gujarat), Bhakra (Himachal), Idukki (Kerala), or Rishi Ganga (GLOF).',
      'Selecting a dam automatically loads its 3D terrain, river reach length, and downstream towns.',
    ],
  },
  {
    num: '2',
    title: 'Configure the Breach in Studio',
    subtitle: 'Set breach parameters & reservoir levels',
    icon: SlidersHorizontal,
    actionText: 'Open Scenario Studio',
    actionHref: '/dashboard',
    bullets: [
      'Choose failure type: Overtopping (water spills over crest) or Piping (internal conduit breach).',
      'Adjust reservoir water level (FRL) and river bed roughness (Manning n) using the sliders.',
      'Click the white "Apply & Run Simulation" button to compute the flood wave.',
    ],
  },
  {
    num: '3',
    title: 'Watch the 3D Flood Wave Propagate',
    subtitle: 'Real-time CesiumJS physics & particle animation',
    icon: Waves,
    actionText: 'Launch 3D Flood Map',
    actionHref: '/map',
    bullets: [
      'Press the Play button at the bottom timeline to watch the flood wave rush down the canyon.',
      'Notice realistic water depth colors: translucent light cyan in shallows to deep navy in the gorge.',
      'Speed up playback using the 1x, 2x, 5x, or 10x buttons to watch the entire wave reach the terminus.',
    ],
  },
  {
    num: '4',
    title: 'Check Town Arrival Times & Risk',
    subtitle: 'Town-by-town warnings & flood heights',
    icon: ShieldAlert,
    actionText: 'Inspect Downstream Impact',
    actionHref: '/impact',
    bullets: [
      'See exact flood wave arrival countdowns for every town along the corridor (e.g. Koteshwar, Devprayag, Rishikesh, Haridwar).',
      'View peak water depths (meters) and population exposure scores for emergency planning.',
    ],
  },
  {
    num: '5',
    title: 'Download Official GIS Packages',
    subtitle: 'Ready-to-use maps for disaster response teams',
    icon: Download,
    actionText: 'Open GIS Exports',
    actionHref: '/exports',
    bullets: [
      'Download 1-click ESRI Shapefile bundles (.shp, .shx, .dbf, .prj) in standard EPSG:4326.',
      'Export GeoJSON layers for web GIS or Google Earth KML files for virtual globe inspection.',
    ],
  },
]

const MAP_CONTROLS = [
  {
    action: 'Rotate & Pan',
    how: 'Left-click & drag anywhere on the map to fly around the valley.',
  },
  {
    action: 'Zoom In / Out',
    how: 'Scroll mouse wheel up or down, or pinch on trackpad.',
  },
  {
    action: 'Tilt & 3D Pitch',
    how: 'Right-click & drag up/down, or hold Ctrl + left-click & drag.',
  },
]

export default function GuidePage() {
  return (
    <div className="min-h-full w-full max-w-5xl mx-auto space-y-12 pb-24 pt-4">
      {/* ── TOP NAV BACK ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 text-xs font-mono text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition-colors cursor-pointer"
          >
            <Map className="size-3.5" />
            <span>Open 3D Flood Map</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <LayoutDashboard className="size-3.5 text-white/70" />
            <span>Scenario Studio</span>
          </Link>
        </div>
      </div>

      {/* ── HEADER INTRO ─────────────────────────────────────────────── */}
      <header className="rounded-3xl border border-white/10 bg-[#0E0E12]/80 backdrop-blur-2xl p-8 sm:p-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-3 text-center sm:text-left">
        <div className="font-mono text-xs text-white/50 tracking-widest uppercase">
          Quickstart Guide
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white">
          How to Use STRATA in 5 Easy Steps
        </h1>
        <p className="text-white/70 text-sm sm:text-base max-w-2xl leading-relaxed">
          STRATA lets you simulate catastrophic dam breaches and track flood waves in 3D.
          Here is the step-by-step workflow from picking a dam to downloading GIS maps.
        </p>
      </header>

      {/* ── STEP-BY-STEP SIMPLE CARDS ────────────────────────────────── */}
      <main className="space-y-6">
        {SIMPLE_STEPS.map((step) => {
          const Icon = step.icon
          return (
            <div
              key={step.num}
              className="rounded-3xl border border-white/10 bg-[#0E0E12]/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              {/* Left: Step Number, Title & Bullets */}
              <div className="flex items-start gap-5 max-w-2xl">
                <div className="size-12 rounded-2xl border border-white/15 bg-white/[0.06] flex items-center justify-center shrink-0 text-white font-mono text-lg font-bold">
                  {step.num}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                      {step.title}
                    </h2>
                    <div className="text-xs font-mono text-white/50">{step.subtitle}</div>
                  </div>

                  <ul className="space-y-1.5 text-xs sm:text-sm text-white/75 font-sans leading-relaxed">
                    {step.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: Direct Action Link */}
              <Link
                href={step.actionHref}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:scale-105 cursor-pointer"
              >
                <span>{step.actionText}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )
        })}
      </main>

      {/* ── 3D MAP CONTROLS CHEAT-SHEET ──────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-[#0C0C10]/80 backdrop-blur-2xl p-7 sm:p-9 space-y-5">
        <div className="flex items-center gap-2.5 text-white font-medium text-base">
          <MousePointer className="size-4.5 text-cyan-400" />
          <span>Quick Cheat-Sheet: How to Navigate the 3D Flood Map</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MAP_CONTROLS.map((ctrl, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-1.5"
            >
              <div className="font-semibold text-sm text-white">{ctrl.action}</div>
              <div className="text-xs text-white/60 leading-relaxed font-sans">{ctrl.how}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER READY BUTTONS ─────────────────────────────────────── */}
      <footer className="text-center space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-black hover:bg-white/90 transition-colors shadow-lg cursor-pointer"
          >
            <Map className="size-4" />
            <span>Launch 3D Flood Map</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-7 py-3 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            <LayoutDashboard className="size-4 text-white/70" />
            <span>Open Scenario Studio</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}
