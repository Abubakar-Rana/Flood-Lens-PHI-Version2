'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AdminLevel, FilterState, MetricKey, PointLayer } from './types';

const DEFAULT_STATE: FilterState = {
  countryCode: 'pak',
  level: 'admin2',
  metric: 'affected_pop_total',
  selectedDistrictId: null,
  provinceFilter: new Set<string>(),
  amenityFilter: new Set<string>(),
  metricMin: null,
  metricMax: null,
  pointLayers: new Set<PointLayer>(),
  search: '',
};

interface AppCtx extends FilterState {
  setCountry: (code: string) => void;
  setLevel: (l: AdminLevel) => void;
  setMetric: (m: MetricKey) => void;
  selectDistrict: (id: string | null) => void;
  toggleProvince: (id: string) => void;
  clearProvinces: () => void;
  toggleAmenity: (a: string) => void;
  clearAmenities: () => void;
  setMetricRange: (min: number | null, max: number | null) => void;
  togglePointLayer: (kind: PointLayer) => void;
  setSearch: (s: string) => void;
  resetFilters: () => void;
}

const AppContext = createContext<AppCtx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<FilterState>(DEFAULT_STATE);

  const setCountry = useCallback((code: string) => setS(p => ({
    ...p, countryCode: code,
    selectedDistrictId: null,
    provinceFilter: new Set(),
    amenityFilter: new Set(),
    metricMin: null, metricMax: null,
  })), []);

  const setLevel = useCallback((level: AdminLevel) => setS(p => ({ ...p, level, selectedDistrictId: null })), []);
  const setMetric = useCallback((metric: MetricKey) => setS(p => ({
    ...p, metric, metricMin: null, metricMax: null,
  })), []);
  const selectDistrict = useCallback((id: string | null) => setS(p => ({ ...p, selectedDistrictId: id })), []);

  const toggleProvince = useCallback((id: string) => setS(p => {
    const n = new Set(p.provinceFilter);
    n.has(id) ? n.delete(id) : n.add(id);
    return { ...p, provinceFilter: n };
  }), []);
  const clearProvinces = useCallback(() => setS(p => ({ ...p, provinceFilter: new Set() })), []);

  const toggleAmenity = useCallback((a: string) => setS(p => {
    const n = new Set(p.amenityFilter);
    n.has(a) ? n.delete(a) : n.add(a);
    return { ...p, amenityFilter: n };
  }), []);
  const clearAmenities = useCallback(() => setS(p => ({ ...p, amenityFilter: new Set() })), []);

  const setMetricRange = useCallback((metricMin: number | null, metricMax: number | null) =>
    setS(p => ({ ...p, metricMin, metricMax })), []);

  const togglePointLayer = useCallback((kind: PointLayer) => setS(p => {
    const n = new Set(p.pointLayers);
    n.has(kind) ? n.delete(kind) : n.add(kind);
    return { ...p, pointLayers: n };
  }), []);

  const setSearch = useCallback((search: string) => setS(p => ({ ...p, search })), []);

  const resetFilters = useCallback(() => setS(p => ({
    ...DEFAULT_STATE, countryCode: p.countryCode,
  })), []);

  const value = useMemo<AppCtx>(() => ({
    ...s,
    setCountry, setLevel, setMetric, selectDistrict,
    toggleProvince, clearProvinces, toggleAmenity, clearAmenities,
    setMetricRange, togglePointLayer, setSearch, resetFilters,
  }), [s, setCountry, setLevel, setMetric, selectDistrict,
       toggleProvince, clearProvinces, toggleAmenity, clearAmenities,
       setMetricRange, togglePointLayer, setSearch, resetFilters]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
