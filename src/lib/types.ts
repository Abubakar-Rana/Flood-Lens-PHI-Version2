// Frontend type contracts. The shapes below mirror what the Python ETL writes
// to public/web-data/. If you change a field name here, update etl/stats.py
// and etl/registry.py to match.

export type AdminLevel = 'admin0' | 'admin1' | 'admin2';

export interface CountryInfo {
  code: string;             // 'pak'
  name: string;             // 'Pakistan'
  iso3: string;             // 'PAK'
  levels: number[];         // [0, 1, 2]  (India = [0, 2])
  bbox: [number, number, number, number] | null;
  center: [number, number] | null;  // [lat, lon]
  totals: CountryTotals;
}

export interface CountryTotals {
  affected_pop_total: number;
  affected_child_pop_total: number;
  health_count: number;
  school_count: number;
  area_sqkm: number;
  district_count: number;
  health_amenity_breakdown: Record<string, number>;
}

export interface CountriesIndex {
  countries: CountryInfo[];
}

export interface DistrictStats {
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  area_sqkm: number;
  center_lat: number | null;
  center_lon: number | null;

  affected_pop_total: number;
  affected_pop_mean: number;
  affected_pop_max: number;

  affected_child_pop_total: number;
  affected_child_pop_mean: number;
  affected_child_pop_max: number;

  child_share_pct: number;

  health_count: number;
  school_count: number;
  health_per_1k_sqkm: number;
  school_per_1k_sqkm: number;
  health_per_100k_affected: number;
  school_per_100k_affected_children: number;
  affected_pop_density: number;

  health_amenity_breakdown: Record<string, number>;

  // Required for dynamic-key access (stats[id][metricKey]) without unsafe casts
  [k: string]: unknown;
}

// Map of district_id -> DistrictStats
export type StatsTable = Record<string, DistrictStats>;

// ─── Metric catalog ───────────────────────────────────────────────────────
// Every metric the user can choropleth/filter/rank by. Keys must match
// DistrictStats fields exactly.

export type MetricKey =
  | 'affected_pop_total'
  | 'affected_pop_mean'
  | 'affected_pop_max'
  | 'affected_pop_density'
  | 'affected_child_pop_total'
  | 'affected_child_pop_mean'
  | 'child_share_pct'
  | 'health_count'
  | 'school_count'
  | 'health_per_1k_sqkm'
  | 'school_per_1k_sqkm'
  | 'health_per_100k_affected'
  | 'school_per_100k_affected_children'
  | 'affected_per_health_facility'
  | 'affected_children_per_school'
  | 'area_sqkm';

export interface MetricDef {
  key: MetricKey;
  label: string;
  short: string;
  unit?: string;
  // Color semantics: 'hot' = higher is worse (people affected), use red ramp.
  // 'cool' = higher is better (services per capita), use green ramp.
  // 'neutral' = neither — use blue ramp (e.g. area).
  semantics: 'hot' | 'cool' | 'neutral';
  // 'integer' / 'float' / 'percent' / 'density' — controls formatting
  format: 'integer' | 'float' | 'percent' | 'density';
  group: 'population' | 'children' | 'health' | 'schools' | 'geography';
  description: string;
}

export const METRICS: MetricDef[] = [
  { key: 'affected_pop_total', label: 'Exposed Population (total)', short: 'Total',
    semantics: 'hot', format: 'integer', group: 'population',
    description: 'Sum of raster pixels in the district. People exposed to the flood hazard.' },
  { key: 'affected_pop_mean', label: 'Exposed Population (mean per pixel)', short: 'Mean per pixel',
    semantics: 'hot', format: 'float', group: 'population',
    description: 'Average exposed count per ~100m pixel.' },
  { key: 'affected_pop_max', label: 'Exposed Population (peak pixel)', short: 'Peak per pixel',
    semantics: 'hot', format: 'integer', group: 'population',
    description: 'Maximum exposed count in a single pixel — hotspot intensity.' },
  { key: 'affected_pop_density', label: 'Exposed Population Density', short: 'Density',
    unit: '/km²', semantics: 'hot', format: 'density', group: 'population',
    description: 'Total exposed divided by district area.' },

  { key: 'affected_child_pop_total', label: 'Exposed Children (total)', short: 'Total',
    semantics: 'hot', format: 'integer', group: 'children',
    description: 'Sum of raster pixels for the exposed-children layer.' },
  { key: 'affected_child_pop_mean', label: 'Exposed Children (mean per pixel)', short: 'Mean per pixel',
    semantics: 'hot', format: 'float', group: 'children',
    description: 'Average exposed children per pixel.' },
  { key: 'child_share_pct', label: 'Children share of Exposed', short: 'Share',
    unit: '%', semantics: 'hot', format: 'percent', group: 'children',
    description: 'exposed_children / exposed_pop × 100.' },

  { key: 'health_count', label: 'Exposed Health Facilities (count)', short: 'Count',
    semantics: 'cool', format: 'integer', group: 'health',
    description: 'Health facilities (hospitals, clinics, pharmacies, etc.) inside the flood-exposed zones of this district.' },
  { key: 'health_per_1k_sqkm', label: 'Exposed Health Facilities per 1000 km²', short: 'Per 1000 km²',
    unit: '/1000km²', semantics: 'cool', format: 'float', group: 'health',
    description: 'Geographic density of exposed health facilities.' },
  { key: 'health_per_100k_affected', label: 'Exposed Health Facilities per 100k Exposed', short: 'Per 100k exposed',
    unit: '/100k', semantics: 'cool', format: 'float', group: 'health',
    description: 'Per-capita availability of exposed health facilities for the exposed population.' },

  { key: 'school_count', label: 'Exposed Schools (count)', short: 'Count',
    semantics: 'cool', format: 'integer', group: 'schools',
    description: 'Schools inside the flood-exposed zones of this district.' },
  { key: 'school_per_1k_sqkm', label: 'Exposed Schools per 1000 km²', short: 'Per 1000 km²',
    unit: '/1000km²', semantics: 'cool', format: 'float', group: 'schools',
    description: 'Geographic density of exposed schools.' },
  { key: 'school_per_100k_affected_children', label: 'Exposed Schools per 100k Exposed Children', short: 'Per 100k children',
    unit: '/100k', semantics: 'cool', format: 'float', group: 'schools',
    description: 'Per-capita availability of exposed schools for the exposed children.' },

  // Service-strain metrics — higher means each facility/school is serving more people.
  { key: 'affected_per_health_facility', label: 'Exposed People per Health Facility', short: 'People per facility',
    semantics: 'hot', format: 'integer', group: 'health',
    description: 'How many exposed people share each exposed health facility — service-strain indicator.' },
  { key: 'affected_children_per_school', label: 'Exposed Children per School', short: 'Children per school',
    semantics: 'hot', format: 'integer', group: 'schools',
    description: 'How many exposed children share each exposed school — service-strain indicator.' },

  { key: 'area_sqkm', label: 'Area', short: 'Area', unit: 'km²',
    semantics: 'neutral', format: 'float', group: 'geography',
    description: 'District area in square kilometres.' },
];

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> =
  METRICS.reduce((a, m) => { a[m.key] = m; return a; }, {} as Record<MetricKey, MetricDef>);

// ─── App state shape ─────────────────────────────────────────────────────

export type PointLayer = 'health' | 'schools';

export interface FilterState {
  countryCode: string;
  level: AdminLevel;            // current choropleth level
  metric: MetricKey;
  // Currently selected region — district id at admin2, province id at admin1,
  // null at admin0 / no selection.
  selectedRegionId: string | null;
  // Multi-selects (empty Set = no filter applied)
  provinceFilter: Set<string>;  // province ids; restricts what's shown on the map
  amenityFilter: Set<string>;   // subset of flood-aff. health amenity types
  // Numeric filter on the active metric. null = no bound.
  metricMin: number | null;
  metricMax: number | null;
  // Visible point overlays
  pointLayers: Set<PointLayer>;
  // Search query against district/province name
  search: string;
  // Active preset (one-click filter combo) — null when none.
  preset: PresetKey | null;
  // Hide regions where flood-affected pop is 0 (outside flood mask).
  hideZeroAffected: boolean;
}

export type PresetKey = 'hotspots' | 'service_gap' | 'underserved_schools' | 'worst_combined';

export interface PresetDef {
  key: PresetKey;
  label: string;
  description: string;
  metric: MetricKey;
  // 'top' = filter to top quintile of metric, 'bottom' = bottom quintile.
  direction: 'top' | 'bottom';
}

export const PRESETS: PresetDef[] = [
  { key: 'hotspots', label: 'Hotspots',
    description: 'Top 20% by total flood-affected population.',
    metric: 'affected_pop_total', direction: 'top' },
  { key: 'service_gap', label: 'Service Gap',
    description: 'Top 20% by flood-affected people per health facility — most strained.',
    metric: 'affected_per_health_facility', direction: 'top' },
  { key: 'underserved_schools', label: 'Underserved Schools',
    description: 'Top 20% by flood-affected children per school — most strained.',
    metric: 'affected_children_per_school', direction: 'top' },
  { key: 'worst_combined', label: 'Worst Combined',
    description: 'Districts with the highest affected children — focus areas for relief.',
    metric: 'affected_child_pop_total', direction: 'top' },
];
