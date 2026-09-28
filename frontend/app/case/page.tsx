'use client'

import { Mountain, MapPin, Compass, Database, CheckCircle2, Clock } from 'lucide-react'
import { Panel } from '@/components/common/panel'
import { CASES, type CaseStudy, type CaseDataset, type DatasetStatus } from '@/lib/case-study'
import { usePlatform } from '@/lib/platform-store'

export default function CaseStudyPage() {
  const { activeCaseId, activeCase, setActiveCaseId } = usePlatform()

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-white" />
            <h1 className="text-xl font-bold text-white tracking-tight">Case Study Dossier</h1>
            <span className="font-mono text-xs font-semibold text-white/90 ml-2">
              {activeCase.role === 'primary' ? 'Primary Benchmark' : 'Sanity Benchmark'}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#949ba4] max-w-2xl leading-relaxed">
            Hydrographic reach geometry, dam structural design parameters, and downstream vulnerability inventory for hydrodynamic modeling.
          </p>
        </div>

        {/* Case Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/8 bg-white/2 p-1 self-start sm:self-auto">
          {CASES.map((cs: CaseStudy) => (
            <button
              key={cs.id}
              onClick={() => setActiveCaseId(cs.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                cs.id === activeCaseId
                  ? 'bg-white text-black'
                  : 'text-[#949ba4] hover:text-white hover:bg-white/4'
              }`}
            >
              {cs.name} ({cs.state})
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Dam Engineering Specs */}
        <div className="lg:col-span-6 space-y-4">
          <Panel
            title="Structural Dam Specifications"
            actions={
              <span className="font-mono text-xs text-white/80">
                {activeCase.dam.source}
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="glass-panel-subtle rounded-xl p-4">
                <span className="text-xs font-medium text-[#949ba4] block">
                  Structural height
                </span>
                <span className="text-2xl font-bold font-mono text-white block mt-1">
                  {activeCase.dam.heightM > 0 ? `${activeCase.dam.heightM} m` : 'River Blockage'}
                </span>
                <span className="text-[11px] text-[#949ba4] mt-1 block">
                  {activeCase.dam.type}
                </span>
              </div>

              <div className="glass-panel-subtle rounded-xl p-4">
                <span className="text-xs font-medium text-[#949ba4] block">
                  Crest length
                </span>
                <span className="text-2xl font-bold font-mono text-white block mt-1">
                  {activeCase.dam.crestLengthM > 0 ? `${activeCase.dam.crestLengthM} m` : '—'}
                </span>
                <span className="text-[11px] text-[#949ba4] mt-1 block">
                  Crest El: {activeCase.dam.crestElevationM > 0 ? `${activeCase.dam.crestElevationM} m a.s.l` : '—'}
                </span>
              </div>

              <div className="glass-panel-subtle rounded-xl p-4">
                <span className="text-xs font-medium text-[#949ba4] block">
                  Gross reservoir storage
                </span>
                <span className="text-2xl font-bold font-mono text-[#23a55a] block mt-1">
                  {activeCase.dam.grossStorageMcm > 0 ? `${activeCase.dam.grossStorageMcm} MCM` : '—'}
                </span>
                <span className="text-[11px] text-[#949ba4] mt-1 block">
                  Live: {activeCase.dam.liveStorageMcm > 0 ? `${activeCase.dam.liveStorageMcm} MCM` : '—'}
                </span>
              </div>

              <div className="glass-panel-subtle rounded-xl p-4">
                <span className="text-xs font-medium text-[#949ba4] block">
                  Catchment drainage area
                </span>
                <span className="text-2xl font-bold font-mono text-[#f0b232] block mt-1">
                  {activeCase.dam.catchmentKm2 > 0 ? `${activeCase.dam.catchmentKm2} km²` : '—'}
                </span>
                <span className="text-[11px] text-[#949ba4] mt-1 block">
                  Commissioned: {activeCase.dam.commissioned > 0 ? activeCase.dam.commissioned : '—'}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="River Reach & Geography">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="glass-panel-subtle rounded-xl p-3.5">
                <span className="text-xs font-medium text-[#949ba4] block">Main stem</span>
                <span className="text-sm font-semibold text-white block mt-1">{activeCase.river}</span>
              </div>
              <div className="glass-panel-subtle rounded-xl p-3.5">
                <span className="text-xs font-medium text-[#949ba4] block">Simulated reach length</span>
                <span className="text-sm font-semibold font-mono text-white block mt-1">{activeCase.reachKm} km</span>
              </div>
              <div className="col-span-2 glass-panel-subtle rounded-xl p-3.5">
                <span className="text-xs font-medium text-[#949ba4] block">Geographic bounding box</span>
                <span className="text-xs font-mono text-white block mt-1">
                  [{activeCase.bbox.join(', ')}]
                </span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Column: Downstream & Datasets */}
        <div className="lg:col-span-6 space-y-4">
          <Panel
            title="Downstream Chainage Stations"
            actions={
              <span className="font-mono text-xs font-semibold text-white/90">
                {activeCase.downstreamTowns.length} monitoring stations
              </span>
            }
          >
            <div className="space-y-2 pt-1">
              {activeCase.downstreamTowns.map((town: { name: string; lngLat: [number, number]; chainageKm: number }, idx: number) => (
                <div
                  key={town.name}
                  className="glass-panel-subtle flex items-center gap-3.5 rounded-lg px-3.5 py-3 hover:border-white/16 transition-colors"
                >
                  <div className="flex size-7 items-center justify-center rounded-full border border-white/8 bg-white/3 text-xs font-mono font-semibold text-white">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{town.name}</p>
                    <p className="text-xs text-[#949ba4] font-mono mt-0.5">
                      Chainage: {town.chainageKm} km · [{town.lngLat[0].toFixed(4)}, {town.lngLat[1].toFixed(4)}]
                    </p>
                  </div>
                  <MapPin className="size-4 text-white shrink-0" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Dataset Manifest"
            actions={
              <span className="font-mono text-xs font-semibold text-white/90">
                {activeCase.datasets.length} layers
              </span>
            }
          >
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8 text-[#949ba4]">
                    <th className="py-2 text-left font-medium">Dataset</th>
                    <th className="py-2 text-left font-medium">Source</th>
                    <th className="py-2 text-left font-medium">Res</th>
                    <th className="py-2 text-left font-medium">CRS</th>
                    <th className="py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCase.datasets.map((ds: CaseDataset) => (
                    <tr key={ds.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                      <td className="py-2 font-semibold text-white">{ds.name}</td>
                      <td className="py-2 text-[#949ba4]">{ds.source}</td>
                      <td className="py-2 font-mono text-[#dbdee1]">{ds.resolution}</td>
                      <td className="py-2 font-mono text-[#dbdee1]">{ds.crs}</td>
                      <td className="py-2 text-right">
                        {ds.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1.5 text-[#23a55a] font-semibold font-mono text-[11px]">
                            <span className="size-1.5 rounded-full bg-[#23a55a]" />
                            Ready
                          </span>
                        ) : ds.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1.5 text-[#f0b232] font-semibold font-mono text-[11px]">
                            <span className="size-1.5 rounded-full bg-[#f0b232]" />
                            Processing
                          </span>
                        ) : (
                          <span className="text-[#f23f43] font-semibold font-mono text-[11px]">Missing</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
