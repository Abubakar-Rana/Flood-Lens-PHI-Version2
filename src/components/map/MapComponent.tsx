'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AdminLevel, RiskData, RiskType, SelectedRegion } from '@/lib/types';

interface MapComponentProps {
  riskType: RiskType;
  adminLevel: AdminLevel;
  selectedRegion: SelectedRegion | null;
  onRegionSelect: (region: SelectedRegion | null) => void;
  riskData: RiskData | null;
  isDark: boolean;
}

/* Risk score → 0-4 tier index */
function scoreTier(score: number): number {
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

/* Per-theme choropleth palettes  [lowest → highest] */
const DARK_PALETTES: Record<RiskType, string[]> = {
  flood:       ['#1e3a5f', '#1d4ed8', '#ca8a04', '#ea580c', '#b91c1c'],
  smog:        ['#2d1b69', '#5b21b6', '#ca8a04', '#ea580c', '#7c2d12'],
  respiratory: ['#134e4a', '#0d9488', '#ca8a04', '#ea580c', '#7f1d1d'],
};

const LIGHT_PALETTES: Record<RiskType, string[]> = {
  flood:       ['#bfdbfe', '#60a5fa', '#fde047', '#fb923c', '#ef4444'],
  smog:        ['#ede9fe', '#c084fc', '#fde047', '#fb923c', '#dc2626'],
  respiratory: ['#ccfbf1', '#5eead4', '#fde047', '#fb923c', '#dc2626'],
};

function getRiskScore(data: RiskData['districts'][string] | null, type: RiskType): number {
  if (!data) return 0;
  if (type === 'flood') return data.flood_risk;
  if (type === 'smog') return data.smog_risk;
  return data.respiratory_risk;
}

function getProvinceScore(data: RiskData['provinces'][string] | null, type: RiskType): number {
  if (!data) return 0;
  if (type === 'flood') return data.flood_risk;
  if (type === 'smog') return data.smog_risk;
  return data.respiratory_risk;
}

export default function MapComponent({ riskType, adminLevel, selectedRegion, onRegionSelect, riskData, isDark }: MapComponentProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const districtLayerRef = useRef<any>(null);
  const provinceLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const ATTRIBUTION = 'PHI Lab · University of Oxford · Pakistan Risk Predictor | © <a href="https://www.openstreetmap.org/">OSM</a> © <a href="https://carto.com/">CARTO</a>';

  /* ── Init map + initial tile layer in one effect ── */
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(containerRef.current!, {
        center: [30.5, 69.5],
        zoom: 5,
        zoomControl: false,
        attributionControl: true,
        minZoom: 4,
        maxZoom: 14,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);
      mapRef.current = map;

      // Add tile layer immediately after map init (avoids race condition)
      const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

      tileLayerRef.current = L.tileLayer(url, {
        attribution: ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 14,
      });
      tileLayerRef.current.addTo(map);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Swap tile layer on theme change (after initial load) ── */
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;

      mapRef.current.removeLayer(tileLayerRef.current);

      const url = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

      tileLayerRef.current = L.tileLayer(url, {
        attribution: ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 14,
      });
      tileLayerRef.current.addTo(mapRef.current);
    })();

    return () => { cancelled = true; };
  }, [isDark]);

  /* ── Refresh boundary layers ── */
  const refreshLayers = useCallback(async () => {
    if (!mapRef.current || !riskData) return;
    const L = (await import('leaflet')).default;
    const map = mapRef.current;
    const palette = isDark ? DARK_PALETTES[riskType] : LIGHT_PALETTES[riskType];

    /* Remove old layers */
    if (districtLayerRef.current) { map.removeLayer(districtLayerRef.current); districtLayerRef.current = null; }
    if (provinceLayerRef.current) { map.removeLayer(provinceLayerRef.current); provinceLayerRef.current = null; }

    if (adminLevel === 'district') {
      const resp = await fetch('/pakistan_districts.geojson');
      const geojson = await resp.json();

      districtLayerRef.current = L.geoJSON(geojson, {
        style: (feature: any) => {
          const name: string = feature.properties.DISTRICT;
          const d = riskData.districts[name] ?? null;
          const score = getRiskScore(d, riskType);
          const tier = scoreTier(score);
          const isSelected = selectedRegion?.level === 'district' && selectedRegion.name === name;
          const isProvSel  = selectedRegion?.level === 'province' && d?.province === selectedRegion.name;

          return {
            fillColor: palette[tier],
            fillOpacity: isSelected ? 0.9 : isProvSel ? 0.8 : 0.65,
            color: isSelected ? '#f59e0b' : isProvSel ? '#fbbf24' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
            weight: isSelected ? 2.5 : isProvSel ? 1.5 : 0.5,
          };
        },
        onEachFeature: (feature: any, lyr: any) => {
          const name: string = feature.properties.DISTRICT;
          const province: string = feature.properties.PROVINCE;
          const d = riskData.districts[name];
          const score = d ? getRiskScore(d, riskType) : '–';

          lyr.on({
            mouseover(e: any) {
              e.target.setStyle({ weight: 2.5, color: '#f59e0b', fillOpacity: 0.9 });
              e.target.bringToFront();

              const riskLabel = typeof score === 'number'
                ? score >= 80 ? 'Highest' : score >= 60 ? 'High' : score >= 40 ? 'Medium' : score >= 20 ? 'Low' : 'Lowest'
                : '–';
              const riskColor = typeof score === 'number'
                ? score >= 80 ? '#b91c1c' : score >= 60 ? '#ea580c' : score >= 40 ? '#ca8a04' : score >= 20 ? '#0891b2' : '#1d4ed8'
                : '#94a3b8';

              lyr.bindTooltip(`
                <div style="min-width:160px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:2px">${name}</div>
                  <div style="color:#94a3b8;font-size:10px;margin-bottom:8px">${province}</div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:#94a3b8;font-size:10px">Risk Score</span>
                    <span style="font-weight:800;font-size:14px;font-family:monospace">${score}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
                    <span style="color:#94a3b8;font-size:10px">Risk Level</span>
                    <span style="font-weight:700;font-size:11px;color:${riskColor}">${riskLabel}</span>
                  </div>
                  ${d ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px"><span style="color:#94a3b8;font-size:10px">Population</span><span style="font-size:10px">${(d.population / 1e6).toFixed(1)}M</span></div>` : ''}
                  <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#64748b">Click to view details →</div>
                </div>
              `, { direction: 'top', offset: [0, -4] }).openTooltip();
            },
            mouseout(e: any) {
              districtLayerRef.current?.resetStyle(e.target);
              e.target.closeTooltip();
            },
            click() {
              onRegionSelect({ level: 'district', name, province });
            },
          });
        },
      }).addTo(map);

    } else {
      const resp = await fetch('/pakistan_provinces.geojson');
      const geojson = await resp.json();

      provinceLayerRef.current = L.geoJSON(geojson, {
        style: (feature: any) => {
          const name: string = feature.properties.PROVINCE;
          const p = riskData.provinces[name] ?? null;
          const score = getProvinceScore(p, riskType);
          const tier = scoreTier(score);
          const isSelected = selectedRegion?.level === 'province' && selectedRegion.name === name;

          return {
            fillColor: palette[tier],
            fillOpacity: isSelected ? 0.9 : 0.65,
            color: isSelected ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
            weight: isSelected ? 2.5 : 1,
          };
        },
        onEachFeature: (feature: any, lyr: any) => {
          const name: string = feature.properties.PROVINCE;
          const p = riskData.provinces[name];
          const score = p ? getProvinceScore(p, riskType) : '–';

          lyr.on({
            mouseover(e: any) {
              e.target.setStyle({ weight: 2.5, color: '#f59e0b', fillOpacity: 0.9 });
              e.target.bringToFront();
              lyr.bindTooltip(`
                <div style="min-width:155px">
                  <div style="font-weight:700;font-size:13px;margin-bottom:6px">${name}</div>
                  <div style="display:flex;justify-content:space-between">
                    <span style="color:#94a3b8;font-size:10px">Risk Score</span>
                    <span style="font-weight:800;font-size:14px;font-family:monospace">${score}</span>
                  </div>
                  ${p ? `<div style="display:flex;justify-content:space-between;margin-top:3px"><span style="color:#94a3b8;font-size:10px">Districts</span><span style="font-size:10px">${p.districts_count}</span></div>` : ''}
                  <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#64748b">Click to view details →</div>
                </div>
              `, { direction: 'top', offset: [0, -4] }).openTooltip();
            },
            mouseout(e: any) {
              provinceLayerRef.current?.resetStyle(e.target);
              e.target.closeTooltip();
            },
            click() { onRegionSelect({ level: 'province', name }); },
          });
        },
      }).addTo(map);
    }
  }, [riskType, adminLevel, selectedRegion, riskData, isDark, onRegionSelect]);

  useEffect(() => { refreshLayers(); }, [refreshLayers]);

  return <div ref={containerRef} className="w-full h-full" />;
}
