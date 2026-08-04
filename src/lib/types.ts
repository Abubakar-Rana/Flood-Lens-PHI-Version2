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

  // Event years only (2026+). Measured straight off the flood-extent raster,
  // so unlike the apportioned population fields these are observations.
  flood_extent_km2?: number;
  flood_extent_pct?: number;

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
  | 'flood_extent_km2'
  | 'flood_extent_pct'
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

  { key: 'flood_extent_km2', label: 'Land Under Water', short: 'Land flooded', unit: 'km²',
    semantics: 'neutral', format: 'float', group: 'geography',
    description: 'Land the satellites saw under water during the event.' },
  { key: 'flood_extent_pct', label: 'Share of District Flooded', short: 'District flooded', unit: '%',
    semantics: 'neutral', format: 'percent', group: 'geography',
    description: 'How much of the district went under water.' },

  { key: 'area_sqkm', label: 'Area', short: 'Area', unit: 'km²',
    semantics: 'neutral', format: 'float', group: 'geography',
    description: 'District area in square kilometres.' },
];

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> =
  METRICS.reduce((a, m) => { a[m.key] = m; return a; }, {} as Record<MetricKey, MetricDef>);

// ─── Years ───────────────────────────────────────────────────────────────
// Mirrors public/web-data/years.json, written by scripts/etl/event2026.py.
//
// Two kinds of year exist and they are NOT comparable on one axis:
//   'exposure' — everyone living in a mapped flood-prone zone (2025: 33.9M
//                for Pakistan). A standing condition, not an occurrence.
//   'event'    — who a specific observed flood actually reached (2026: 222k).
// Anything that plots or narrates them must keep the two tracks apart.

export type YearKind = 'exposure' | 'event';

export interface YearDef {
  id: string;               // '2025' | '2026'
  label: string;            // '2026 July Flood'
  short: string;            // '2026'
  kind: YearKind;
  headline: string;         // plain-language "what this number is"
  blurb: string;
  statsFile: string;        // resolved against /web-data/<code>/
  eventFile?: string;
  window: { start: string; end: string } | null;
}

export interface YearRegistry {
  years: YearDef[];
  defaultYear: string;
  projectionRange: [number, number];
}

// ─── Observed event (event-<id>.json) ────────────────────────────────────

export interface EventFacts {
  event_id: string;
  country_code: string;
  country_name: string;
  window: { start: string; end: string };
  /** Country-level figures exactly as printed in the published appendix. */
  published: Record<string, number | null>;
  /** Recomputed here from the flood rasters — cross-checks `published`. */
  measured: {
    flood_extent_km2: number;
    districts_flooded: number;
    districts_total: number;
    health_near_flood: number;
    schools_near_flood: number;
    proximity_radius_km: number;
  };
  overlay: {
    url: string;
    bounds: [[number, number], [number, number]];  // [[s,w],[n,e]]
    width: number;
    height: number;
    downsample_factor: number;
  };
  totals: CountryTotals;
  pdma_points?: PdmaPoint[];
}

export interface PdmaPoint {
  id: string;
  lat: number;
  lon: number;
  note: string;
  union_extent?: string;
  fwdet_depth_m?: number | null;
  rp100_depth_m?: number | null;
  smod_class?: string;
  ndwi_change?: number | null;
}

// ─── Timeline (timeline.json) ────────────────────────────────────────────

export interface TimelinePoint {
  year: number;
  value: number;
  kind: 'observed' | 'projected';
  /** Present on projected points only. */
  low?: number;
  high?: number;
}

export interface TimelineMetric {
  label: string;
  points: TimelinePoint[];
}

export interface Timeline {
  /** Keyed by MetricKey — only fields measured in both years appear. */
  metrics: Record<string, TimelineMetric>;
  /** Expected people affected per year, integrated over the severity curve. */
  expected_annual: number;
  scenario: {
    label: string;
    value: number;
    u18: number | null;
    area_km2: number | null;
    source: string;
  };
  assumptions: {
    exposure_growth_pct_per_year: number;
    severity_exponent: number;
    method: string;
    note: string;
  };
}

// ─── Lenses — the plain-language entry point ─────────────────────────────
// A lens is one question a non-expert would actually ask. Picking one sets
// the choropleth metric and any point overlay in a single click, so the
// default flow never touches the metric catalog.

export type LensKey = 'people' | 'children' | 'water' | 'hospitals' | 'schools';

export interface LensDef {
  key: LensKey;
  /** Tile caption — what the big number counts. */
  label: string;
  /** The question this lens answers, in plain words. */
  question: string;
  metric: MetricKey;
  /** Field read for the headline tile; usually the same as `metric`. */
  totalKey: keyof CountryTotals | 'flood_extent_km2';
  /** Per-mode hue. Both sets are validated for colour-vision separation and
   *  for lightness against their own surface — see scripts/validate_palette.js
   *  in the dataviz skill. Re-run it if you change one. A lens keeps its hue
   *  everywhere it appears (tile, legend, chart line, map ramp accent) so the
   *  colour identifies the measure, never its rank. */
  color: string;        // light mode
  colorDark: string;    // dark mode
  points?: PointLayer;
  /** Omitted = available in every year. */
  kinds?: YearKind[];
}

export const LENSES: LensDef[] = [
  { key: 'people', label: 'People', question: 'How many people are affected?',
    metric: 'affected_pop_total', totalKey: 'affected_pop_total',
    color: '#e11d48', colorDark: '#cc2443' },
  { key: 'children', label: 'Children', question: 'How many are children?',
    metric: 'affected_child_pop_total', totalKey: 'affected_child_pop_total',
    color: '#ea9010', colorDark: '#c8830b' },
  { key: 'water', label: 'Land flooded', question: 'How much land went under water?',
    metric: 'flood_extent_km2', totalKey: 'flood_extent_km2',
    color: '#0284c7', colorDark: '#38bdf8', kinds: ['event'] },
  { key: 'hospitals', label: 'Hospitals', question: 'Which hospitals are hit?',
    metric: 'health_count', totalKey: 'health_count',
    color: '#0d9488', colorDark: '#009892', points: 'health' },
  { key: 'schools', label: 'Schools', question: 'Which schools are hit?',
    metric: 'school_count', totalKey: 'school_count',
    color: '#4f46e5', colorDark: '#504fc6', points: 'schools' },
];

export function lensColor(l: LensDef, isDark: boolean): string {
  return isDark ? l.colorDark : l.color;
}

/** The four measures recorded in both 2025 and 2026, in chart order. */
export const TREND_LENSES: LensKey[] = ['people', 'children', 'hospitals', 'schools'];

// ─── Cross-country timelines (timelines.json) ────────────────────────────
// Every country's series for every comparable metric, in one small file.

export interface CountryTimeline {
  code: string;
  name: string;
  series: Record<string, TimelinePoint[]>;
}

/** Month-by-month series within one year. `values` has 12 slots; null means
 *  no meaningful flooding recorded that month, which is different from zero. */
export interface MonthlyCountry {
  code: string;
  name: string;
  values: (number | null)[];
  /** Relative uncertainty shaded around the curve, e.g. 0.20 = ±20%. */
  spread: number;
}

export interface MonthlyYear {
  months: string[];
  note: string;
  /** True when the year was surveyed through a whole season, so drawing a
   *  smooth curve between months is meaningful. False for a single observed
   *  event, where interpolation would invent months nobody measured. */
  continuous: boolean;
  countries: MonthlyCountry[];
}

export interface AllTimelines {
  metrics: string[];
  labels: Record<string, string>;
  years: number[];
  countries: CountryTimeline[];
  monthly: Record<string, MonthlyYear>;
}

/** Fixed hue per country, assigned in this order and never cycled or
 *  reassigned by rank — a country keeps its colour when the chart is filtered
 *  or re-sorted. Both sets pass the six colour checks against their own
 *  surface; re-run scripts/validate_palette.js if you change one. */
export const COUNTRY_COLORS: Record<string, { light: string; dark: string }> = {
  pak: { light: '#cc2443', dark: '#d3384e' },
  ind: { light: '#d78c00', dark: '#c8830b' },
  bgd: { light: '#00977c', dark: '#009d82' },
  npl: { light: '#3b51bc', dark: '#455dc9' },
  btn: { light: '#d879d0', dark: '#c66ebf' },
  lka: { light: '#006893', dark: '#006d93' },
};

export function countryColor(code: string, isDark: boolean): string {
  const c = COUNTRY_COLORS[code];
  if (!c) return isDark ? '#8a8a8a' : '#6b6b6b';
  return isDark ? c.dark : c.light;
}

export const LENS_BY_KEY: Record<LensKey, LensDef> =
  LENSES.reduce((a, l) => { a[l.key] = l; return a; }, {} as Record<LensKey, LensDef>);

export function lensesForKind(kind: YearKind): LensDef[] {
  return LENSES.filter(l => !l.kinds || l.kinds.includes(kind));
}

// ─── App state shape ─────────────────────────────────────────────────────

export type PointLayer = 'health' | 'schools';

export interface FilterState {
  countryCode: string;
  /** Which dataset year is loaded — an id from years.json. */
  year: string;
  /** Year the map is painted for. Equals `year` for observed data; beyond the
   *  last observed year it indexes into the projection, and the map shows
   *  scaled values. This is what ties the timeline to the map. */
  scrubYear: number;
  /** The plain-language question driving the view. Null only if the user
   *  picked a raw metric from the advanced panel. */
  lens: LensKey | null;
  /** Advanced controls revealed. Off by default — the layman flow never
   *  needs them, but nothing is removed for expert users. */
  advanced: boolean;
  /** Satellite flood-extent raster drawn over the basemap (event years). */
  showExtent: boolean;
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
