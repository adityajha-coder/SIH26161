'use client'

import { useMemo } from 'react'
import { TEHRI } from '@/lib/case-study'
import { chainageOf, type FloodResult } from '@/lib/flood-model'
import { formatClock, formatNumber } from '@/lib/format'
import { useGeoData } from '@/lib/geo'

import { usePlatform } from '@/lib/platform-store'

export function useTownArrivals(
  result: FloodResult | null,
  customTowns?: { name: string; lngLat: [number, number]; chainageKm: number }[]
) {
  const { activeCase } = usePlatform()
  const towns = customTowns ?? activeCase?.downstreamTowns ?? TEHRI.downstreamTowns

  return useMemo(() => {
    if (!result || !result.stations || result.stations.length === 0) return []
    return towns.map((town) => {
      const chainageKm = town.chainageKm
      const st = result.stations.reduce(
        (best, s) => (Math.abs(s.chainageKm - chainageKm) < Math.abs(best.chainageKm - chainageKm) ? s : best),
        result.stations[0],
      )
      const inDomain = chainageKm <= result.reachKm + 1.0
      return { town: town.name, chainageKm, station: inDomain ? st : null }
    })
  }, [result, towns])
}

export function ArrivalTable({
  result,
  towns,
}: {
  result: FloodResult | null
  towns?: { name: string; lngLat: [number, number]; chainageKm: number }[]
}) {
  const rows = useTownArrivals(result, towns)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Flood wave arrival at downstream towns</caption>
        <thead className="text-left text-xs text-[#949ba4]">
          <tr className="border-b border-white/8">
            <th className="py-2 text-left font-medium">Town</th>
            <th className="py-2 text-right font-medium">Chainage</th>
            <th className="py-2 text-right font-medium">Arrival</th>
            <th className="py-2 text-right font-medium">Peak depth</th>
            <th className="py-2 text-right font-medium">Velocity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.town} className="border-b border-white/4 hover:bg-white/2 transition-colors">
              <td className="py-2 text-white font-medium">{r.town}</td>
              <td className="py-2 text-right font-mono tabular-nums text-[#949ba4]">{formatNumber(r.chainageKm, 1)} km</td>
              <td className="py-2 text-right font-mono tabular-nums text-[#dbdee1]">{r.station ? formatClock(r.station.arrivalS) : 'outside domain'}</td>
              <td className="py-2 text-right font-mono tabular-nums font-semibold text-white">{r.station ? `${formatNumber(r.station.peakDepthM, 1)} m` : '—'}</td>
              <td className="py-2 text-right font-mono tabular-nums text-white">{r.station ? `${formatNumber(r.station.velocityMs, 1)} m/s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
