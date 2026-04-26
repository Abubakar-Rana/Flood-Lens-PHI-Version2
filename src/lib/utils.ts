import type { DistrictStats, MetricDef, MetricKey, StatsTable } from './types';

// ─── Number formatting ──────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '–';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return n.toFixed(1).replace(/\.0$/, '');
  return n.toFixed(2);
}

export function formatInt(n: number): string {
  if (!isFinite(n)) return '–';
  return Math.round(n).toLocaleString('en-US');
}

export function formatMetric(value: number | undefined, m: MetricDef): string {
  if (value === undefined || value === null || !isFinite(value)) return '–';
  switch (m.format) {
    case 'integer': return formatInt(value);
    case 'percent': return `${value.toFixed(1)}%`;
    case 'density': return formatNumber(value);
    case 'float':
    default:        return formatNumber(value);
  }
}

// ─── Color ramps ────────────────────────────────────────────────────
// Sequential 5-step ramps. Hot = YlOrRd-ish (low burden -> high burden),
// Cool = YlGn-ish reversed for "more is better", Neutral = blue.

const RAMP_HOT_DARK   = ['#1a2332', '#52443f', '#a06a3c', '#d9603a', '#b91c1c'];
const RAMP_HOT_LIGHT  = ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'];
const RAMP_COOL_DARK  = ['#3a1f2c', '#5b3650', '#3d6b5e', '#4a9c66', '#2bb673'];
const RAMP_COOL_LIGHT = ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'];
const RAMP_NEUT_DARK  = ['#1a2332', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd'];
const RAMP_NEUT_LIGHT = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];

export function getRamp(semantics: 'hot' | 'cool' | 'neutral', isDark: boolean): string[] {
  if (semantics === 'hot') return isDark ? RAMP_HOT_DARK : RAMP_HOT_LIGHT;
  if (semantics === 'cool') return isDark ? RAMP_COOL_DARK : RAMP_COOL_LIGHT;
  return isDark ? RAMP_NEUT_DARK : RAMP_NEUT_LIGHT;
}

// ─── Quantile breaks ────────────────────────────────────────────────
// Compute 5 quantile bin edges over the visible district values for the
// active metric. Quantile-based breaks make the choropleth informative
// even when one or two districts dominate the distribution.

export function quantileBreaks(values: number[], n = 5): number[] {
  const finite = values.filter(v => isFinite(v) && v > 0).sort((a, b) => a - b);
  if (finite.length === 0) return [0, 0, 0, 0, 0];
  const breaks: number[] = [];
  for (let i = 1; i <= n; i++) {
    const idx = Math.floor((i / n) * (finite.length - 1));
    breaks.push(finite[idx]);
  }
  return breaks;
}

export function bucketIndex(value: number, breaks: number[]): number {
  if (!isFinite(value) || value <= 0) return 0;
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return i;
  }
  return breaks.length - 1;
}

// ─── Stats helpers ──────────────────────────────────────────────────

export function metricValues(stats: StatsTable, key: MetricKey, ids?: Set<string>): number[] {
  const out: number[] = [];
  for (const [id, d] of Object.entries(stats)) {
    if (ids && !ids.has(id)) continue;
    const v = (d as Record<string, unknown>)[key];
    if (typeof v === 'number') out.push(v);
  }
  return out;
}

export function topN(stats: StatsTable, key: MetricKey, n = 10, ids?: Set<string>):
    Array<{ id: string; data: DistrictStats; value: number }> {
  const arr = Object.entries(stats)
    .filter(([id]) => !ids || ids.has(id))
    .map(([id, d]) => ({ id, data: d, value: ((d as Record<string, unknown>)[key] as number) ?? 0 }))
    .filter(x => isFinite(x.value));
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, n);
}

export function bottomN(stats: StatsTable, key: MetricKey, n = 10, ids?: Set<string>):
    Array<{ id: string; data: DistrictStats; value: number }> {
  const arr = Object.entries(stats)
    .filter(([id]) => !ids || ids.has(id))
    .map(([id, d]) => ({ id, data: d, value: ((d as Record<string, unknown>)[key] as number) ?? 0 }))
    .filter(x => isFinite(x.value));
  arr.sort((a, b) => a.value - b.value);
  return arr.slice(0, n);
}

export function distinctProvinces(stats: StatsTable): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const d of Object.values(stats)) {
    if (d.parent_id && d.parent_name && !map.has(d.parent_id)) {
      map.set(d.parent_id, d.parent_name);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function distinctAmenities(stats: StatsTable): string[] {
  const set = new Set<string>();
  for (const d of Object.values(stats)) {
    for (const k of Object.keys(d.health_amenity_breakdown ?? {})) set.add(k);
  }
  return Array.from(set).sort();
}

// ─── CSV export ─────────────────────────────────────────────────────

export function statsToCsv(stats: StatsTable, ids: string[]): string {
  if (ids.length === 0) return '';
  const sample = stats[ids[0]];
  if (!sample) return '';
  const numericKeys: (keyof DistrictStats)[] = [
    'area_sqkm', 'affected_pop_total', 'affected_pop_mean', 'affected_pop_max',
    'affected_pop_density', 'affected_child_pop_total', 'affected_child_pop_mean',
    'child_share_pct', 'health_count', 'school_count',
    'health_per_1k_sqkm', 'school_per_1k_sqkm',
    'health_per_100k_affected', 'school_per_100k_affected_children',
  ];
  const header = ['id', 'name', 'province_id', 'province_name', ...numericKeys].join(',');
  const lines = ids.map(id => {
    const d = stats[id];
    if (!d) return '';
    const csv = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const num = (n: number) => isFinite(n) ? n.toString() : '';
    return [
      csv(id), csv(d.name), csv(d.parent_id ?? ''), csv(d.parent_name ?? ''),
      ...numericKeys.map(k => num(d[k] as number)),
    ].join(',');
  });
  return [header, ...lines].join('\n');
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
