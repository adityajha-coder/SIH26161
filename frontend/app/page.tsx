'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Map,
  ArrowRight,
  ShieldAlert,
  Waves,
  Satellite,
  HelpCircle,
  Compass,
  LayoutDashboard,
} from 'lucide-react'
import { usePlatform } from '@/lib/platform-store'

interface DamItem {
  id: string
  name: string
  river: string
  location: string
  image: string
  height: string
  storage: string
  reach: string
  type: string
  description: string
}

const DAMS: DamItem[] = [
  {
    id: 'tehri-dam',
    name: 'Tehri Dam',
    river: 'Bhagirathi – Ganga River',
    location: 'Tehri Garhwal, Uttarakhand',
    image: '/Images/tehri_dam.jpg',
    height: '260.5 m',
    storage: '3,540 MCM',
    reach: '105 km Reach',
    type: 'Earth & Rockfill Dam',
    description:
      "Impounding 3,540 million cubic meters of water at a structural height of 260.5 meters in the seismically active Garhwal Himalayas (Zone V), Tehri Dam is Asia's highest earth-and-rockfill structure. An overtopping or piping breach unleashes peak discharges exceeding 24,000 m³/s, funneling through narrow Bhagirathi gorges to submerge Koteshwar, Devprayag, Rishikesh, and the densely populated Haridwar floodplain across a 105 km continuous corridor.",
  },
  {
    id: 'sardar-sarovar-dam',
    name: 'Sardar Sarovar Dam',
    river: 'Narmada River',
    location: 'Kevadiya, Gujarat',
    image: '/Images/sardar_sarovar_dam.jpg',
    height: '163.0 m',
    storage: '9,500 MCM',
    reach: '115 km Reach',
    type: 'Concrete Gravity Dam',
    description:
      'As the flagship terminal concrete gravity structure on the Narmada River impounding 9,500 million cubic meters, Sardar Sarovar commands a critical multi-state drainage basin. Hydrodynamic breach routing models extreme spillway overtopping and progressive structural failure across a 115 km reach, tracking high-celerity flood waves through Kevadiya and Rajpipla into Gujarat’s dense petrochemical and industrial corridor of Bharuch and Ankleshwar before discharging into the Gulf of Khambhat.',
  },
  {
    id: 'bhakra-dam',
    name: 'Bhakra Dam',
    river: 'Satluj River',
    location: 'Bilaspur, Himachal Pradesh',
    image: '/Images/bakhra_dam.jpg',
    height: '226.0 m',
    storage: '9,621 MCM',
    reach: '90 km Reach',
    type: 'Concrete Gravity Dam',
    description:
      'Standing 226 meters high on the Satluj River with 9,621 million cubic meters in the Gobind Sagar reservoir, Bhakra is one of India’s premier high-head concrete gravity dams. The platform simulates sudden structural failure and rapid surge routing over a 90 km downstream corridor, forecasting critical wave arrival times, peak depths, and inundation extents for Nangal Barrage, the historic city of Anandpur Sahib, Kiratpur Sahib, and Rupnagar.',
  },
  {
    id: 'idukki-dam',
    name: 'Idukki Dam',
    river: 'Periyar River',
    location: 'Idukki, Kerala',
    image: '/Images/idukki_dam.jpg',
    height: '168.9 m',
    storage: '1,996 MCM',
    reach: '85 km Reach',
    type: 'Double Curvature Arch Dam',
    description:
      'A 168.9-meter double-curvature thin arch dam wedged between the granite massifs of Kuravan and Kurathi in Kerala’s Western Ghats, Idukki impounds 1,996 million cubic meters in a steep mountain catchment. The system models high-velocity plunge discharges and complex hydraulic shock routing through the steep Periyar river canyon, tracking downstream inundation propagation through Neriamangalam, Kothamangalam, and down to the low-lying urban plains of Aluva.',
  },
  {
    id: 'rishi-ganga',
    name: 'Rishi Ganga Flash Surge',
    river: 'Rishi Ganga – Dhauliganga River',
    location: 'Chamoli, Uttarakhand',
    image: '/Images/rishi_ganga.jpg',
    height: '25.0 m (Barrage)',
    storage: '12.5 MCM',
    reach: '35 km Reach',
    type: 'Glacial Outburst & Surge',
    description:
      'A forensic benchmark reconstructing the catastrophic February 7, 2021 disaster in Chamoli, Uttarakhand, where a massive rock-and-ice avalanche generated an extreme debris-laden flash surge. The hydrodynamic solver models the hyper-concentrated flood wave that destroyed the Rishi Ganga barrage and Tapovan Vishnugad headworks, providing crucial physical calibration for Himalayan Glacial Lake Outburst Floods (GLOFs) along a 35 km mountain gorge.',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { setActiveCaseId } = usePlatform()

  const handleLaunch = (caseId: string, targetPath: string) => {
    setActiveCaseId(caseId)
    router.push(targetPath)
  }

  return (
    <div className="min-h-full w-full max-w-6xl mx-auto space-y-14 pb-20 pt-2">
      {/* ── TOP NAVBAR ───────────────────────────────────────────────── */}
      <nav
        aria-label="Home Navigation Bar"
        className="sticky top-2 z-30 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0C0C10]/85 backdrop-blur-2xl px-5 py-3 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)]"
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0 cursor-pointer group">
          <div className="relative size-9 rounded-xl border border-white/15 bg-white/[0.04] p-1 flex items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="STRATA Logo"
              width={36}
              height={36}
              className="w-full h-full object-contain"
            />
          </div>
          <span
            className="text-2xl font-normal text-white tracking-wide"
            style={{ fontFamily: 'var(--font-satisfy), Satisfy, cursive' }}
          >
            STRATA
          </span>
        </Link>


        {/* Action Buttons: First (Current) and Second (How to use the app) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/map"
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-white/90 transition-colors shadow-md cursor-pointer"
          >
            <Map className="size-3.5" />
            <span className="hidden sm:inline">Open 3D Flood Map</span>
            <span className="sm:hidden">3D Map</span>
          </Link>

          <Link
            href="/guide"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-4 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <HelpCircle className="size-3.5 text-white/70" />
            <span>How to use the app</span>
          </Link>
        </div>
      </nav>

      {/* ── TOP HERO: STRATA & LOGO ──────────────────────────────────── */}
      <header className="flex flex-col items-center text-center space-y-4 pt-4 sm:pt-6">
        <div className="relative size-32 sm:size-40 rounded-3xl p-3 border border-white/12 bg-white/[0.03] backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="STRATA Logo"
            width={160}
            height={160}
            priority
            className="w-full h-full object-contain"
          />
        </div>

        <h1
          className="text-6xl sm:text-7xl md:text-8xl font-normal tracking-wide text-white leading-none select-none"
          style={{ fontFamily: 'var(--font-satisfy), Satisfy, cursive' }}
        >
          STRATA
        </h1>

        <p className="font-mono text-xs sm:text-sm tracking-[0.2em] text-white/60 uppercase">
          Dam Break & River Inundation Intelligence
        </p>

        {/* Hero Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link
            href="/map"
            className="flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors shadow-lg cursor-pointer"
          >
            <Map className="size-4" />
            <span>Open 3D Flood Map</span>
          </Link>

          <Link
            href="/guide"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/30 px-6 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer backdrop-blur-xl"
          >
            <HelpCircle className="size-4 text-white/70" />
            <span>How to use the app</span>
          </Link>
        </div>
      </header>

      {/* ── PROBLEM WE ARE SOLVING ───────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-[#0E0E12]/80 backdrop-blur-2xl p-7 sm:p-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-8">
        <div className="space-y-3">
          <div className="font-mono text-xs text-white/50 tracking-widest uppercase">
            Operational Challenge & Mission
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            What Problem STRATA Solves
          </h2>
          <p className="text-white/80 text-sm sm:text-base leading-relaxed">
            In mountainous terrains and major Indian river catchments, structural dam failures,
            glacial lake outburst floods (GLOFs), and natural landslide blockages present catastrophic
            humanitarian risks. When an impoundment fails or a barrier breaches, millions of cubic meters
            of impounded water discharge into narrow river gorges within minutes, generating supercritical
            flood waves that leave downstream authorities with minimal warning time. Traditional disaster
            planning relies on static precomputed maps that fail to model dynamic physical wave propagation,
            near-field 3D turbulence, and real-time satellite radar observations.
          </p>
        </div>

        {/* 3 Core Capability Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/8">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-medium text-base">
              <Waves className="size-4.5 text-cyan-400" />
              <span>Dual-Solver Physics</span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed font-sans">
              Couples 2D Shallow Water Equations (SWE) for regional 100+ km river routing with 3D Smoothed
              Particle Hydrodynamics (SPH) to capture violent near-field plunge turbulence and dam-toe shockwaves.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-medium text-base">
              <ShieldAlert className="size-4.5 text-amber-400" />
              <span>Downstream Impact Timing</span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed font-sans">
              Calculates deterministic wave front arrival times, peak water depths, flow velocities, and
              settlement inundation footprints across every town and critical bridge along the reach.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-medium text-base">
              <Satellite className="size-4.5 text-emerald-400" />
              <span>Earth Observation Ingestion</span>
            </div>
            <p className="text-xs text-white/60 leading-relaxed font-sans">
              Ingests Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) and Sentinel-2 optical imagery to
              penetrate monsoon clouds, identify upstream obstructions, and validate simulated flood extents.
            </p>
          </div>
        </div>
      </section>

      {/* ── ALTERNATING DAM SHOWCASE ─────────────────────────────────── */}
      <main className="space-y-10">
        <div className="flex flex-col items-center text-center space-y-1.5 pb-2">
          <div className="font-mono text-xs text-white/50 tracking-widest uppercase">
            National Benchmark Case Studies
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Monitored Dam & River Corridors
          </h2>
        </div>

        {DAMS.map((dam, index) => {
          const isEven = index % 2 === 0
          return (
            <section
              key={dam.id}
              className={`flex flex-col ${
                isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } items-center gap-8 lg:gap-12 rounded-3xl border border-white/10 bg-[#0E0E12]/80 backdrop-blur-2xl p-6 lg:p-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]`}
            >
              {/* Dam Visual */}
              <div className="relative w-full lg:w-1/2 h-72 sm:h-80 lg:h-96 rounded-2xl overflow-hidden border border-white/10 bg-black/60 shrink-0">
                <Image
                  src={dam.image}
                  alt={dam.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Dam Specifications, Description & Controls */}
              <div className="w-full lg:w-1/2 flex flex-col justify-between space-y-5">
                <div>
                  <div className="font-mono text-xs text-white/50 uppercase tracking-wider">
                    {dam.river} · {dam.location}
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mt-1">
                    {dam.name}
                  </h2>
                </div>

                {/* Authoritative Description */}
                <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-sans">
                  {dam.description}
                </p>

                {/* Structured Engineering Spec Grid */}
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/8 font-mono">
                  <div>
                    <div className="text-[11px] text-white/40 uppercase">Structural Height</div>
                    <div className="text-base sm:text-lg font-semibold text-white mt-0.5">{dam.height}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/40 uppercase">Gross Storage</div>
                    <div className="text-base sm:text-lg font-semibold text-white mt-0.5">{dam.storage}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/40 uppercase">Downstream Corridor</div>
                    <div className="text-base sm:text-lg font-semibold text-white mt-0.5">{dam.reach}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-white/40 uppercase">Structure Type</div>
                    <div className="text-xs sm:text-sm font-medium text-white/90 mt-0.5">{dam.type}</div>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleLaunch(dam.id, '/map')}
                    className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors cursor-pointer"
                  >
                    <Map className="size-4" />
                    <span>3D Simulation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunch(dam.id, '/dashboard')}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-5 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
                  >
                    <span>Configure Scenario</span>
                    <ArrowRight className="size-4 text-white/60" />
                  </button>
                </div>
              </div>
            </section>
          )
        })}
      </main>

      {/* ── EXPANDABILITY: ONBOARDING NEW DAMS ───────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-[#0E0E12]/80 backdrop-blur-2xl p-7 sm:p-10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] space-y-6">
        <div className="space-y-2">
          <div className="font-mono text-xs text-white/50 tracking-widest uppercase">
            Scalability & Future Expansion
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Currently Modeled for 5 Benchmark Dams — Built to Scale Nationwide
          </h2>
          <p className="text-white/75 text-xs sm:text-sm leading-relaxed font-sans max-w-3xl">
            For rapid validation, institutional benchmarking, and demonstration, STRATA currently incorporates
            pre-processed hydrodynamic datasets for 5 major Indian river basins (Tehri, Sardar Sarovar, Bhakra,
            Idukki, and Rishi Ganga). However, our hydrodynamic simulation architecture is completely modular
            and engineered to onboard any of India’s 5,300+ large dams, barrages, or natural landslide dams.
          </p>
        </div>

        {/* How to Integrate a New Dam (4 Simple Steps) */}
        <div className="pt-4 border-t border-white/8 space-y-4">
          <div className="font-mono text-xs text-cyan-300 uppercase tracking-wider font-medium">
            How Any New Dam or River Corridor Can Be Integrated in 4 Steps:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-1.5">
              <div className="font-mono text-xs text-white/40 font-bold">01 // TOPOGRAPHY</div>
              <div className="text-sm font-semibold text-white">Supply Elevation DEM</div>
              <p className="text-xs text-white/60 leading-relaxed font-sans">
                Upload a standard Digital Elevation Model (Copernicus 30m or ALOS PALSAR 12.5m GeoTIFF) covering the reservoir basin and downstream valley.
              </p>
            </div>

            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-1.5">
              <div className="font-mono text-xs text-white/40 font-bold">02 // DAM SPECS</div>
              <div className="text-sm font-semibold text-white">CWC NRLD Metadata</div>
              <p className="text-xs text-white/60 leading-relaxed font-sans">
                Provide structural parameters: crest elevation, height, Full Reservoir Level (FRL), and gross storage volume from CWC national registries.
              </p>
            </div>

            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-1.5">
              <div className="font-mono text-xs text-white/40 font-bold">03 // RIVER REACH</div>
              <div className="text-sm font-semibold text-white">Centerline & Towns</div>
              <p className="text-xs text-white/60 leading-relaxed font-sans">
                Add the downstream river centerline path (GeoJSON or Shapefile) with monitoring stations and settlement coordinates.
              </p>
            </div>

            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-1.5">
              <div className="font-mono text-xs text-white/40 font-bold">04 // AUTO-SOLVER</div>
              <div className="text-sm font-semibold text-white">Mesh & 3D Inundation</div>
              <p className="text-xs text-white/60 leading-relaxed font-sans">
                STRATA automatically generates the 2D SWE mesh, computes Froehlich breach hydrographs, and animates the 3D flood wave in CesiumJS.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
