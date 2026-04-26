'use client';

import { useEffect, useRef, useState } from 'react';
import type { Feature } from 'geojson';
import { useApp } from '@/lib/state';
import { loadBoundary, loadCountries, loadPoints, loadStats } from '@/lib/data';
import { METRIC_BY_KEY, type AdminLevel, type CountryInfo, type StatsTable } from '@/lib/types';
import { bucketIndex, formatMetric, getRamp, quantileBreaks } from '@/lib/utils';

interface MapComponentProps {
  isDark: boolean;
  onStatsLoaded?: (stats: StatsTable, country: CountryInfo) => void;
}

const LEVEL_TO_NUM: Record<AdminLevel, 0 | 1 | 2> = { admin0: 0, admin1: 1, admin2: 2 };

export default function MapComponent({ isDark, onStatsLoaded }: MapComponentProps) {
  const app = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const boundaryRef = useRef<any>(null);
  const pointLayersRef = useRef<Record<string, any>>({});
  const [stats, setStats] = useState<StatsTable | null>(null);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  // We attach the latest filter view so layer event handlers (created once)
  // always read fresh state without rebinding.
  const stateSnap = useRef(app);
  stateSnap.current = app;
  const statsSnap = useRef<StatsTable | null>(null);
  statsSnap.current = stats;

  const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/">OSM</a> © <a href="https://carto.com/">CARTO</a>';

  // ── Init Leaflet map ───────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(containerRef.current!, {
        center: [25, 80],
        zoom: 4,
        zoomControl: false,
        minZoom: 3,
        maxZoom: 14,
        worldCopyJump: false,
      });
      L.control.zoom({ position: 'topright' }).addTo(map);
      mapRef.current = map;

      const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      tileRef.current = L.tileLayer(url, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 14 });
      tileRef.current.addTo(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap basemap on theme change ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      mapRef.current.removeLayer(tileRef.current);
      const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      tileRef.current = L.tileLayer(url, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 14 });
      tileRef.current.addTo(mapRef.current);
    })();
  }, [isDark]);

  // ── Load country meta + stats whenever country changes ─────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const idx = await loadCountries();
      const c = idx.countries.find(x => x.code === app.countryCode);
      if (!alive || !c) return;
      const s = await loadStats(app.countryCode);
      if (!alive) return;
      setCountry(c);
      setStats(s);
      onStatsLoaded?.(s, c);
      // Fly to country bbox
      if (mapRef.current && c.bbox) {
        const L = (await import('leaflet')).default;
        const [w, s2, e, n] = c.bbox;
        mapRef.current.fitBounds(L.latLngBounds([s2, w], [n, e]), { padding: [20, 20] });
      }
    })();
    return () => { alive = false; };
  }, [app.countryCode, onStatsLoaded]);

  // ── Render boundary choropleth ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !stats || !country) return;
    const lvl = LEVEL_TO_NUM[app.level];
    if (!country.levels.includes(lvl)) return;
    let alive = true;

    (async () => {
      const L = (await import('leaflet')).default;
      const fc = await loadBoundary(country.code, lvl);
      if (!alive || !mapRef.current) return;

      // Compute breaks over visible-by-province subset (uses CURRENT state).
      const m = METRIC_BY_KEY[app.metric];
      const provinceFilter = app.provinceFilter;
      const filterIds = (() => {
        if (lvl !== 2 || provinceFilter.size === 0) return undefined;
        const allowed = new Set<string>();
        for (const [id, d] of Object.entries(stats)) {
          if (provinceFilter.has(d.parent_id ?? '')) allowed.add(id);
        }
        return allowed;
      })();

      const allValues: number[] = [];
      for (const [id, d] of Object.entries(stats)) {
        if (filterIds && !filterIds.has(id)) continue;
        const v = (d as Record<string, unknown>)[app.metric];
        if (typeof v === 'number') allValues.push(v);
      }
      const breaks = quantileBreaks(allValues, 5);
      const ramp = getRamp(m.semantics, isDark);

      // Tear down old boundary layer
      if (boundaryRef.current) {
        mapRef.current.removeLayer(boundaryRef.current);
        boundaryRef.current = null;
      }

      const styleFor = (feat: Feature) => {
        const id = String(feat.id ?? feat.properties?.id ?? '');
        const d = stats[id];
        const v = d ? ((d as Record<string, unknown>)[app.metric] as number) : NaN;
        const inFilter = !filterIds || filterIds.has(id);
        const inRange = (
          (app.metricMin === null || v >= app.metricMin) &&
          (app.metricMax === null || v <= app.metricMax)
        );
        const passes = inFilter && inRange && d !== undefined;
        const isSel = app.selectedDistrictId === id;
        return {
          fillColor: passes ? ramp[bucketIndex(v, breaks)] : (isDark ? '#1a1a1a' : '#e5e7eb'),
          fillOpacity: passes ? (isSel ? 0.95 : 0.78) : 0.1,
          color: isSel ? '#facc15' : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'),
          weight: isSel ? 2.8 : (lvl === 1 ? 1.2 : 0.5),
        };
      };

      const layer = L.geoJSON(fc, {
        style: styleFor as any,
        onEachFeature: (feat, lyr) => {
          const id = String(feat.id ?? feat.properties?.id ?? '');
          (lyr as any).on({
            mouseover(e: any) {
              e.target.setStyle({ weight: 2.5, color: '#facc15' });
              e.target.bringToFront();
              const s = statsSnap.current?.[id];
              const md = METRIC_BY_KEY[stateSnap.current.metric];
              const v = s ? ((s as Record<string, unknown>)[stateSnap.current.metric] as number) : undefined;
              const subtitle = s?.parent_name ?? feat.properties?.parent_name ?? '';
              const html = `
                <div style="min-width:180px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:2px">${s?.name ?? feat.properties?.name ?? id}</div>
                  ${subtitle ? `<div style="color:#94a3b8;font-size:10px;margin-bottom:8px">${subtitle}</div>` : ''}
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:#94a3b8;font-size:10px">${md.short}</span>
                    <span style="font-weight:800;font-size:13px;font-family:monospace">${formatMetric(v, md)}${md.unit ? ` <span style="color:#64748b;font-size:9px">${md.unit}</span>` : ''}</span>
                  </div>
                  ${s ? `
                  <div style="display:flex;justify-content:space-between;margin-top:3px">
                    <span style="color:#94a3b8;font-size:10px">Affected pop.</span>
                    <span style="font-size:10px">${formatMetric(s.affected_pop_total, METRIC_BY_KEY.affected_pop_total)}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;margin-top:2px">
                    <span style="color:#94a3b8;font-size:10px">Health / Schools</span>
                    <span style="font-size:10px">${s.health_count} / ${s.school_count}</span>
                  </div>` : ''}
                  <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#64748b">Click for details →</div>
                </div>`;
              (lyr as any).bindTooltip(html, { direction: 'top', offset: [0, -4], sticky: true }).openTooltip();
            },
            mouseout(e: any) {
              boundaryRef.current?.resetStyle(e.target);
              e.target.closeTooltip();
            },
            click() {
              if (lvl === 2) {
                stateSnap.current.selectDistrict(id);
              } else if (lvl === 1) {
                // clicking a province at admin1 toggles the filter
                stateSnap.current.toggleProvince(id);
              }
            },
          });
        },
      });
      layer.addTo(mapRef.current);
      boundaryRef.current = layer;
    })();
    return () => { alive = false; };
  }, [stats, country, app.level, app.metric, app.provinceFilter, app.metricMin, app.metricMax, app.selectedDistrictId, isDark]);

  // ── Render point overlays (health / schools) ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !country) return;
    let alive = true;

    (async () => {
      const L = (await import('leaflet')).default;
      const desired = new Set(app.pointLayers);

      // Remove layers no longer wanted
      for (const kind of Object.keys(pointLayersRef.current)) {
        if (!desired.has(kind as any)) {
          mapRef.current.removeLayer(pointLayersRef.current[kind]);
          delete pointLayersRef.current[kind];
        }
      }

      for (const kind of desired) {
        if (pointLayersRef.current[kind]) continue;
        const fc = await loadPoints(country.code, kind);
        if (!alive) return;

        const isHealth = kind === 'health';
        const baseColor = isHealth ? '#ef4444' : '#3b82f6';

        const group = L.layerGroup();
        for (const f of fc.features) {
          if (!f.geometry || f.geometry.type !== 'Point') continue;
          const props = (f.properties ?? {}) as Record<string, unknown>;
          // Apply amenity filter (health only)
          if (isHealth && stateSnap.current.amenityFilter.size > 0) {
            const a = String(props.amenity ?? 'unknown');
            if (!stateSnap.current.amenityFilter.has(a)) continue;
          }
          const [lon, lat] = (f.geometry as any).coordinates;
          const m = L.circleMarker([lat, lon], {
            radius: 3.5,
            color: baseColor,
            weight: 1,
            fillColor: baseColor,
            fillOpacity: 0.6,
          });
          const name = (props.name as string) || (props.amenity as string) || kind;
          const amenity = (props.amenity as string) || '';
          m.bindTooltip(`<b>${name}</b>${amenity ? `<br><span style="color:#94a3b8;font-size:10px">${amenity}</span>` : ''}`,
            { direction: 'top', offset: [0, -2] });
          group.addLayer(m);
        }
        group.addTo(mapRef.current);
        pointLayersRef.current[kind] = group;
      }
    })();
    return () => { alive = false; };
  }, [country, app.pointLayers, app.amenityFilter]);

  // ── Fly to selected district ───────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !stats || !app.selectedDistrictId) return;
    const d = stats[app.selectedDistrictId];
    if (!d || d.center_lat == null || d.center_lon == null) return;
    mapRef.current.flyTo([d.center_lat, d.center_lon], Math.max(7, mapRef.current.getZoom()), { duration: 0.8 });
  }, [app.selectedDistrictId, stats]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
