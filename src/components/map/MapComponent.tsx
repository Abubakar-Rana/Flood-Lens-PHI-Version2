'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Feature } from 'geojson';
// Type-only: erased at compile time, so leaflet still loads lazily below and
// never touches the server render.
import type * as LType from 'leaflet';
import { useApp } from '@/lib/state';
import { loadBoundary, loadCountries, loadEvent, loadPoints, loadStats, loadTimeline, loadYears } from '@/lib/data';
import { METRIC_BY_KEY, type AdminLevel, type CountryInfo, type PointLayer, type StatsTable, type Timeline, type YearDef } from '@/lib/types';
import { bucketIndex, formatMetric, getRamp, projectStats, projectionFactor, quantileBreaks, statsForLevel } from '@/lib/utils';

interface MapComponentProps {
  isDark: boolean;
  onStatsLoaded?: (stats: StatsTable, country: CountryInfo) => void;
}

const LEVEL_TO_NUM: Record<AdminLevel, 0 | 1 | 2> = { admin0: 0, admin1: 1, admin2: 2 };

export default function MapComponent({ isDark, onStatsLoaded }: MapComponentProps) {
  const app = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const tileRef = useRef<LType.TileLayer | null>(null);
  const boundaryRef = useRef<LType.GeoJSON | null>(null);
  const extentRef = useRef<LType.ImageOverlay | null>(null);
  const pointLayersRef = useRef<Record<string, LType.LayerGroup>>({});
  const [rawStats, setRawStats] = useState<StatsTable | null>(null);  // district-keyed
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [years, setYears] = useState<YearDef[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [extentInfo, setExtentInfo] = useState<{ url: string; bounds: [[number, number], [number, number]] } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Country whose bbox the viewport is already framed to.
  const fittedRef = useRef<string | null>(null);

  const year = years.find(y => y.id === app.year) ?? null;

  // Scrubbing past the last observed year repaints the map with projected
  // values; on an observed year the factor is exactly 1 and this is a no-op.
  const stats = useMemo(() => {
    if (!rawStats) return null;
    return projectStats(rawStats, projectionFactor(timeline, app.scrubYear));
  }, [rawStats, timeline, app.scrubYear]);
  // Latest filter view for layer event handlers (created once, read fresh).
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
        center: [25, 80], zoom: 4,
        zoomControl: false, minZoom: 3, maxZoom: 14, worldCopyJump: false,
      });
      L.control.zoom({ position: 'topright' }).addTo(map);
      mapRef.current = map;
      const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      tileRef.current = L.tileLayer(url, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 14 });
      tileRef.current.addTo(map);
      // Every layer effect below bails when the map is missing. Leaflet is
      // imported lazily, so on a warm cache the data effects settle first and
      // would never run again — flag readiness as state so they re-fire.
      setMapReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap basemap on theme change ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const tile = tileRef.current;
    if (!map || !tile) return;
    (async () => {
      const L = (await import('leaflet')).default;
      map.removeLayer(tile);
      const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      tileRef.current = L.tileLayer(url, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 14 });
      tileRef.current.addTo(map);
    })();
  }, [isDark]);

  // ── Year registry (static, fetched once) ───────────────────────────
  useEffect(() => { loadYears().then(r => setYears(r.years)).catch(() => {}); }, []);

  // ── Load country meta + stats whenever country or year changes ─────
  // Only refits the viewport when the country changes; switching year keeps
  // the reader's pan and zoom, since it's the same geography either way.
  useEffect(() => {
    if (!year) return;
    let alive = true;
    app.setLoading(true);
    (async () => {
      try {
        const idx = await loadCountries();
        const c = idx.countries.find(x => x.code === app.countryCode);
        if (!alive || !c) return;
        const [s, tl] = await Promise.all([
          loadStats(app.countryCode, year),
          loadTimeline(app.countryCode).catch(() => null),
        ]);
        if (!alive) return;
        setCountry(c);
        setRawStats(s);
        setTimeline(tl);
        onStatsLoaded?.(s, c);
      } finally {
        if (alive) app.setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.countryCode, year]);

  // ── Frame the viewport on the country ──────────────────────────────
  // Once per country, never on a year change — switching year is the same
  // geography, and re-fitting would throw away the reader's pan and zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !country?.bbox) return;
    if (fittedRef.current === country.code) return;
    fittedRef.current = country.code;
    let alive = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!alive || !mapRef.current) return;
      const [w, s, e, n] = country.bbox!;
      mapRef.current.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [20, 20] });
    })();
    return () => { alive = false; };
  }, [mapReady, country]);

  // ── Satellite flood extent, as a georeferenced image overlay ───────
  // The raster is ~16k x 15k cells; a vector version would be megabytes of
  // geometry and thousands of paths. A max-pooled PNG (~33 KB for Pakistan)
  // draws in one compositing pass and stays sharp because nothing was
  // averaged away — see write_extent_png in scripts/etl/event2026.py.
  useEffect(() => {
    if (!year?.eventFile) { setExtentInfo(null); return; }
    let alive = true;
    loadEvent(app.countryCode, year)
      .then(e => { if (alive) setExtentInfo(e ? e.overlay : null); })
      .catch(() => { if (alive) setExtentInfo(null); });
    return () => { alive = false; };
  }, [app.countryCode, year]);

  useEffect(() => {
    if (!mapRef.current) return;
    let alive = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!alive || !mapRef.current) return;
      if (extentRef.current) {
        mapRef.current.removeLayer(extentRef.current);
        extentRef.current = null;
      }
      if (!extentInfo || !app.showExtent) return;
      const layer = L.imageOverlay(extentInfo.url, extentInfo.bounds, {
        opacity: 0.85, interactive: false, className: 'flood-extent-overlay',
      });
      layer.addTo(mapRef.current);
      layer.bringToFront();
      extentRef.current = layer;
    })();
    return () => { alive = false; };
  }, [extentInfo, app.showExtent, mapReady]);

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

      // Pick the right stats table for this level (district vs province aggregate).
      const activeStats = statsForLevel(stats, app.level);
      const m = METRIC_BY_KEY[app.metric];

      // Build the visible-id filter:
      //   - province filter: at admin2, keep districts whose parent is selected;
      //                      at admin1, keep selected provinces only.
      //   - hideZeroAffected: drop regions with affected_pop_total == 0.
      const provinceFilter = app.provinceFilter;
      const visibleFilter: Set<string> | undefined = (() => {
        if (provinceFilter.size === 0 && !app.hideZeroAffected) return undefined;
        const allowed = new Set<string>();
        for (const [id, d] of Object.entries(activeStats)) {
          if (provinceFilter.size > 0) {
            if (lvl === 1 && !provinceFilter.has(id)) continue;
            if (lvl === 2 && !provinceFilter.has(d.parent_id ?? '')) continue;
          }
          if (app.hideZeroAffected && (d.affected_pop_total ?? 0) <= 0) continue;
          allowed.add(id);
        }
        return allowed;
      })();

      const allValues: number[] = [];
      for (const [id, d] of Object.entries(activeStats)) {
        if (visibleFilter && !visibleFilter.has(id)) continue;
        const v = (d as unknown as Record<string, unknown>)[app.metric];
        if (typeof v === 'number') allValues.push(v);
      }
      const breaks = quantileBreaks(allValues, 5);
      const ramp = getRamp(m.semantics, isDark);

      // Tear down old boundary layer
      if (boundaryRef.current) {
        mapRef.current.removeLayer(boundaryRef.current);
        boundaryRef.current = null;
      }

      const styleFor = (feat?: Feature) => {
        const id = String(feat?.id ?? feat?.properties?.id ?? '');
        const d = activeStats[id];
        const v = d ? ((d as unknown as Record<string, unknown>)[app.metric] as number) : NaN;
        const inFilter = !visibleFilter || visibleFilter.has(id);
        const inRange = (
          (app.metricMin === null || v >= app.metricMin) &&
          (app.metricMax === null || v <= app.metricMax)
        );
        const passes = inFilter && inRange && d !== undefined;
        const isSel = app.selectedRegionId === id;
        return {
          fillColor: passes ? ramp[bucketIndex(v, breaks)] : (isDark ? '#1a1a1a' : '#e5e7eb'),
          fillOpacity: passes ? (isSel ? 0.95 : 0.78) : 0.1,
          color: isSel ? '#facc15' : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'),
          weight: isSel ? 2.8 : (lvl === 1 ? 1.2 : 0.5),
        };
      };

      const layer = L.geoJSON(fc, {
        style: styleFor,
        onEachFeature: (feat, lyr) => {
          const id = String(feat.id ?? feat.properties?.id ?? '');
          const path = lyr as LType.Path;
          path.on({
            mouseover(e: LType.LeafletEvent) {
              const t = e.target as LType.Path;
              t.setStyle({ weight: 2.5, color: '#facc15' });
              t.bringToFront();
              const curStats = statsForLevel(statsSnap.current ?? {}, stateSnap.current.level);
              const s = curStats[id];
              const md = METRIC_BY_KEY[stateSnap.current.metric];
              const v = s ? ((s as unknown as Record<string, unknown>)[stateSnap.current.metric] as number) : undefined;
              const subtitle = s?.parent_name ?? feat.properties?.parent_name ?? '';
              const row = (label: string, val: string) =>
                `<div style="display:flex;justify-content:space-between;gap:14px;margin-top:3px">
                   <span style="color:#94a3b8;font-size:10px">${label}</span>
                   <span style="font-size:11px;font-weight:600">${val}</span>
                 </div>`;
              const extent = s?.flood_extent_km2;
              const html = `
                <div style="min-width:190px">
                  <div style="font-weight:800;font-size:13px;margin-bottom:1px">${s?.name ?? feat.properties?.name ?? id}</div>
                  ${subtitle ? `<div style="color:#94a3b8;font-size:10px;margin-bottom:7px">${subtitle}</div>` : ''}
                  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:14px">
                    <span style="color:#94a3b8;font-size:10px">${md.short}</span>
                    <span style="font-weight:800;font-size:17px">${formatMetric(v, md)}${md.unit ? ` <span style="color:#64748b;font-size:9px">${md.unit}</span>` : ''}</span>
                  </div>
                  ${s ? row('People affected', formatMetric(s.affected_pop_total, METRIC_BY_KEY.affected_pop_total)) : ''}
                  ${s ? row('Children', formatMetric(s.affected_child_pop_total, METRIC_BY_KEY.affected_child_pop_total)) : ''}
                  ${typeof extent === 'number' ? row('Land under water', `${formatMetric(extent, METRIC_BY_KEY.flood_extent_km2)} km²`) : ''}
                  ${s ? row('Hospitals / schools', `${s.health_count} / ${s.school_count}`) : ''}
                  <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#64748b">Click to focus this area →</div>
                </div>`;
              path.bindTooltip(html, { direction: 'top', offset: [0, -4], sticky: true }).openTooltip();
            },
            mouseout(e: LType.LeafletEvent) {
              const t = e.target as LType.Path;
              boundaryRef.current?.resetStyle(t);
              t.closeTooltip();
            },
            click() {
              // Click selects whichever entity the current level shows
              // (district at admin2, province at admin1, country at admin0).
              if (lvl === 0) return;
              stateSnap.current.selectRegion(id);
            },
          });
        },
      });
      layer.addTo(mapRef.current);
      boundaryRef.current = layer;
      // Boundaries and the extent image share the overlay pane, so the water
      // has to be re-raised after every choropleth rebuild or it disappears.
      extentRef.current?.bringToFront();
    })();
    return () => { alive = false; };
  }, [stats, country, app.level, app.metric, app.provinceFilter, app.metricMin, app.metricMax, app.selectedRegionId, app.hideZeroAffected, isDark, mapReady]);

  // ── Render point overlays (health / schools) ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !country) return;
    let alive = true;

    (async () => {
      const L = (await import('leaflet')).default;
      const map = mapRef.current;
      if (!map) return;
      const desired = new Set(app.pointLayers);

      for (const kind of Object.keys(pointLayersRef.current)) {
        if (!desired.has(kind as PointLayer)) {
          map.removeLayer(pointLayersRef.current[kind]);
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
          if (isHealth && stateSnap.current.amenityFilter.size > 0) {
            const a = String(props.amenity ?? 'unknown');
            if (!stateSnap.current.amenityFilter.has(a)) continue;
          }
          const [lon, lat] = f.geometry.coordinates as [number, number];
          const m = L.circleMarker([lat, lon], {
            radius: 3.5, color: baseColor, weight: 1,
            fillColor: baseColor, fillOpacity: 0.6,
          });
          const name = (props.name as string) || (props.amenity as string) || kind;
          const amenity = (props.amenity as string) || '';
          const kindLabel = isHealth ? 'Health facility' : 'School';
          m.bindTooltip(
            `<b>${name}</b><br><span style="color:#94a3b8;font-size:10px">${kindLabel}${amenity ? ' · ' + amenity : ''}</span>`,
            { direction: 'top', offset: [0, -2] });
          group.addLayer(m);
        }
        group.addTo(map);
        pointLayersRef.current[kind] = group;
      }
    })();
    return () => { alive = false; };
  }, [country, app.pointLayers, app.amenityFilter, mapReady]);

  // ── Fly to selected region (district or province) ──────────────────
  useEffect(() => {
    if (!mapRef.current || !stats || !app.selectedRegionId) return;
    const activeStats = statsForLevel(stats, app.level);
    const d = activeStats[app.selectedRegionId];
    if (!d || d.center_lat == null || d.center_lon == null) return;
    const targetZoom = app.level === 'admin1' ? 6 : Math.max(7, mapRef.current.getZoom());
    mapRef.current.flyTo([d.center_lat, d.center_lon], targetZoom, { duration: 0.8 });
  }, [app.selectedRegionId, app.level, stats]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
