// Data loader. Caches everything in memory — files are static and small.

import type { FeatureCollection } from 'geojson';
import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { CountriesIndex, CountryInfo, StatsTable } from './types';

const cache = new Map<string, unknown>();

async function fetchJson<T>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url) as T;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  const j = (await r.json()) as T;
  cache.set(url, j);
  return j;
}

export async function loadCountries(): Promise<CountriesIndex> {
  return fetchJson<CountriesIndex>('/web-data/countries.json');
}

export async function loadStats(countryCode: string): Promise<StatsTable> {
  return fetchJson<StatsTable>(`/web-data/${countryCode}/stats.json`);
}

export async function loadBoundary(countryCode: string, level: 0 | 1 | 2): Promise<FeatureCollection> {
  const url = `/web-data/${countryCode}/admin${level}.topojson`;
  const topo = await fetchJson<Topology>(url);
  // Each TopoJSON has exactly one object — pick the first.
  const objKey = Object.keys(topo.objects)[0];
  const obj = topo.objects[objKey] as GeometryCollection;
  const fc = topoFeature(topo, obj) as unknown as FeatureCollection;
  return fc;
}

export async function loadPoints(countryCode: string, kind: 'health' | 'schools'): Promise<FeatureCollection> {
  return fetchJson<FeatureCollection>(`/web-data/${countryCode}/${kind}.geojson`);
}

export function getCountry(idx: CountriesIndex, code: string): CountryInfo | undefined {
  return idx.countries.find(c => c.code === code);
}
