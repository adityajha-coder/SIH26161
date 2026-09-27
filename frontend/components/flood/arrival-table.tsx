'use client'

import { useMemo } from 'react'
import { TEHRI } from '@/lib/case-study'
import { chainageOf, type FloodResult } from '@/lib/flood-model'
import { formatClock, formatNumber } from '@/lib/format'
import { useGeoData } from '@/lib/geo'

export function useTownArrivals(result: FloodResult | null) {
  const { reach } = useGeoData()
  return useMemo(() => {
    if (!reach || !result) return []
    return TEHRI.downstreamTowns.map((town) => {
      const { chainageKm } = chainageOf(reach, town.lngLat)
      const st = result.stations.reduce(
        (best, s) => (Math.abs(s.chainageKm - chainageKm) < Math.abs(best.chainageKm - chainageKm) ? s : best),
        result.stations[0],
      )
      const inDomain = chainageKm <= result.reachKm + 0.5
      return { town: town.name, chainageKm, station: inDomain ? st : null }
    })
  }, [reach, result])
}

export function ArrivalTable({ result }: { result: FloodResult | null }) {
  const rows = useTownArrivals(result)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Flood wave arrival at downstream towns</caption>
        <thead className="text-left text-xs text-[#949ba4]">
          <tr className="border-b border-white/[0.08]">
            <th className="py-2 text-left font-medium">Town</th>
            <th className="py-2 text-right font-medium">Chainage</th>
            <th className="py-2 text-right font-medium">Arrival</th>
            <th className="py-2 text-right font-medium">Peak depth</th>
            <th className="py-2 text-right font-medium">Velocity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.town} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-2 text-white font-medium">{r.town}</td>
              <td className="py-2 text-right font-mono tabular-nums text-[#949ba4]">{formatNumber(r.chainageKm, 1)} km</td>
              <td className="py-2 text-right font-mono tabular-nums text-[#dbdee1]">{r.station ? formatClock(r.station.arrivalS) : 'outside domain'}</td>
              <td className="py-2 text-right font-mono tabular-nums font-semibold text-[#7983f5]">{r.station ? `${formatNumber(r.station.peakDepthM, 1)} m` : '—'}</td>
              <td className="py-2 text-right font-mono tabular-nums text-white">{r.station ? `${formatNumber(r.station.velocityMs, 1)} m/s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
