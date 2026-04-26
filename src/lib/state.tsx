'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AdminLevel, FilterState, MetricKey, PointLayer, PresetKey } from './types';

const DEFAULT_STATE: FilterState = {
  countryCode: 'pak',
  level: 'admin2',
  metric: 'affected_pop_total',
  selectedRegionId: null,
  provinceFilter: new Set<string>(),
  amenityFilter: new Set<string>(),
  metricMin: null,
  metricMax: null,
  pointLayers: new Set<PointLayer>(),
  search: '',
  preset: null,
  hideZeroAffected: false,
};

interface AppCtx extends FilterState {
  // Loading flag — true while the active country's stats / boundary is being
  // fetched. Used by Sidebar / StatsPanel / overlay to show skeletons.
  loading: boolean;
  setLoading: (v: boolean) => void;

  setCountry: (code: string) => void;
  setLevel: (l: AdminLevel) => void;
  setMetric: (m: MetricKey) => void;
  selectRegion: (id: string | null) => void;
  toggleProvince: (id: string) => void;
  clearProvinces: () => void;
  toggleAmenity: (a: string) => void;
  clearAmenities: () => void;
  setMetricRange: (min: number | null, max: number | null) => void;
  togglePointLayer: (kind: PointLayer) => void;
  setSearch: (s: string) => void;
  setPreset: (p: PresetKey | null) => void;
  toggleHideZeroAffected: () => void;
  resetFilters: () => void;
}

const AppContext = createContext<AppCtx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<FilterState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);

  const setCountry = useCallback((code: string) => setS(p => ({
    ...p, countryCode: code,
    selectedRegionId: null,
    provinceFilter: new Set(),
    amenityFilter: new Set(),
    metricMin: null, metricMax: null,
    preset: null,
  })), []);

  const setLevel = useCallback((level: AdminLevel) => setS(p => ({
    ...p, level, selectedRegionId: null,
  })), []);

  const setMetric = useCallback((metric: MetricKey) => setS(p => ({
    ...p, metric, metricMin: null, metricMax: null, preset: null,
  })), []);

  const selectRegion = useCallback((id: string | null) => setS(p => ({
    ...p, selectedRegionId: id,
  })), []);

  const toggleProvince = useCallback((id: string) => setS(p => {
    const n = new Set(p.provinceFilter);
    if (n.has(id)) n.delete(id); else n.add(id);
    return { ...p, provinceFilter: n };
  }), []);
  const clearProvinces = useCallback(() => setS(p => ({ ...p, provinceFilter: new Set() })), []);

  const toggleAmenity = useCallback((a: string) => setS(p => {
    const n = new Set(p.amenityFilter);
    if (n.has(a)) n.delete(a); else n.add(a);
    return { ...p, amenityFilter: n };
  }), []);
  const clearAmenities = useCallback(() => setS(p => ({ ...p, amenityFilter: new Set() })), []);

  const setMetricRange = useCallback((metricMin: number | null, metricMax: number | null) =>
    setS(p => ({ ...p, metricMin, metricMax, preset: null })), []);

  const togglePointLayer = useCallback((kind: PointLayer) => setS(p => {
    const n = new Set(p.pointLayers);
    if (n.has(kind)) n.delete(kind); else n.add(kind);
    return { ...p, pointLayers: n };
  }), []);

  const setSearch = useCallback((search: string) => setS(p => ({ ...p, search })), []);

  const setPreset = useCallback((preset: PresetKey | null) => setS(p => ({ ...p, preset })), []);

  const toggleHideZeroAffected = useCallback(() => setS(p => ({
    ...p, hideZeroAffected: !p.hideZeroAffected,
  })), []);

  const resetFilters = useCallback(() => setS(p => ({
    ...DEFAULT_STATE, countryCode: p.countryCode, level: p.level,
  })), []);

  const value = useMemo<AppCtx>(() => ({
    ...s, loading, setLoading,
    setCountry, setLevel, setMetric, selectRegion,
    toggleProvince, clearProvinces,
    toggleAmenity, clearAmenities,
    setMetricRange, togglePointLayer, setSearch,
    setPreset, toggleHideZeroAffected, resetFilters,
  }), [s, loading, setCountry, setLevel, setMetric, selectRegion,
       toggleProvince, clearProvinces, toggleAmenity, clearAmenities,
       setMetricRange, togglePointLayer, setSearch,
       setPreset, toggleHideZeroAffected, resetFilters]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
