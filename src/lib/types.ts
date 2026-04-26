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
  { key: 'affected_pop_total', label: 'Affected Population (total)', short: 'Affected pop.',
    semantics: 'hot', format: 'integer', group: 'population',
    description: 'Sum of raster pixels in the district. People exposed to the hazard.' },
  { key: 'affected_pop_mean', label: 'Affected Population (mean per pixel)', short: 'Mean affected/px',
    semantics: 'hot', format: 'float', group: 'population',
    description: 'Average affected count per ~100m pixel.' },
  { key: 'affected_pop_max', label: 'Affected Population (peak pixel)', short: 'Peak affected/px',
    semantics: 'hot', format: 'integer', group: 'population',
    description: 'Maximum affected count in a single pixel — hotspot intensity.' },
  { key: 'affected_pop_density', label: 'Affected Population Density', short: 'Affected /km²',
    unit: '/km²', semantics: 'hot', format: 'density', group: 'population',
    description: 'Total affected divided by district area.' },

  { key: 'affected_child_pop_total', label: 'Affected Children (total)', short: 'Affected children',
    semantics: 'hot', format: 'integer', group: 'children',
    description: 'Sum of raster pixels for child-affected layer.' },
  { key: 'affected_child_pop_mean', label: 'Affected Children (mean per pixel)', short: 'Mean children/px',
    semantics: 'hot', format: 'float', group: 'children',
    description: 'Average affected children per pixel.' },
  { key: 'child_share_pct', label: 'Children share of Affected', short: 'Children %',
    unit: '%', semantics: 'hot', format: 'percent', group: 'children',
    description: 'affected_children / affected_pop × 100.' },

  { key: 'health_count', label: 'Flood-Affected Health Facilities (count)', short: 'Flood-Aff. Health #',
    semantics: 'cool', format: 'integer', group: 'health',
    description: 'Health facilities (hospitals, clinics, pharmacies, etc.) located inside flood-affected zones in this district.' },
  { key: 'health_per_1k_sqkm', label: 'Flood-Affected Health Facilities per 1000 km²', short: 'Flood-Aff. Health /1k km²',
    unit: '/1000km²', semantics: 'cool', format: 'float', group: 'health',
    description: 'Geographic density of flood-affected health facilities.' },
  { key: 'health_per_100k_affected', label: 'Flood-Affected Health Facilities per 100k Affected', short: 'Flood-Aff. Health /100k aff.',
    unit: '/100k', semantics: 'cool', format: 'float', group: 'health',
    description: 'Per-capita availability of flood-affected health facilities for the flood-affected population.' },

  { key: 'school_count', label: 'Flood-Affected Schools (count)', short: 'Flood-Aff. Schools #',
    semantics: 'cool', format: 'integer', group: 'schools',
    description: 'Schools located inside flood-affected zones in this district.' },
  { key: 'school_per_1k_sqkm', label: 'Flood-Affected Schools per 1000 km²', short: 'Flood-Aff. Schools /1k km²',
    unit: '/1000km²', semantics: 'cool', format: 'float', group: 'schools',
    description: 'Geographic density of flood-affected schools.' },
  { key: 'school_per_100k_affected_children', label: 'Flood-Affected Schools per 100k Affected Children', short: 'Flood-Aff. Schools /100k child',
    unit: '/100k', semantics: 'cool', format: 'float', group: 'schools',
    description: 'Per-capita availability of flood-affected schools for the flood-affected children.' },

  // Service-strain metrics — higher means each facility/school is serving more people.
  { key: 'affected_per_health_facility', label: 'Flood-Affected People per Health Facility', short: 'People / Health',
    semantics: 'hot', format: 'integer', group: 'health',
    description: 'How many flood-affected people share each flood-affected health facility — service-strain indicator.' },
  { key: 'affected_children_per_school', label: 'Flood-Affected Children per School', short: 'Children / School',
    semantics: 'hot', format: 'integer', group: 'schools',
    description: 'How many flood-affected children share each flood-affected school — service-strain indicator.' },

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
