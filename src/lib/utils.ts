import type { DistrictStats, MetricDef, MetricKey, PresetDef, StatsTable } from './types';

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

// ─── Derived per-row metrics ────────────────────────────────────────
// Augment a stats row with the two service-strain metrics. Mutates `out`.

export function withDerivedMetrics(d: DistrictStats): DistrictStats {
  const ap = d.affected_pop_total || 0;
  const ac = d.affected_child_pop_total || 0;
  const hc = d.health_count || 0;
  const sc = d.school_count || 0;
  d.affected_per_health_facility = hc > 0 ? ap / hc : 0;
  d.affected_children_per_school = sc > 0 ? ac / sc : 0;
  return d;
}

export function augmentStats(stats: StatsTable): StatsTable {
  for (const id of Object.keys(stats)) withDerivedMetrics(stats[id]);
  return stats;
}

// ─── Province aggregation ────────────────────────────────────────────
// Build a virtual stats table keyed by province id, by summing the additive
// fields across districts that share parent_id and recomputing derived ones.
// Cached per source-table identity to avoid recomputing on every render.

const provinceAggCache = new WeakMap<StatsTable, StatsTable>();

export function provinceAggregates(stats: StatsTable): StatsTable {
  const cached = provinceAggCache.get(stats);
  if (cached) return cached;

  const groups = new Map<string, DistrictStats[]>();
  for (const d of Object.values(stats)) {
    if (!d.parent_id) continue;
    const list = groups.get(d.parent_id) ?? [];
    list.push(d);
    groups.set(d.parent_id, list);
  }

  const out: StatsTable = {};
  for (const [pid, members] of groups.entries()) {
    const name = members[0].parent_name ?? pid;
    let area = 0, ap = 0, apMax = 0, apMeanWeighted = 0, pixCnt = 0;
    let ac = 0, acMax = 0, acMeanWeighted = 0, pixCntChild = 0;
    let hc = 0, sc = 0;
    let lat = 0, lon = 0, latLonCount = 0;
    const amenity: Record<string, number> = {};
    for (const d of members) {
      area += d.area_sqkm || 0;
      ap += d.affected_pop_total || 0;
      apMax = Math.max(apMax, d.affected_pop_max || 0);
      // Approximate weighted mean using mean × pixels (we don't store pixels
      // post-ETL; fall back to mean × district count if absent).
      apMeanWeighted += (d.affected_pop_mean || 0) * (d.affected_pop_total || 0);
      pixCnt += (d.affected_pop_total || 0);

      ac += d.affected_child_pop_total || 0;
      acMax = Math.max(acMax, d.affected_child_pop_max || 0);
      acMeanWeighted += (d.affected_child_pop_mean || 0) * (d.affected_child_pop_total || 0);
      pixCntChild += (d.affected_child_pop_total || 0);

      hc += d.health_count || 0;
      sc += d.school_count || 0;
      if (d.center_lat != null && d.center_lon != null) {
        lat += d.center_lat; lon += d.center_lon; latLonCount++;
      }
      for (const [k, v] of Object.entries(d.health_amenity_breakdown || {})) {
        amenity[k] = (amenity[k] ?? 0) + v;
      }
    }

    const row: DistrictStats = {
      name,
      parent_id: null,
      parent_name: null,
      area_sqkm: area,
      center_lat: latLonCount ? lat / latLonCount : null,
      center_lon: latLonCount ? lon / latLonCount : null,
      affected_pop_total: ap,
      affected_pop_mean: pixCnt > 0 ? apMeanWeighted / pixCnt : 0,
      affected_pop_max: apMax,
      affected_child_pop_total: ac,
      affected_child_pop_mean: pixCntChild > 0 ? acMeanWeighted / pixCntChild : 0,
      affected_child_pop_max: acMax,
      child_share_pct: ap > 0 ? (ac / ap) * 100 : 0,
      health_count: hc,
      school_count: sc,
      health_per_1k_sqkm: area > 0 ? (hc * 1000) / area : 0,
      school_per_1k_sqkm: area > 0 ? (sc * 1000) / area : 0,
      health_per_100k_affected: ap > 0 ? (hc * 100000) / ap : 0,
      school_per_100k_affected_children: ac > 0 ? (sc * 100000) / ac : 0,
      affected_pop_density: area > 0 ? ap / area : 0,
      health_amenity_breakdown: amenity,
    };
    withDerivedMetrics(row);
    out[pid] = row;
  }

  provinceAggCache.set(stats, out);
  return out;
}

// Pick the right stats table for the current admin level.
export function statsForLevel(districtStats: StatsTable, level: 'admin0' | 'admin1' | 'admin2'): StatsTable {
  if (level === 'admin1') return provinceAggregates(districtStats);
  return districtStats;
}

// ─── Impact tier (for layman labels) ─────────────────────────────────
// Five tiers based on quantile of affected_pop_total within the active
// stats table. Returns { tier, label, color }.

export interface ImpactTier {
  index: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

const TIER_LABELS = ['Minimal', 'Low', 'Moderate', 'High', 'Very High'];
const TIER_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#dc2626'];

export function impactTier(value: number, breaks: number[]): ImpactTier {
  const idx = bucketIndex(value, breaks) as 0 | 1 | 2 | 3 | 4;
  return { index: idx, label: TIER_LABELS[idx], color: TIER_COLORS[idx] };
}

// ─── Stats helpers ──────────────────────────────────────────────────

export function metricValues(stats: StatsTable, key: MetricKey, ids?: Set<string>): number[] {
  const out: number[] = [];
  for (const [id, d] of Object.entries(stats)) {
    if (ids && !ids.has(id)) continue;
    const v = (d as unknown as Record<string, unknown>)[key];
    if (typeof v === 'number') out.push(v);
  }
  return out;
}

export function topN(stats: StatsTable, key: MetricKey, n = 10, ids?: Set<string>):
    Array<{ id: string; data: DistrictStats; value: number }> {
  const arr = Object.entries(stats)
    .filter(([id]) => !ids || ids.has(id))
    .map(([id, d]) => ({ id, data: d, value: ((d as unknown as Record<string, unknown>)[key] as number) ?? 0 }))
    .filter(x => isFinite(x.value));
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, n);
}

export function bottomN(stats: StatsTable, key: MetricKey, n = 10, ids?: Set<string>):
    Array<{ id: string; data: DistrictStats; value: number }> {
  const arr = Object.entries(stats)
    .filter(([id]) => !ids || ids.has(id))
    .map(([id, d]) => ({ id, data: d, value: ((d as unknown as Record<string, unknown>)[key] as number) ?? 0 }))
    .filter(x => isFinite(x.value));
  arr.sort((a, b) => a.value - b.value);
  return arr.slice(0, n);
}

export function distinctAmenities(stats: StatsTable): string[] {
  const set = new Set<string>();
  for (const d of Object.values(stats)) {
    for (const k of Object.keys(d.health_amenity_breakdown ?? {})) set.add(k);
  }
  return Array.from(set).sort();
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

// ─── Preset application ────────────────────────────────────────────
// A preset sets the active metric and a numeric range that captures the
// top-quintile (or bottom-quintile) districts. Returns null if data
// has no positive values.

export function presetRange(stats: StatsTable, p: PresetDef): { min: number | null; max: number | null } | null {
  const vs = metricValues(stats, p.metric).filter(v => v > 0);
  if (vs.length === 0) return null;
  vs.sort((a, b) => a - b);
  if (p.direction === 'top') {
    const cut = vs[Math.floor(vs.length * 0.8)];
    return { min: cut, max: null };
  } else {
    const cut = vs[Math.floor(vs.length * 0.2)];
    return { min: null, max: cut };
  }
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
    'affected_per_health_facility', 'affected_children_per_school',
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
