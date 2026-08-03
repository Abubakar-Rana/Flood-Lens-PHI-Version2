// Data loader. Caches everything in memory — files are static and small.

import type { FeatureCollection } from 'geojson';
import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type {
  CountriesIndex, CountryInfo, EventFacts, StatsTable, Timeline, YearDef, YearRegistry,
} from './types';
import { augmentStats } from './utils';

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

export async function loadYears(): Promise<YearRegistry> {
  return fetchJson<YearRegistry>('/web-data/years.json');
}

/** Stats for one country in one year. Files are per (country, year), so
 *  switching either dimension fetches exactly one small JSON and nothing
 *  already in memory is refetched. Adding a future event year means dropping
 *  in one more file plus a registry entry — no code change here. */
export async function loadStats(countryCode: string, year?: YearDef | string): Promise<StatsTable> {
  const file = typeof year === 'string'
    ? (year === '2025' ? 'stats.json' : `stats-${year}.json`)
    : (year?.statsFile ?? 'stats.json');
  const cacheKey = `stats:${countryCode}:${file}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) as StatsTable;
  const raw = await fetchJson<StatsTable>(`/web-data/${countryCode}/${file}`);
  // Augment in-place with the two derived service-strain metrics. The
  // file-level cache (above) returns the same reference for repeat calls,
  // so we tag the augmented table separately to avoid double-augmenting.
  const augmented = augmentStats(raw);
  cache.set(cacheKey, augmented);
  return augmented;
}

export async function loadEvent(countryCode: string, year: YearDef): Promise<EventFacts | null> {
  if (!year.eventFile) return null;
  return fetchJson<EventFacts>(`/web-data/${countryCode}/${year.eventFile}`);
}

export async function loadTimeline(countryCode: string): Promise<Timeline> {
  return fetchJson<Timeline>(`/web-data/${countryCode}/timeline.json`);
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
