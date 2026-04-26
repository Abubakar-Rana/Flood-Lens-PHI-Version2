'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Users, Hospital, GraduationCap, MapPin, BarChart3, ArrowUpDown, RotateCcw, Building2, Ruler } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/lib/state';
import { loadCountries, loadStats } from '@/lib/data';
import { METRIC_BY_KEY, type CountryInfo, type StatsTable } from '@/lib/types';
import { downloadCsv, formatInt, formatMetric, formatNumber, statsToCsv, topN, bottomN } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

type Tab = 'detail' | 'compare' | 'country';

export default function StatsPanel() {
  const { isDark } = useTheme();
  const app = useApp();
  const [stats, setStats] = useState<StatsTable | null>(null);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [tab, setTab] = useState<Tab>('detail');
  const [topMode, setTopMode] = useState<'top' | 'bottom'>('top');

  useEffect(() => {
    loadStats(app.countryCode).then(setStats);
    loadCountries().then(idx => setCountry(idx.countries.find(c => c.code === app.countryCode) ?? null));
  }, [app.countryCode]);

  // Auto-switch to detail when a district is selected
  useEffect(() => {
    if (app.selectedDistrictId) setTab('detail');
  }, [app.selectedDistrictId]);

  const filterIds = useMemo(() => {
    if (!stats) return undefined;
    if (app.provinceFilter.size === 0) return undefined;
    const allowed = new Set<string>();
    for (const [id, d] of Object.entries(stats)) {
      if (app.provinceFilter.has(d.parent_id ?? '')) allowed.add(id);
    }
    return allowed;
  }, [stats, app.provinceFilter]);

  const visibleIds = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats).filter(id => {
      if (filterIds && !filterIds.has(id)) return false;
      const v = (stats[id] as Record<string, unknown>)[app.metric] as number;
      if (app.metricMin !== null && v < app.metricMin) return false;
      if (app.metricMax !== null && v > app.metricMax) return false;
      return true;
    });
  }, [stats, filterIds, app.metric, app.metricMin, app.metricMax]);

  const bg = isDark ? '#0f0f0f' : '#fff';
  const border = isDark ? '#2e2e2e' : '#e0e0e0';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  const md = METRIC_BY_KEY[app.metric];
  const district = app.selectedDistrictId && stats ? stats[app.selectedDistrictId] : null;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'detail', label: 'District', icon: MapPin },
    { key: 'compare', label: 'Ranking', icon: ArrowUpDown },
    { key: 'country', label: 'Country', icon: BarChart3 },
  ];

  const headerLabel = district ? district.name : country?.name ?? '–';
  const headerSubtitle = district ? (district.parent_name ?? '') : 'National view';

  return (
    <aside style={{ width: 320, height: '100%', background: bg, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: isDark ? '#1a1a1a' : '#f8f8f8', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: tm, fontSize: 9, letterSpacing: '0.06em' }}>
              {district ? 'DISTRICT SELECTED' : 'NATIONAL VIEW'}
            </div>
            <div style={{ color: tp, fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginTop: 2 }}>{headerLabel}</div>
            {headerSubtitle && <div style={{ color: ts, fontSize: 11 }}>{headerSubtitle}</div>}
          </div>
          {district && (
            <button onClick={() => app.selectDistrict(null)}
              title="Clear selection"
              style={{ padding: 6, borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: tm, cursor: 'pointer' }}>
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const dim = key === 'detail' && !district;
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '8px 4px', fontSize: 10, fontWeight: active ? 700 : 500,
                background: active ? '#c8a951' : 'transparent',
                color: active ? '#1a1200' : (dim ? tm : ts),
                border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                opacity: dim ? 0.5 : 1,
              }}>
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* DETAIL */}
        {tab === 'detail' && (
          district ? (
            <div style={{ padding: 14 }}>
              {/* Active metric headline */}
              <div style={{ padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}`, marginBottom: 12 }}>
                <div style={{ color: tm, fontSize: 9, letterSpacing: '0.06em' }}>{md.label.toUpperCase()}</div>
                <div style={{ color: '#c8a951', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}>
                  {formatMetric((district as Record<string, unknown>)[app.metric] as number, md)}
                  {md.unit && <span style={{ color: tm, fontSize: 12, marginLeft: 4, fontWeight: 400 }}>{md.unit}</span>}
                </div>
                <div style={{ color: tm, fontSize: 9, marginTop: 4 }}>{md.description}</div>
              </div>

              {/* Population block */}
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.25)`, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
                  <Users size={11} /> AFFECTED POPULATION
                </div>
                <Row label="Total" value={formatInt(district.affected_pop_total)} isDark={isDark} />
                <Row label="Mean per ~100m pixel" value={formatNumber(district.affected_pop_mean)} isDark={isDark} />
                <Row label="Peak pixel" value={formatInt(district.affected_pop_max)} isDark={isDark} />
                <Row label="Density (/km²)" value={formatNumber(district.affected_pop_density)} isDark={isDark} />
              </div>

              {/* Children block */}
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: `1px solid rgba(245,158,11,0.25)`, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
                  <Users size={11} /> AFFECTED CHILDREN
                </div>
                <Row label="Total" value={formatInt(district.affected_child_pop_total)} isDark={isDark} />
                <Row label="Mean per pixel" value={formatNumber(district.affected_child_pop_mean)} isDark={isDark} />
                <Row label="Children share" value={`${district.child_share_pct.toFixed(1)}%`} isDark={isDark} />
              </div>

              {/* Health block */}
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.06)', border: `1px solid rgba(34,197,94,0.25)`, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
                  <Hospital size={11} /> HEALTH
                </div>
                <Row label="Facility count" value={String(district.health_count)} isDark={isDark} />
                <Row label="Per 1000 km²" value={formatNumber(district.health_per_1k_sqkm)} isDark={isDark} />
                <Row label="Per 100k affected" value={formatNumber(district.health_per_100k_affected)} isDark={isDark} />
                {Object.keys(district.health_amenity_breakdown).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: tm, fontSize: 9, marginBottom: 4 }}>BY AMENITY</div>
                    <ResponsiveContainer width="100%" height={Math.max(80, Object.keys(district.health_amenity_breakdown).length * 18)}>
                      <BarChart layout="vertical" data={Object.entries(district.health_amenity_breakdown).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)}
                        margin={{ top: 0, right: 14, bottom: 0, left: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="k" type="category" width={70} tick={{ fontSize: 9, fill: ts }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(34,197,94,0.08)' }} contentStyle={{ fontSize: 11, background: bg, border: `1px solid ${border}` }} />
                        <Bar dataKey="v" fill="#22c55e" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Schools block */}
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: `1px solid rgba(59,130,246,0.25)`, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
                  <GraduationCap size={11} /> SCHOOLS
                </div>
                <Row label="Count" value={String(district.school_count)} isDark={isDark} />
                <Row label="Per 1000 km²" value={formatNumber(district.school_per_1k_sqkm)} isDark={isDark} />
                <Row label="Per 100k affected children" value={formatNumber(district.school_per_100k_affected_children)} isDark={isDark} />
              </div>

              {/* Geography */}
              <div style={{ padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ts, fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
                  <Ruler size={11} /> GEOGRAPHY
                </div>
                <Row label="Area" value={`${formatNumber(district.area_sqkm)} km²`} isDark={isDark} />
                <Row label="Centroid" value={district.center_lat != null && district.center_lon != null
                  ? `${district.center_lat.toFixed(3)}, ${district.center_lon.toFixed(3)}` : '–'} isDark={isDark} />
                <Row label="District ID" value={app.selectedDistrictId ?? '–'} isDark={isDark} />
              </div>
            </div>
          ) : (
            <Empty isDark={isDark} text="Click a district on the map, or use the search in the sidebar." />
          )
        )}

        {/* COMPARE */}
        {tab === 'compare' && stats && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <button onClick={() => setTopMode('top')}
                style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: topMode === 'top' ? '#c8a951' : 'transparent',
                  color: topMode === 'top' ? '#1a1200' : ts,
                  border: `1px solid ${topMode === 'top' ? '#c8a951' : border}`, cursor: 'pointer' }}>
                Top 10
              </button>
              <button onClick={() => setTopMode('bottom')}
                style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: topMode === 'bottom' ? '#c8a951' : 'transparent',
                  color: topMode === 'bottom' ? '#1a1200' : ts,
                  border: `1px solid ${topMode === 'bottom' ? '#c8a951' : border}`, cursor: 'pointer' }}>
                Bottom 10
              </button>
            </div>
            <div style={{ color: tm, fontSize: 9, marginBottom: 6, letterSpacing: '0.06em' }}>BY {md.short.toUpperCase()}</div>

            {(() => {
              const ids = filterIds;
              const list = topMode === 'top'
                ? topN(stats, app.metric, 10, ids)
                : bottomN(stats, app.metric, 10, ids);
              const max = Math.max(...list.map(x => x.value), 1);
              const dataForChart = list.map(x => ({ name: x.data.name, value: x.value, id: x.id }));
              return (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(180, list.length * 24)}>
                    <BarChart layout="vertical" data={dataForChart} margin={{ top: 0, right: 14, bottom: 0, left: 0 }}>
                      <XAxis type="number" hide domain={[0, max]} />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9, fill: ts }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(200,169,81,0.08)' }} contentStyle={{ fontSize: 11, background: bg, border: `1px solid ${border}` }}
                        formatter={(v: any) => formatMetric(Number(v), md)} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]} onClick={(d: any) => app.selectDistrict(d.id)}>
                        {dataForChart.map((d, i) => (
                          <Cell key={i} fill={d.id === app.selectedDistrictId ? '#facc15' : '#c8a951'} cursor="pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ color: tm, fontSize: 9, marginTop: 6 }}>Click a bar to focus on that district.</div>
                </>
              );
            })()}

            {/* Distribution histogram */}
            <div style={{ marginTop: 18 }}>
              <div style={{ color: tm, fontSize: 9, marginBottom: 6, letterSpacing: '0.06em' }}>DISTRIBUTION</div>
              <Histogram stats={stats} metric={app.metric} ids={filterIds} isDark={isDark} />
            </div>

            {/* CSV export */}
            <button onClick={() => downloadCsv(statsToCsv(stats, visibleIds), `${app.countryCode}_${app.metric}.csv`)}
              style={{ marginTop: 14, width: '100%', padding: '8px 0', borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: ts, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Download size={11} /> Export {visibleIds.length} districts as CSV
            </button>
          </div>
        )}

        {/* COUNTRY */}
        {tab === 'country' && country && (
          <div style={{ padding: 14 }}>
            <div style={{ color: tm, fontSize: 9, letterSpacing: '0.06em', marginBottom: 8 }}>NATIONAL TOTALS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Tile color="#ef4444" icon={Users} label="Affected Pop." value={formatInt(country.totals.affected_pop_total)} isDark={isDark} />
              <Tile color="#f59e0b" icon={Users} label="Affected Children" value={formatInt(country.totals.affected_child_pop_total)} isDark={isDark} />
              <Tile color="#22c55e" icon={Hospital} label="Health Facilities" value={formatInt(country.totals.health_count)} isDark={isDark} />
              <Tile color="#3b82f6" icon={GraduationCap} label="Schools" value={formatInt(country.totals.school_count)} isDark={isDark} />
              <Tile color="#a855f7" icon={MapPin} label="Districts" value={formatInt(country.totals.district_count)} isDark={isDark} />
              <Tile color="#14b8a6" icon={Ruler} label="Area (km²)" value={formatInt(country.totals.area_sqkm)} isDark={isDark} />
            </div>

            {/* National amenity mix */}
            {Object.keys(country.totals.health_amenity_breakdown).length > 0 && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Building2 size={11} style={{ color: '#22c55e' }} />
                  <span style={{ color: ts, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>HEALTH AMENITY MIX</span>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(120, Object.keys(country.totals.health_amenity_breakdown).length * 18)}>
                  <BarChart layout="vertical" data={Object.entries(country.totals.health_amenity_breakdown).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)}
                    margin={{ top: 0, right: 14, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="k" type="category" width={90} tick={{ fontSize: 9, fill: ts }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(34,197,94,0.08)' }} contentStyle={{ fontSize: 11, background: bg, border: `1px solid ${border}` }} />
                    <Bar dataKey="v" fill="#22c55e" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-capita summary */}
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
              <div style={{ color: ts, fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>DERIVED RATIOS</div>
              <Row label="Children share of affected" value={`${(country.totals.affected_child_pop_total / Math.max(1, country.totals.affected_pop_total) * 100).toFixed(2)}%`} isDark={isDark} />
              <Row label="Health per 100k affected" value={formatNumber(country.totals.health_count / Math.max(1, country.totals.affected_pop_total) * 100000)} isDark={isDark} />
              <Row label="Schools per 100k affected children" value={formatNumber(country.totals.school_count / Math.max(1, country.totals.affected_child_pop_total) * 100000)} isDark={isDark} />
              <Row label="Health per 1000 km²" value={formatNumber(country.totals.health_count / Math.max(1, country.totals.area_sqkm) * 1000)} isDark={isDark} />
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '6px 14px', borderTop: `1px solid ${border}`, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)' }}>
        <p style={{ color: tm, fontSize: 9 }}>
          PHI Lab · University of Oxford
        </p>
      </div>
    </aside>
  );
}

function Row({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
      <span style={{ color: isDark ? '#aaa' : '#444', fontSize: 11 }}>{label}</span>
      <span style={{ color: isDark ? '#fff' : '#111', fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function Tile({ color, icon: Icon, label, value, isDark }: any) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: `${color}10`, border: `1px solid ${color}30` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon size={11} style={{ color }} />
        <span style={{ color, fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
      </div>
      <div style={{ color, fontSize: 16, fontWeight: 800, fontFamily: 'monospace', marginTop: 3 }}>{value}</div>
    </div>
  );
}

function Empty({ isDark, text }: { isDark: boolean; text: string }) {
  const tm = isDark ? '#666' : '#888';
  const ts = isDark ? '#aaa' : '#444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, textAlign: 'center', padding: 24 }}>
      <MapPin size={28} style={{ color: tm, marginBottom: 10, opacity: 0.4 }} />
      <p style={{ color: ts, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>No district selected</p>
      <p style={{ color: tm, fontSize: 10, lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

function Histogram({ stats, metric, ids, isDark }: { stats: StatsTable; metric: any; ids?: Set<string>; isDark: boolean }) {
  const data = useMemo(() => {
    const vals: number[] = [];
    for (const [id, d] of Object.entries(stats)) {
      if (ids && !ids.has(id)) continue;
      const v = (d as Record<string, unknown>)[metric] as number;
      if (typeof v === 'number' && isFinite(v) && v > 0) vals.push(v);
    }
    if (vals.length === 0) return [];
    vals.sort((a, b) => a - b);
    const min = vals[0], max = vals[vals.length - 1];
    const bins = 12;
    const w = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      bin: i,
      label: formatNumber(min + i * w),
      count: 0,
    }));
    for (const v of vals) {
      const idx = Math.min(bins - 1, Math.floor((v - min) / w));
      buckets[idx].count++;
    }
    return buckets;
  }, [stats, metric, ids]);

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 18, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 8, fill: isDark ? '#888' : '#666' }} interval={1} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 8, fill: isDark ? '#888' : '#666' }} width={24} />
        <Tooltip contentStyle={{ fontSize: 11, background: isDark ? '#0f0f0f' : '#fff', border: `1px solid ${isDark ? '#2e2e2e' : '#e0e0e0'}` }} />
        <Bar dataKey="count" fill="#c8a951" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
