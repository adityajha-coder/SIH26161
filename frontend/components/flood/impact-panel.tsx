'use client'

import { useMemo, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MapView } from '@/components/map/map-view'
import { SymbolLegend } from '@/components/map/legend'
import { StatTile } from '@/components/common/panel'
import type { ExposedAsset, FloodBands } from '@/lib/flood-model'
import { formatClock, formatNumber } from '@/lib/format'
import type { ImpactComputation } from '@/lib/use-flood'

export function exposureCollection(impact: ImpactComputation | null): FeatureCollection | null {
  if (!impact) return null
  const all = [...impact.villages, ...impact.hospitals, ...impact.schools]
  return {
    type: 'FeatureCollection',
    features: all.map((a) => ({
      type: 'Feature',
      properties: { name: a.name, kind: a.kind, arrivalS: a.arrivalS, depthM: a.depthM, population: a.population ?? null },
      geometry: { type: 'Point', coordinates: a.lngLat },
    })),
  }
}

export function villagesOnly(impact: ImpactComputation | null) {
  return impact?.villages.filter((v) => v.kind === 'village' || v.kind === 'hamlet') ?? []
}

import { usePlatform } from '@/lib/platform-store'

export function ImpactPanel({ flood, impact }: { flood: FloodBands | null; impact: ImpactComputation | null }) {
  const { activeCase } = usePlatform()
  const [tab, setTab] = useState('areas')
  const exposure = useMemo(() => exposureCollection(impact), [impact])
  const villages = villagesOnly(impact)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="areas">Affected Areas</TabsTrigger>
          <TabsTrigger value="population">Population</TabsTrigger>
          <TabsTrigger value="infra">Infrastructure</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative min-h-52 flex-1 overflow-hidden rounded-md border border-border">
        {tab === 'areas' && (
          <>
            <MapView
              base="satellite"
              flood={flood}
              exposure={exposure}
              layers={{ settlements: false, exposure: true, roads: true, floodDepth: true }}
              floodOpacity={0.55}
              center={activeCase?.center ?? [78.36, 30.14]}
              zoom={activeCase?.zoom ?? 9.9}
              interactive={false}
              className="absolute inset-0"
              ariaLabel="Impact map of affected settlements and facilities"
            />
            <SymbolLegend className="pointer-events-none absolute top-2 right-12" />
          </>
        )}
        {tab === 'population' && <AssetList assets={impact?.villages ?? []} showPopulation empty="No settlements intersect the flood extent." />}
        {tab === 'infra' && (
          <AssetList assets={[...(impact?.hospitals ?? []), ...(impact?.schools ?? [])]} empty="No hospitals or schools intersect the flood extent." />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
        <StatTile label="Villages Affected" value={impact ? villages.length : '—'} />
        <StatTile label="Hospitals at Risk" value={impact ? impact.hospitals.length : '—'} tone="danger" />
        <StatTile label="Schools at Risk" value={impact ? impact.schools.length : '—'} />
        <StatTile label="Road Length Affected" value={impact ? formatNumber(impact.roadKm, 1) : '—'} unit="km" />
      </div>
    </div>
  )
}

function AssetList({ assets, showPopulation, empty }: { assets: ExposedAsset[]; showPopulation?: boolean; empty: string }) {
  if (!assets.length) return <p className="p-4 text-xs text-muted-foreground">{empty}</p>
  return (
    <ScrollArea className="absolute inset-0">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card text-left text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium">Type</th>
            <th className="px-2 py-2 text-right font-medium">Arrival</th>
            <th className="px-3 py-2 text-right font-medium">{showPopulation ? 'Population' : 'Depth'}</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => (
            <tr key={`${a.name}-${i}`} className="border-t border-border/60">
              <td className="max-w-40 truncate px-3 py-1.5 text-foreground">{a.name}</td>
              <td className="px-2 py-1.5 capitalize text-muted-foreground">{a.kind}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{formatClock(a.arrivalS)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                {showPopulation ? (a.population ? formatNumber(a.population) : 'n/a') : `${formatNumber(a.depthM, 1)} m`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}
