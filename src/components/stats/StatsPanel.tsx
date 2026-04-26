'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Users, Hospital, GraduationCap, MapPin, BarChart3, ArrowUpDown, RotateCcw, Building2, Ruler, Loader2 } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/lib/state';
import { loadCountries, loadStats } from '@/lib/data';
import { METRIC_BY_KEY, type CountriesIndex, type CountryInfo, type StatsTable, type DistrictStats } from '@/lib/types';
import { downloadCsv, formatInt, formatMetric, formatNumber, statsForLevel, statsToCsv, topN, bottomN, impactTier, metricValues, quantileBreaks } from '@/lib/utils';
import { useTheme } from '@/lib/theme';

type Tab = 'detail' | 'compare' | 'country';

export default function StatsPanel() {
  const { isDark } = useTheme();
  const app = useApp();
  const [stats, setStats] = useState<StatsTable | null>(null);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [allCountries, setAllCountries] = useState<CountriesIndex | null>(null);
  const [tab, setTab] = useState<Tab>('detail');
  const [topMode, setTopMode] = useState<'top' | 'bottom'>('top');

  useEffect(() => {
    loadStats(app.countryCode).then(setStats);
    loadCountries().then(idx => {
      setAllCountries(idx);
      setCountry(idx.countries.find(c => c.code === app.countryCode) ?? null);
    });
  }, [app.countryCode]);

  // Auto-switch to detail when something becomes selected
  useEffect(() => {
    if (app.selectedRegionId) setTab('detail');
  }, [app.selectedRegionId]);

  // Pick the right stats table for the current level (district vs province)
  const activeStats: StatsTable | null = useMemo(() => {
    if (!stats) return null;
    return statsForLevel(stats, app.level);
  }, [stats, app.level]);

  const filterIds = useMemo(() => {
    if (!activeStats) return undefined;
    if (app.provinceFilter.size === 0 && !app.hideZeroAffected) return undefined;
    const allowed = new Set<string>();
    for (const [id, d] of Object.entries(activeStats)) {
      if (app.provinceFilter.size > 0) {
        if (app.level === 'admin1' && !app.provinceFilter.has(id)) continue;
        if (app.level === 'admin2' && !app.provinceFilter.has(d.parent_id ?? '')) continue;
      }
      if (app.hideZeroAffected && (d.affected_pop_total ?? 0) <= 0) continue;
      allowed.add(id);
    }
    return allowed;
  }, [activeStats, app.provinceFilter, app.level, app.hideZeroAffected]);

  const visibleIds = useMemo(() => {
    if (!activeStats) return [];
    return Object.keys(activeStats).filter(id => {
      if (filterIds && !filterIds.has(id)) return false;
      const v = (activeStats[id] as unknown as Record<string, unknown>)[app.metric] as number;
      if (app.metricMin !== null && v < app.metricMin) return false;
      if (app.metricMax !== null && v > app.metricMax) return false;
      return true;
    });
  }, [activeStats, filterIds, app.metric, app.metricMin, app.metricMax]);

  // Auto-resolve effective region for the detail tab:
  //  1. If the user explicitly selected a region — use that.
  //  2. Else if exactly ONE province is in the province filter — show that province aggregated.
  //  3. Else — null (national view).
  const effectiveRegionId: string | null = useMemo(() => {
    if (app.selectedRegionId) return app.selectedRegionId;
    if (app.provinceFilter.size === 1) {
      const onlyId = Array.from(app.provinceFilter)[0];
      return onlyId;
    }
    return null;
  }, [app.selectedRegionId, app.provinceFilter]);

  // Look up the region row in the right table — province aggregate if it
  // looks like a province id, district stats otherwise.
  const regionRow: { id: string; data: DistrictStats; level: 'admin1' | 'admin2' } | null = useMemo(() => {
    if (!stats || !effectiveRegionId) return null;
    // Try district first
    if (stats[effectiveRegionId]) {
      return { id: effectiveRegionId, data: stats[effectiveRegionId], level: 'admin2' };
    }
    // Fall back to province aggregate
    const provStats = statsForLevel(stats, 'admin1');
    if (provStats[effectiveRegionId]) {
      return { id: effectiveRegionId, data: provStats[effectiveRegionId], level: 'admin1' };
    }
    return null;
  }, [stats, effectiveRegionId]);

  const bg = isDark ? '#0f0f0f' : '#fff';
  const border = isDark ? '#2e2e2e' : '#e0e0e0';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  const md = METRIC_BY_KEY[app.metric];
  const region = regionRow?.data ?? null;
  const regionLevel = regionRow?.level ?? null;

  // Impact tier for selected region (uses district-level distribution as the
  // reference even when looking at an aggregate, so labels are comparable).
  const tierBreaks = useMemo(() => {
    if (!stats) return null;
    return quantileBreaks(metricValues(stats, 'affected_pop_total'), 5);
  }, [stats]);
  const tier = useMemo(() => {
    if (!region || !tierBreaks) return null;
    return impactTier(region.affected_pop_total, tierBreaks);
  }, [region, tierBreaks]);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'detail',  label: regionLevel === 'admin1' ? 'Province' : 'District', icon: MapPin },
    { key: 'compare', label: 'Ranking', icon: ArrowUpDown },
    { key: 'country', label: 'Country', icon: BarChart3 },
  ];

  const headerLabel = region ? region.name : country?.name ?? '–';
  const headerSubtitle = region
    ? (regionLevel === 'admin1' ? `Province aggregate · ${stats ? Object.values(stats).filter(d => d.parent_id === regionRow?.id).length : 0} districts` : (region.parent_name ?? ''))
    : 'National view';
  const headerKind = region
    ? (regionLevel === 'admin1' ? 'PROVINCE SELECTED' : 'DISTRICT SELECTED')
    : 'NATIONAL VIEW';

  return (
    <aside style={{ width: 320, height: '100%', background: bg, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: isDark ? '#1a1a1a' : '#f8f8f8', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: tm, fontSize: 9, letterSpacing: '0.06em' }}>{headerKind}</span>
              {app.loading && <Loader2 size={10} style={{ color: '#c8a951', animation: 'spin 1s linear infinite' }} />}
            </div>
            <div style={{ color: tp, fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginTop: 2 }}>{headerLabel}</div>
            {headerSubtitle && <div style={{ color: ts, fontSize: 11 }}>{headerSubtitle}</div>}
            {tier && region && (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 12, background: `${tier.color}20`, border: `1px solid ${tier.color}50` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: tier.color }} />
                <span style={{ color: tier.color, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {tier.label.toUpperCase()} IMPACT
                </span>
              </div>
            )}
          </div>
          {region && app.selectedRegionId && (
            <button onClick={() => app.selectRegion(null)}
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
          const dim = key === 'detail' && !region;
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
        {/* Loading skeleton */}
        {app.loading && !stats && (
          <div style={{ padding: 14 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ height: 80, marginBottom: 10, borderRadius: 8, background: cardBg, border: `1px solid ${border}`,
                position: 'relative', overflow: 'hidden' }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0,
                  background: `linear-gradient(90deg, transparent, ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}, transparent)` }} />
              </div>
            ))}
          </div>
        )}

        {/* DETAIL */}
        {tab === 'detail' && !app.loading && (
          region && stats ? (
            <DetailView region={region} regionLevel={regionLevel} app={app} md={md} stats={stats} regionRow={regionRow} isDark={isDark} cardBg={cardBg} border={border} ts={ts} tm={tm} tp={tp} bg={bg} />
          ) : (
            <Empty isDark={isDark} text="Click a district or province on the map, search by name, or pick exactly one province in the filter." />
          )
        )}

        {/* COMPARE */}
        {tab === 'compare' && activeStats && !app.loading && (
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
            <div style={{ color: tm, fontSize: 9, marginBottom: 6, letterSpacing: '0.06em' }}>
              {app.level === 'admin1' ? 'PROVINCES' : 'DISTRICTS'} BY {md.short.toUpperCase()}
            </div>
            {(() => {
              const list = topMode === 'top'
                ? topN(activeStats, app.metric, 10, filterIds)
                : bottomN(activeStats, app.metric, 10, filterIds);
              const max = Math.max(...list.map(x => x.value), 1);
              const dataForChart = list.map(x => ({ name: x.data.name, value: x.value, id: x.id }));
              return (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(180, list.length * 24)}>
                    <BarChart layout="vertical" data={dataForChart} margin={{ top: 0, right: 14, bottom: 0, left: 0 }}>
                      <XAxis type="number" hide domain={[0, max]} />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9, fill: ts }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(200,169,81,0.08)' }} contentStyle={{ fontSize: 11, background: bg, border: `1px solid ${border}` }}
                        formatter={((v: unknown) => formatMetric(Number(v), md)) as never} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]} onClick={(d: { id?: string }) => d.id && app.selectRegion(d.id)}>
                        {dataForChart.map((d, i) => (
                          <Cell key={i} fill={d.id === app.selectedRegionId ? '#facc15' : '#c8a951'} cursor="pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ color: tm, fontSize: 9, marginTop: 6 }}>Click a bar to focus that region.</div>
                </>
              );
            })()}

            <div style={{ marginTop: 18 }}>
              <div style={{ color: tm, fontSize: 9, marginBottom: 6, letterSpacing: '0.06em' }}>DISTRIBUTION</div>
              <Histogram stats={activeStats} metric={app.metric} ids={filterIds} isDark={isDark} />
            </div>

            <button onClick={() => downloadCsv(statsToCsv(activeStats, visibleIds), `${app.countryCode}_${app.level}_${app.metric}.csv`)}
              style={{ marginTop: 14, width: '100%', padding: '8px 0', borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: ts, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Download size={11} /> Export {visibleIds.length} {app.level === 'admin1' ? 'provinces' : 'districts'} as CSV
            </button>
          </div>
        )}

        {/* COUNTRY */}
        {tab === 'country' && country && allCountries && !app.loading && (
          <CountryView country={country} all={allCountries} isDark={isDark} cardBg={cardBg} border={border} bg={bg} ts={ts} tm={tm} tp={tp} />
        )}
      </div>

      <div style={{ flexShrink: 0, padding: '6px 14px', borderTop: `1px solid ${border}`, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)' }}>
        <p style={{ color: tm, fontSize: 9 }}>PHI Lab · University of Oxford</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .skeleton-shimmer { animation: shimmer 1.4s infinite; }
      `}</style>
    </aside>
  );
}

// ─── Detail tab ──────────────────────────────────────────────────────

function DetailView({ region, regionLevel, app, md, stats, regionRow, isDark, cardBg, border, ts, tm, tp, bg }: any) {
  // Compute the value of the active metric for this region
  const v = (region as Record<string, unknown>)[app.metric] as number;
  // Districts inside this province (only when at admin1)
  const childDistricts: Array<{ id: string; data: DistrictStats }> = useMemo(() => {
    if (regionLevel !== 'admin1' || !stats) return [];
    return Object.entries(stats as StatsTable)
      .filter(([, d]) => d.parent_id === regionRow.id)
      .map(([id, d]) => ({ id, data: d }))
      .sort((a, b) => (b.data.affected_pop_total - a.data.affected_pop_total));
  }, [regionLevel, stats, regionRow]);

  return (
    <div style={{ padding: 14 }}>
      {/* Active metric headline */}
      <div style={{ padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}`, marginBottom: 12 }}>
        <div style={{ color: tm, fontSize: 9, letterSpacing: '0.06em' }}>{md.label.toUpperCase()}</div>
        <div style={{ color: '#c8a951', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}>
          {formatMetric(v, md)}
          {md.unit && <span style={{ color: tm, fontSize: 12, marginLeft: 4, fontWeight: 400 }}>{md.unit}</span>}
        </div>
        <div style={{ color: tm, fontSize: 9, marginTop: 4 }}>{md.description}</div>
      </div>

      {/* Population block */}
      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.25)`, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
          <Users size={11} /> FLOOD-AFFECTED POPULATION
        </div>
        <Row label="Total" value={formatInt(region.affected_pop_total)} isDark={isDark} />
        <Row label="Mean per ~100m pixel" value={formatNumber(region.affected_pop_mean)} isDark={isDark} />
        <Row label="Peak pixel" value={formatInt(region.affected_pop_max)} isDark={isDark} />
        <Row label="Density (/km²)" value={formatNumber(region.affected_pop_density)} isDark={isDark} />
      </div>

      {/* Children block */}
      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: `1px solid rgba(245,158,11,0.25)`, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
          <Users size={11} /> FLOOD-AFFECTED CHILDREN
        </div>
        <Row label="Total" value={formatInt(region.affected_child_pop_total)} isDark={isDark} />
        <Row label="Mean per pixel" value={formatNumber(region.affected_child_pop_mean)} isDark={isDark} />
        <Row label="Children share" value={`${region.child_share_pct.toFixed(1)}%`} isDark={isDark} />
      </div>

      {/* Health block */}
      <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.06)', border: `1px solid rgba(34,197,94,0.25)`, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22c55e', fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
          <Hospital size={11} /> FLOOD-AFFECTED HEALTH FACILITIES
        </div>
        <Row label="Flood-affected facility count" value={String(region.health_count)} isDark={isDark} />
        <Row label="Per 1000 km²" value={formatNumber(region.health_per_1k_sqkm)} isDark={isDark} />
        <Row label="Per 100k flood-affected" value={formatNumber(region.health_per_100k_affected)} isDark={isDark} />
        <Row label="People per facility (strain)" value={formatInt(region.affected_per_health_facility)} isDark={isDark} />
        {Object.keys(region.health_amenity_breakdown ?? {}).length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ color: tm, fontSize: 9, marginBottom: 4 }}>BY AMENITY</div>
            <ResponsiveContainer width="100%" height={Math.max(80, Object.keys(region.health_amenity_breakdown).length * 18)}>
              <BarChart layout="vertical" data={Object.entries(region.health_amenity_breakdown).map(([k, v]) => ({ k, v: v as number })).sort((a, b) => b.v - a.v)}
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
          <GraduationCap size={11} /> FLOOD-AFFECTED SCHOOLS
        </div>
        <Row label="Flood-affected school count" value={String(region.school_count)} isDark={isDark} />
        <Row label="Per 1000 km²" value={formatNumber(region.school_per_1k_sqkm)} isDark={isDark} />
        <Row label="Per 100k flood-affected children" value={formatNumber(region.school_per_100k_affected_children)} isDark={isDark} />
        <Row label="Children per school (strain)" value={formatInt(region.affected_children_per_school)} isDark={isDark} />
      </div>

      {/* Top-impact districts inside province (admin1 only) */}
      {regionLevel === 'admin1' && childDistricts.length > 0 && (
        <div style={{ padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}`, marginBottom: 12 }}>
          <div style={{ color: ts, fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
            TOP DISTRICTS IN PROVINCE
          </div>
          {childDistricts.slice(0, 5).map(({ id, data }) => (
            <button key={id} onClick={() => app.selectRegion(id)}
              style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '5px 0', background: 'none', border: 'none', cursor: 'pointer',
                       borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
              <span style={{ color: ts, fontSize: 11 }}>{data.name}</span>
              <span style={{ color: tp, fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>{formatInt(data.affected_pop_total)}</span>
            </button>
          ))}
          {childDistricts.length > 5 && (
            <div style={{ color: tm, fontSize: 9, marginTop: 4, textAlign: 'center' }}>+ {childDistricts.length - 5} more</div>
          )}
        </div>
      )}

      {/* Geography */}
      <div style={{ padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ts, fontSize: 10, fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
          <Ruler size={11} /> GEOGRAPHY
        </div>
        <Row label="Area" value={`${formatNumber(region.area_sqkm)} km²`} isDark={isDark} />
        <Row label="Centroid" value={region.center_lat != null && region.center_lon != null
          ? `${region.center_lat.toFixed(3)}, ${region.center_lon.toFixed(3)}` : '–'} isDark={isDark} />
        <Row label="ID" value={regionRow?.id ?? '–'} isDark={isDark} />
      </div>
    </div>
  );
}

// ─── Country tab ─────────────────────────────────────────────────────

function CountryView({ country, all, isDark, cardBg, border, bg, ts, tm, tp }: any) {
  const totals = country.totals;
  return (
    <div style={{ padding: 14 }}>
      <div style={{ color: tm, fontSize: 9, letterSpacing: '0.06em', marginBottom: 8 }}>NATIONAL TOTALS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Tile color="#ef4444" icon={Users} label="Flood-Aff. Pop." value={formatInt(totals.affected_pop_total)} />
        <Tile color="#f59e0b" icon={Users} label="Flood-Aff. Children" value={formatInt(totals.affected_child_pop_total)} />
        <Tile color="#22c55e" icon={Hospital} label="Flood-Aff. Health" value={formatInt(totals.health_count)} />
        <Tile color="#3b82f6" icon={GraduationCap} label="Flood-Aff. Schools" value={formatInt(totals.school_count)} />
        <Tile color="#a855f7" icon={MapPin} label="Districts" value={formatInt(totals.district_count)} />
        <Tile color="#14b8a6" icon={Ruler} label="Area (km²)" value={formatInt(totals.area_sqkm)} />
      </div>

      {/* National amenity mix */}
      {Object.keys(totals.health_amenity_breakdown ?? {}).length > 0 && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Building2 size={11} style={{ color: '#22c55e' }} />
            <span style={{ color: ts, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>FLOOD-AFF. HEALTH AMENITY MIX</span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(120, Object.keys(totals.health_amenity_breakdown).length * 18)}>
            <BarChart layout="vertical" data={Object.entries(totals.health_amenity_breakdown).map(([k, v]) => ({ k, v: v as number })).sort((a, b) => b.v - a.v)}
              margin={{ top: 0, right: 14, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="k" type="category" width={90} tick={{ fontSize: 9, fill: ts }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(34,197,94,0.08)' }} contentStyle={{ fontSize: 11, background: bg, border: `1px solid ${border}` }} />
              <Bar dataKey="v" fill="#22c55e" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cross-country comparison strip */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
        <div style={{ color: ts, fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>VS OTHER COUNTRIES</div>
        <div style={{ color: tm, fontSize: 9, marginBottom: 6 }}>Total flood-affected population.</div>
        <ResponsiveContainer width="100%" height={Math.max(140, all.countries.length * 22)}>
          <BarChart layout="vertical"
            data={all.countries.map((c: CountryInfo) => ({ name: c.name, value: c.totals.affected_pop_total, code: c.code }))
              .sort((a: { value: number }, b: { value: number }) => b.value - a.value)}
            margin={{ top: 0, right: 14, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 9, fill: ts }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(200,169,81,0.08)' }} contentStyle={{ fontSize: 11, background: bg, border: `1px solid ${border}` }}
              formatter={((v: unknown) => formatInt(Number(v))) as never} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {all.countries.map((c: CountryInfo, i: number) => (
                <Cell key={i} fill={c.code === country.code ? '#facc15' : '#c8a951'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-capita summary */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}` }}>
        <div style={{ color: ts, fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>DERIVED RATIOS</div>
        <Row label="Children share of flood-affected" value={`${(totals.affected_child_pop_total / Math.max(1, totals.affected_pop_total) * 100).toFixed(2)}%`} isDark={isDark} />
        <Row label="Flood-aff. health per 100k flood-aff." value={formatNumber(totals.health_count / Math.max(1, totals.affected_pop_total) * 100000)} isDark={isDark} />
        <Row label="Flood-aff. schools per 100k flood-aff. children" value={formatNumber(totals.school_count / Math.max(1, totals.affected_child_pop_total) * 100000)} isDark={isDark} />
        <Row label="Flood-aff. health per 1000 km²" value={formatNumber(totals.health_count / Math.max(1, totals.area_sqkm) * 1000)} isDark={isDark} />
        <Row label="People per flood-aff. health facility" value={formatInt(totals.affected_pop_total / Math.max(1, totals.health_count))} isDark={isDark} />
        <Row label="Children per flood-aff. school" value={formatInt(totals.affected_child_pop_total / Math.max(1, totals.school_count))} isDark={isDark} />
      </div>
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────

function Row({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
      <span style={{ color: isDark ? '#aaa' : '#444', fontSize: 11 }}>{label}</span>
      <span style={{ color: isDark ? '#fff' : '#111', fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function Tile({ color, icon: Icon, label, value }: { color: string; icon: React.ElementType; label: string; value: string }) {
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
      <p style={{ color: ts, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>No region selected</p>
      <p style={{ color: tm, fontSize: 10, lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

function Histogram({ stats, metric, ids, isDark }: { stats: StatsTable; metric: string; ids?: Set<string>; isDark: boolean }) {
  const data = useMemo(() => {
    const vals: number[] = [];
    for (const [id, d] of Object.entries(stats)) {
      if (ids && !ids.has(id)) continue;
      const v = (d as unknown as Record<string, unknown>)[metric] as number;
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
