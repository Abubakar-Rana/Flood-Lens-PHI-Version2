'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, Layers, Filter, Hospital, GraduationCap, Globe2, Map as MapIcon, Sliders, X, Zap, EyeOff, Loader2 } from 'lucide-react';
import { useApp } from '@/lib/state';
import { loadCountries, loadStats } from '@/lib/data';
import { METRICS, METRIC_BY_KEY, PRESETS, type AdminLevel, type CountriesIndex, type MetricKey, type StatsTable } from '@/lib/types';
import { distinctAmenities, distinctProvinces, formatMetric, metricValues, presetRange } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

const METRIC_GROUPS: { key: string; label: string }[] = [
  { key: 'population', label: 'Flood-Affected Population' },
  { key: 'children',   label: 'Flood-Affected Children' },
  { key: 'health',     label: 'Flood-Affected Health Facilities' },
  { key: 'schools',    label: 'Flood-Affected Schools' },
  { key: 'geography',  label: 'Geography' },
];

export default function Sidebar() {
  const { isDark } = useTheme();
  const app = useApp();
  const [countries, setCountries] = useState<CountriesIndex | null>(null);
  const [stats, setStats] = useState<StatsTable | null>(null);
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    presets: true, metric: false, province: true, threshold: false, amenity: false,
  });

  useEffect(() => { loadCountries().then(setCountries); }, []);
  useEffect(() => { loadStats(app.countryCode).then(setStats); }, [app.countryCode]);

  const provinces = useMemo(() => stats ? distinctProvinces(stats) : [], [stats]);
  const amenities = useMemo(() => stats ? distinctAmenities(stats) : [], [stats]);
  const metricRange = useMemo(() => {
    if (!stats) return { min: 0, max: 0 };
    const vs = metricValues(stats, app.metric);
    if (vs.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...vs), max: Math.max(...vs) };
  }, [stats, app.metric]);

  const country = countries?.countries.find(c => c.code === app.countryCode);
  const availableLevels = country?.levels ?? [0, 1, 2];

  const bg = isDark ? '#0d0d0d' : '#f8f8f8';
  const border = isDark ? '#2e2e2e' : '#e0e0e0';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const optionBg = isDark ? '#111' : '#fff';

  type SectionProps = {
    id: string; icon: React.ElementType; title: string;
    badge?: string | number; children: React.ReactNode;
  };
  const Section = ({ id, icon: Icon, title, badge, children }: SectionProps) => (
    <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 12 }}>
      <button
        onClick={() => setOpenSection(p => ({ ...p, [id]: !p[id] }))}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 0, color: tp, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', padding: 0 }}
      >
        <Icon size={12} style={{ color: '#c8a951' }} />
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {badge ? <span style={{ background: 'rgba(200,169,81,0.2)', color: '#c8a951', borderRadius: 10, padding: '1px 6px', fontSize: 9 }}>{badge}</span> : null}
        <ChevronDown size={11} style={{ transform: openSection[id] ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .15s', color: tm }} />
      </button>
      {openSection[id] && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );

  return (
    <aside style={{ width: 280, background: bg, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={14} style={{ color: '#c8a951' }} />
          <span style={{ color: tp, fontWeight: 700, fontSize: 13 }}>Layers & Filters</span>
          {app.loading && <Loader2 size={11} style={{ color: '#c8a951', marginLeft: 'auto', animation: 'spin 1s linear infinite' }} />}
        </div>
        <p style={{ color: tm, fontSize: 9, marginTop: 2, letterSpacing: '0.06em' }}>
          {app.loading
            ? 'Loading data…'
            : country
              ? `${country.totals.district_count.toLocaleString()} districts · ${country.totals.health_count.toLocaleString()} flood-aff. health · ${country.totals.school_count.toLocaleString()} flood-aff. schools`
              : 'Loading…'}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>

        {/* Country */}
        <label style={{ color: tm, fontSize: 9, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <Globe2 size={10} /> COUNTRY
        </label>
        <div style={{ position: 'relative' }}>
          <select
            value={app.countryCode}
            onChange={e => app.setCountry(e.target.value)}
            disabled={app.loading}
            style={{ width: '100%', padding: '7px 24px 7px 10px', borderRadius: 8, background: inputBg, border: `1px solid ${border}`, color: tp, fontSize: 12, appearance: 'none', cursor: app.loading ? 'wait' : 'pointer', outline: 'none', opacity: app.loading ? 0.6 : 1 }}
          >
            {countries?.countries.map(c => (
              <option key={c.code} value={c.code} style={{ background: optionBg }}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: tm, pointerEvents: 'none' }} />
        </div>

        {/* Admin level */}
        <label style={{ color: tm, fontSize: 9, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, marginBottom: 5 }}>
          <MapIcon size={10} /> BOUNDARY LEVEL
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { v: 'admin0' as AdminLevel, label: 'Country', n: 0 },
            { v: 'admin1' as AdminLevel, label: 'Province', n: 1 },
            { v: 'admin2' as AdminLevel, label: 'District', n: 2 },
          ]).map(opt => {
            const enabled = availableLevels.includes(opt.n);
            const active = app.level === opt.v;
            return (
              <button
                key={opt.v}
                disabled={!enabled}
                onClick={() => app.setLevel(opt.v)}
                style={{
                  flex: 1, padding: '6px 4px', fontSize: 10, borderRadius: 6,
                  background: active ? '#c8a951' : cardBg,
                  color: active ? '#1a1200' : (enabled ? ts : tm),
                  border: `1px solid ${active ? '#c8a951' : border}`,
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  opacity: enabled ? 1 : 0.4,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {!availableLevels.includes(1) && (
          <p style={{ color: tm, fontSize: 9, marginTop: 4 }}>India: no province layer in source data.</p>
        )}

        {/* Point overlays */}
        <label style={{ color: tm, fontSize: 9, letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 5, marginTop: 14, marginBottom: 5 }}>
          POINT OVERLAYS
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ k: 'health' as const, label: 'Flood-Aff. Health', icon: Hospital, color: '#ef4444' },
            { k: 'schools' as const, label: 'Flood-Aff. Schools', icon: GraduationCap, color: '#3b82f6' }].map(p => {
            const active = app.pointLayers.has(p.k);
            const Icon = p.icon;
            return (
              <button
                key={p.k}
                onClick={() => app.togglePointLayer(p.k)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '6px 4px', fontSize: 10, borderRadius: 6,
                  background: active ? `${p.color}20` : cardBg,
                  color: active ? p.color : ts,
                  border: `1px solid ${active ? p.color : border}`,
                  fontWeight: active ? 700 : 500, cursor: 'pointer',
                }}
              >
                <Icon size={11} /> {p.label}
              </button>
            );
          })}
        </div>

        {/* Quick presets */}
        <Section id="presets" icon={Zap} title="QUICK INSIGHTS"
          badge={app.preset ? PRESETS.find(p => p.key === app.preset)?.label : undefined}>
          <p style={{ color: tm, fontSize: 9, marginBottom: 6 }}>One-click views — switches metric & filter.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {PRESETS.map(p => {
              const active = app.preset === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    if (active) {
                      app.setPreset(null);
                      app.setMetricRange(null, null);
                      return;
                    }
                    app.setMetric(p.metric);
                    if (stats) {
                      const r = presetRange(stats, p);
                      if (r) app.setMetricRange(r.min, r.max);
                    }
                    app.setPreset(p.key);
                  }}
                  title={p.description}
                  style={{
                    padding: '6px 6px', borderRadius: 6, fontSize: 10, fontWeight: active ? 700 : 600,
                    textAlign: 'left',
                    background: active ? 'rgba(200,169,81,0.15)' : cardBg,
                    color: active ? '#c8a951' : ts,
                    border: `1px solid ${active ? '#c8a951' : border}`,
                    cursor: 'pointer',
                  }}>
                  {p.label}
                </button>
              );
            })}
          </div>
          {/* Hide-zero toggle */}
          <button
            onClick={app.toggleHideZeroAffected}
            style={{
              marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: app.hideZeroAffected ? 'rgba(200,169,81,0.15)' : cardBg,
              color: app.hideZeroAffected ? '#c8a951' : ts,
              border: `1px solid ${app.hideZeroAffected ? '#c8a951' : border}`,
              cursor: 'pointer',
            }}>
            <EyeOff size={11} />
            Hide districts with no flood impact
          </button>
        </Section>

        {/* Metric */}
        <Section id="metric" icon={Filter} title="CHOROPLETH METRIC" badge={METRIC_BY_KEY[app.metric].short}>
          {METRIC_GROUPS.map(g => (
            <div key={g.key} style={{ marginBottom: 8 }}>
              <div style={{ color: tm, fontSize: 9, letterSpacing: '0.05em', marginBottom: 3 }}>{g.label}</div>
              {METRICS.filter(m => m.group === g.key).map(m => {
                const active = app.metric === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => app.setMetric(m.key as MetricKey)}
                    title={m.description}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '5px 8px', borderRadius: 6, marginBottom: 2,
                      background: active ? 'rgba(200,169,81,0.14)' : 'transparent',
                      color: active ? '#c8a951' : ts,
                      border: `1px solid ${active ? 'rgba(200,169,81,0.35)' : 'transparent'}`,
                      fontSize: 11, fontWeight: active ? 600 : 400, cursor: 'pointer',
                    }}
                  >
                    {m.short}{m.unit ? <span style={{ color: tm, fontSize: 9 }}> {m.unit}</span> : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </Section>

        {/* Province filter */}
        {availableLevels.includes(1) && (
          <Section id="province" icon={MapIcon} title="PROVINCE FILTER"
            badge={app.provinceFilter.size > 0 ? `${app.provinceFilter.size}` : undefined}>
            {provinces.length === 0 && (
              <p style={{ color: tm, fontSize: 10 }}>{app.loading ? 'Loading…' : 'No provinces.'}</p>
            )}
            {provinces.length > 0 && (
              <>
                <p style={{ color: tm, fontSize: 9, marginBottom: 6 }}>
                  Select a province to focus the map. With one selected, the right panel shows that province&apos;s aggregated details.
                </p>
                {app.provinceFilter.size > 0 && (
                  <button onClick={app.clearProvinces}
                    style={{ background: 'none', border: 'none', color: '#c8a951', fontSize: 10, marginBottom: 4, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <X size={9} /> Clear all ({app.provinceFilter.size})
                  </button>
                )}
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {provinces.map(p => {
                    const sel = app.provinceFilter.has(p.id);
                    return (
                      <label key={p.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', cursor: 'pointer', borderRadius: 4, background: sel ? 'rgba(200,169,81,0.08)' : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => {
                            app.toggleProvince(p.id);
                            // Auto-select region for detail view when toggling on
                            // and no district is currently selected.
                            if (!sel) {
                              // about to be selected
                              if (!app.selectedRegionId || app.level === 'admin1') {
                                app.selectRegion(p.id);
                              }
                            } else {
                              // about to be deselected — if it was the selected region, clear it
                              if (app.selectedRegionId === p.id) app.selectRegion(null);
                            }
                          }}
                          style={{ accentColor: '#c8a951' }}
                        />
                        <span style={{ color: sel ? '#c8a951' : ts, fontSize: 11, flex: 1 }}>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </Section>
        )}

        {/* Metric threshold */}
        <Section id="threshold" icon={Sliders} title="METRIC THRESHOLD"
          badge={(app.metricMin !== null || app.metricMax !== null) ? '✓' : undefined}>
          <div style={{ color: tm, fontSize: 9, marginBottom: 4 }}>
            Range for {METRIC_BY_KEY[app.metric].short} (full {formatMetric(metricRange.min, METRIC_BY_KEY[app.metric])} – {formatMetric(metricRange.max, METRIC_BY_KEY[app.metric])})
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number" placeholder="min"
              value={app.metricMin ?? ''}
              onChange={e => app.setMetricRange(e.target.value === '' ? null : Number(e.target.value), app.metricMax)}
              style={{ flex: 1, width: 0, padding: '5px 8px', borderRadius: 6, background: inputBg, border: `1px solid ${border}`, color: tp, fontSize: 11, outline: 'none' }}
            />
            <input
              type="number" placeholder="max"
              value={app.metricMax ?? ''}
              onChange={e => app.setMetricRange(app.metricMin, e.target.value === '' ? null : Number(e.target.value))}
              style={{ flex: 1, width: 0, padding: '5px 8px', borderRadius: 6, background: inputBg, border: `1px solid ${border}`, color: tp, fontSize: 11, outline: 'none' }}
            />
          </div>
          {(app.metricMin !== null || app.metricMax !== null) && (
            <button onClick={() => app.setMetricRange(null, null)}
              style={{ background: 'none', border: 'none', color: '#c8a951', fontSize: 10, marginTop: 6, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={9} /> Clear range
            </button>
          )}
        </Section>

        {/* Amenity filter */}
        <Section id="amenity" icon={Hospital} title="FLOOD-AFF. HEALTH AMENITY"
          badge={app.amenityFilter.size > 0 ? `${app.amenityFilter.size}` : undefined}>
          <div style={{ color: tm, fontSize: 9, marginBottom: 4 }}>Filters point overlay only.</div>
          {amenities.length > 0 && app.amenityFilter.size > 0 && (
            <button onClick={app.clearAmenities}
              style={{ background: 'none', border: 'none', color: '#c8a951', fontSize: 10, marginBottom: 4, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={9} /> Clear all
            </button>
          )}
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {amenities.map(a => {
              const sel = app.amenityFilter.has(a);
              return (
                <label key={a}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', cursor: 'pointer', borderRadius: 4, background: sel ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                  <input type="checkbox" checked={sel} onChange={() => app.toggleAmenity(a)} style={{ accentColor: '#ef4444' }} />
                  <span style={{ color: sel ? '#ef4444' : ts, fontSize: 11 }}>{a}</span>
                </label>
              );
            })}
          </div>
        </Section>

        {/* Search */}
        <div style={{ marginTop: 14 }}>
          <label style={{ color: tm, fontSize: 9, letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>SEARCH DISTRICT</label>
          <div style={{ position: 'relative' }}>
            <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: tm }} />
            <input
              value={app.search}
              onChange={e => app.setSearch(e.target.value)}
              placeholder="Type a district name…"
              style={{ width: '100%', padding: '6px 8px 6px 26px', borderRadius: 6, background: inputBg, border: `1px solid ${border}`, color: tp, fontSize: 11, outline: 'none' }}
            />
          </div>
          {app.search && stats && (
            <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
              {Object.entries(stats)
                .filter(([, d]) => d.name.toLowerCase().includes(app.search.toLowerCase()) ||
                                   (d.parent_name?.toLowerCase().includes(app.search.toLowerCase())))
                .slice(0, 25)
                .map(([id, d]: [string, { name: string; parent_name: string | null }]) => (
                  <button key={id} onClick={() => { app.selectRegion(id); app.setLevel('admin2'); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', background: 'none', border: 'none', color: ts, fontSize: 11, cursor: 'pointer' }}>
                    {d.name} <span style={{ color: tm, fontSize: 9 }}>({d.parent_name ?? ''})</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '8px 14px', borderTop: `1px solid ${border}`, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)' }}>
        <button onClick={app.resetFilters}
          style={{ width: '100%', padding: '7px 0', borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: ts, fontSize: 11, cursor: 'pointer' }}>
          Reset all filters
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </aside>
  );
}
