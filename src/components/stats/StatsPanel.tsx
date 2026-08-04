'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download, Users, Hospital, GraduationCap, MapPin, RotateCcw,
  Ruler, Loader2, Waves, TriangleAlert, ChevronDown, Baby,
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, LATEST_OBSERVED_YEAR } from '@/lib/state';
import { loadCountries, loadEvent, loadStats, loadTimeline, loadYears } from '@/lib/data';
import {
  LENS_BY_KEY, lensesForKind, METRIC_BY_KEY,
  type CountryInfo, type EventFacts,
  type StatsTable, type Timeline, type YearDef,
} from '@/lib/types';
import {
  downloadCsv, formatBig, formatInt, formatNumber, impactTier,
  metricValues, projectStats, projectionFactor, quantileBreaks,
  statsForLevel, statsToCsv, topN,
} from '@/lib/utils';
import { useTheme } from '@/lib/theme';

export default function StatsPanel() {
  const { isDark } = useTheme();
  const app = useApp();
  const [rawStats, setRawStats] = useState<StatsTable | null>(null);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [years, setYears] = useState<YearDef[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [event, setEvent] = useState<EventFacts | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const year = years.find(y => y.id === app.year) ?? null;

  useEffect(() => { loadYears().then(r => setYears(r.years)).catch(() => {}); }, []);
  useEffect(() => {
    loadCountries().then(idx =>
      setCountry(idx.countries.find(c => c.code === app.countryCode) ?? null));
    loadTimeline(app.countryCode).then(setTimeline).catch(() => setTimeline(null));
  }, [app.countryCode]);
  useEffect(() => {
    if (!year) return;
    let alive = true;
    loadStats(app.countryCode, year).then(s => alive && setRawStats(s));
    loadEvent(app.countryCode, year)
      .then(e => alive && setEvent(e)).catch(() => alive && setEvent(null));
    return () => { alive = false; };
  }, [app.countryCode, year]);

  const stats = useMemo(() => {
    if (!rawStats) return null;
    const f = projectionFactor(timeline, app.scrubYear, app.metric, Number(app.year));
    return projectStats(rawStats, f);
  }, [rawStats, timeline, app.scrubYear, app.metric, app.year]);

  const activeStats: StatsTable | null = useMemo(
    () => stats ? statsForLevel(stats, app.level) : null, [stats, app.level]);

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
      const v = activeStats[id][app.metric] as number;
      if (app.metricMin !== null && v < app.metricMin) return false;
      if (app.metricMax !== null && v > app.metricMax) return false;
      return true;
    });
  }, [activeStats, filterIds, app.metric, app.metricMin, app.metricMax]);

  // A single province in the filter reads as "show me this province" — no
  // extra click on the map needed to see its detail.
  const effectiveRegionId = useMemo(() => {
    if (app.selectedRegionId) return app.selectedRegionId;
    if (app.provinceFilter.size === 1) return Array.from(app.provinceFilter)[0];
    return null;
  }, [app.selectedRegionId, app.provinceFilter]);

  const regionRow = useMemo(() => {
    if (!stats || !effectiveRegionId) return null;
    if (stats[effectiveRegionId]) {
      return { id: effectiveRegionId, data: stats[effectiveRegionId], level: 'admin2' as const };
    }
    const prov = statsForLevel(stats, 'admin1');
    if (prov[effectiveRegionId]) {
      return { id: effectiveRegionId, data: prov[effectiveRegionId], level: 'admin1' as const };
    }
    return null;
  }, [stats, effectiveRegionId]);

  const bg = isDark ? '#0f0f0f' : '#fff';
  const border = isDark ? '#2e2e2e' : '#e0e0e0';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

  const region = regionRow?.data ?? null;
  const regionLevel = regionRow?.level ?? null;
  const lenses = lensesForKind(year?.kind ?? 'event');

  // National figures come from summing the same table the map paints, so the
  // panel can never disagree with the choropleth.
  const nationalTotal = (key: string): number => {
    if (!stats) return 0;
    let n = 0;
    for (const d of Object.values(stats)) {
      const v = d[key];
      if (typeof v === 'number' && isFinite(v)) n += v;
    }
    return n;
  };
  const valueFor = (key: string): number => {
    if (region) {
      const v = region[key];
      return typeof v === 'number' ? v : 0;
    }
    return nationalTotal(key);
  };

  const tierBreaks = useMemo(
    () => stats ? quantileBreaks(metricValues(stats, 'affected_pop_total'), 5) : null, [stats]);
  const tier = useMemo(
    () => (region && tierBreaks) ? impactTier(region.affected_pop_total, tierBreaks) : null,
    [region, tierBreaks]);

  const activeLens = app.lens ? LENS_BY_KEY[app.lens] : null;
  const md = METRIC_BY_KEY[app.metric];
  const headlineValue = valueFor(app.metric);
  const isProjected = app.scrubYear > LATEST_OBSERVED_YEAR;

  const shareOfCountry = useMemo(() => {
    if (!region || !stats) return null;
    const nat = nationalTotal(app.metric);
    const own = (region[app.metric] as number) ?? 0;
    return nat > 0 ? (own / nat) * 100 : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, stats, app.metric]);

  return (
    <aside style={{ width: 320, height: '100%', background: bg, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: isDark ? '#1a1a1a' : '#f8f8f8', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: tm, fontSize: 9, letterSpacing: '0.06em' }}>
                {region ? (regionLevel === 'admin1' ? 'PROVINCE' : 'DISTRICT') : 'WHOLE COUNTRY'}
              </span>
              {app.loading && <Loader2 size={10} style={{ color: '#c8a951', animation: 'spin 1s linear infinite' }} />}
            </div>
            <div style={{ color: tp, fontSize: 16, fontWeight: 800, lineHeight: 1.2, marginTop: 2 }}>
              {region ? region.name : country?.name ?? '–'}
            </div>
            <div style={{ color: ts, fontSize: 11 }}>
              {region
                ? (regionLevel === 'admin1'
                    ? `${stats ? Object.values(stats).filter(d => d.parent_id === regionRow?.id).length : 0} districts`
                    : (region.parent_name ?? ''))
                : (year?.label ?? '')}
            </div>
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
            <button onClick={() => app.selectRegion(null)} title="Back to the whole country"
              style={{ padding: 6, borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: tm, cursor: 'pointer' }}>
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {app.loading && !stats ? (
          <div style={{ padding: 14 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ height: 80, marginBottom: 10, borderRadius: 10, background: cardBg, border: `1px solid ${border}`, position: 'relative', overflow: 'hidden' }}>
                <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}, transparent)` }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 14 }}>

            {/* ── The one number this view is about ─────────────────── */}
            <div style={{
              padding: '14px 14px 12px', borderRadius: 12, marginBottom: 12,
              background: activeLens ? `${activeLens.color}12` : cardBg,
              border: `1px solid ${activeLens ? `${activeLens.color}45` : border}`,
            }}>
              <div style={{ color: activeLens?.color ?? tm, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em' }}>
                {(activeLens?.label ?? md.short).toUpperCase()}
                {isProjected && ' · PROJECTED'}
              </div>
              <div style={{
                color: activeLens?.color ?? '#c8a951',
                fontSize: 40, fontWeight: 800, lineHeight: 1.02, marginTop: 4,
                letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
              }}>
                {formatBig(headlineValue)}
                {md.unit && <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 4 }}>{md.unit}</span>}
              </div>
              <div style={{ color: ts, fontSize: 11, marginTop: 5, lineHeight: 1.45 }}>
                {activeLens?.question ?? md.description}
              </div>
              {shareOfCountry !== null && shareOfCountry > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 5, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, shareOfCountry)}%`, height: '100%',
                      background: activeLens?.color ?? '#c8a951', borderRadius: 3,
                      transition: 'width .5s ease',
                    }} />
                  </div>
                  <div style={{ color: tm, fontSize: 10, marginTop: 4 }}>
                    {shareOfCountry.toFixed(1)}% of the national total
                  </div>
                </div>
              )}
            </div>

            {/* ── At a glance ───────────────────────────────────────── */}
            <SectionLabel color={tm}>AT A GLANCE</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {lenses.map(l => (
                <BigTile
                  key={l.key}
                  color={l.color}
                  icon={l.key === 'children' ? Baby : l.key === 'water' ? Waves
                    : l.key === 'hospitals' ? Hospital : l.key === 'schools' ? GraduationCap : Users}
                  label={l.label}
                  value={formatBig(valueFor(l.metric))}
                  suffix={l.key === 'water' ? 'km²' : undefined}
                  active={app.lens === l.key}
                  onClick={() => app.setLens(l.key)}
                />
              ))}
            </div>

            {/* ── Worst case ────────────────────────────────────────── */}
            {timeline && !region && (
              <div style={{
                padding: 12, borderRadius: 12, marginBottom: 14,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <TriangleAlert size={12} style={{ color: '#ef4444' }} />
                  <span style={{ color: '#ef4444', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em' }}>
                    IF A 1-IN-100-YEAR FLOOD HITS
                  </span>
                </div>
                <div style={{ color: '#ef4444', fontSize: 32, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                  {formatBig(timeline.scenario.value)}
                </div>
                <div style={{ color: ts, fontSize: 11, marginTop: 3 }}>
                  people in water 1.5 m deep or more
                  {timeline.scenario.u18 != null && (
                    <> — including <strong style={{ color: tp }}>{formatBig(timeline.scenario.u18)}</strong> children</>
                  )}
                </div>
                <div style={{ color: tm, fontSize: 9, marginTop: 6 }}>{timeline.scenario.source}</div>
              </div>
            )}

            {/* ── Where it is worst — click to fly there ────────────── */}
            {activeStats && (
              <>
                <SectionLabel color={tm}>
                  WORST {app.level === 'admin1' ? 'PROVINCES' : 'DISTRICTS'} · {(activeLens?.label ?? md.short).toUpperCase()}
                </SectionLabel>
                <div style={{ marginBottom: 6 }}>
                  {topN(activeStats, app.metric, 8, filterIds).map(({ id, data, value }, i) => {
                    const max = Math.max(...topN(activeStats, app.metric, 1, filterIds).map(x => x.value), 1);
                    const sel = id === app.selectedRegionId;
                    return (
                      <button key={id} onClick={() => app.selectRegion(id)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                          background: sel ? 'rgba(200,169,81,0.12)' : 'transparent',
                          border: `1px solid ${sel ? 'rgba(200,169,81,0.4)' : 'transparent'}`,
                          borderRadius: 7, cursor: 'pointer', marginBottom: 2,
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ color: sel ? '#c8a951' : ts, fontSize: 11.5, fontWeight: sel ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: tm, fontSize: 9.5, marginRight: 5 }}>{i + 1}</span>
                            {data.name}
                          </span>
                          <span style={{ color: tp, fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {formatBig(value)}
                          </span>
                        </div>
                        <div style={{ height: 3, borderRadius: 2, marginTop: 4, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                          <div style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: '100%', borderRadius: 2, background: activeLens?.color ?? '#c8a951' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p style={{ color: tm, fontSize: 9.5, marginBottom: 14 }}>Tap any row to zoom the map there.</p>
              </>
            )}

            {/* ── Children in this province ─────────────────────────── */}
            {regionLevel === 'admin1' && stats && (
              <ChildDistricts stats={stats} parentId={regionRow!.id} app={app}
                border={border} cardBg={cardBg} ts={ts} tm={tm} tp={tp} />
            )}

            {/* ── Everything technical, folded away ─────────────────── */}
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: `1px dashed ${border}`,
                color: tm, fontSize: 11, fontWeight: 600,
              }}>
              Detailed numbers &amp; export
              <ChevronDown size={11} style={{ marginLeft: 'auto', transform: showDetails ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
            </button>

            {showDetails && (
              <div style={{ marginTop: 10 }}>
                {region ? (
                  <>
                    <DetailCard title="EXPOSED POPULATION" color="#ef4444" icon={Users}>
                      <Row label="Total" value={formatInt(region.affected_pop_total)} isDark={isDark} />
                      <Row label="Density (/km²)" value={formatNumber(region.affected_pop_density)} isDark={isDark} />
                      <Row label="Children" value={formatInt(region.affected_child_pop_total)} isDark={isDark} />
                      <Row label="Children share" value={`${(region.child_share_pct ?? 0).toFixed(1)}%`} isDark={isDark} />
                    </DetailCard>
                    {typeof region.flood_extent_km2 === 'number' && (
                      <DetailCard title="OBSERVED FLOOD WATER" color="#38bdf8" icon={Waves}>
                        <Row label="Land under water" value={`${formatNumber(region.flood_extent_km2)} km²`} isDark={isDark} />
                        <Row label="Share of district" value={`${(region.flood_extent_pct ?? 0).toFixed(2)}%`} isDark={isDark} />
                      </DetailCard>
                    )}
                    <DetailCard title="SERVICES" color="#22c55e" icon={Hospital}>
                      <Row label="Health facilities" value={String(region.health_count)} isDark={isDark} />
                      <Row label="Schools" value={String(region.school_count)} isDark={isDark} />
                      <Row label="People per health facility" value={formatInt(region.affected_per_health_facility as number)} isDark={isDark} />
                      <Row label="Children per school" value={formatInt(region.affected_children_per_school as number)} isDark={isDark} />
                    </DetailCard>
                    <DetailCard title="GEOGRAPHY" color={ts} icon={Ruler}>
                      <Row label="Area" value={`${formatNumber(region.area_sqkm)} km²`} isDark={isDark} />
                      <Row label="Centroid" value={region.center_lat != null && region.center_lon != null ? `${region.center_lat.toFixed(3)}, ${region.center_lon.toFixed(3)}` : '–'} isDark={isDark} />
                      <Row label="ID" value={regionRow?.id ?? '–'} isDark={isDark} />
                    </DetailCard>
                  </>
                ) : (
                  <>
                    {event && (
                      <DetailCard title="AS PUBLISHED IN THE REPORT" color="#c8a951" icon={Waves}>
                        <Row label="Flood extent" value={`${formatInt(event.published.extent_km2 ?? 0)} km²`} isDark={isDark} />
                        <Row label="Median depth" value={`${event.published.depth_median_m ?? '–'} m`} isDark={isDark} />
                        <Row label="Deepest" value={`${event.published.depth_max_m ?? '–'} m`} isDark={isDark} />
                        <Row label="Roads affected" value={`${formatInt(event.published.roads_affected_km ?? 0)} km`} isDark={isDark} />
                        <Row label="Urban share" value={`${event.published.urban_pct ?? '–'}%`} isDark={isDark} />
                        <Row label="Rural share" value={`${event.published.rural_pct ?? '–'}%`} isDark={isDark} />
                        <Row label="Recomputed extent here" value={`${formatInt(event.measured.flood_extent_km2)} km²`} isDark={isDark} />
                      </DetailCard>
                    )}
                    {country && (
                      <DetailCard title="COUNTRY BASELINE (2025)" color="#a855f7" icon={MapPin}>
                        <Row label="Districts" value={formatInt(country.totals.district_count)} isDark={isDark} />
                        <Row label="Area" value={`${formatInt(country.totals.area_sqkm)} km²`} isDark={isDark} />
                        <Row label="In flood-prone land" value={formatInt(country.totals.affected_pop_total)} isDark={isDark} />
                        <Row label="Children in flood-prone land" value={formatInt(country.totals.affected_child_pop_total)} isDark={isDark} />
                      </DetailCard>
                    )}
                  </>
                )}

                {activeStats && (
                  <>
                    <SectionLabel color={tm}>DISTRIBUTION</SectionLabel>
                    <Histogram stats={activeStats} metric={app.metric} ids={filterIds} isDark={isDark} />
                    <button onClick={() => downloadCsv(statsToCsv(activeStats, visibleIds), `${app.countryCode}_${app.year}_${app.level}_${app.metric}.csv`)}
                      style={{ marginTop: 10, width: '100%', padding: '9px 0', borderRadius: 7, background: 'transparent', border: `1px solid ${border}`, color: ts, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Download size={11} /> Export {visibleIds.length} rows as CSV
                    </button>
                  </>
                )}

                {timeline && (
                  <p style={{ color: tm, fontSize: 9, marginTop: 12, lineHeight: 1.6 }}>
                    <strong style={{ color: ts }}>How the projection works.</strong>{' '}
                    {timeline.assumptions.note} Assumed growth in flood-exposed
                    population: {timeline.assumptions.exposure_growth_pct_per_year}% a year.
                    District-level population figures are apportioned from the published
                    national totals using measured flood extent; the flood extent itself,
                    and which districts it touches, are measured from satellite imagery.
                  </p>
                )}
              </div>
            )}
          </div>
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

// ─── Pieces ───────────────────────────────────────────────────────────────

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ color, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', marginBottom: 7 }}>
      {children}
    </div>
  );
}

function BigTile({ color, icon: Icon, label, value, suffix, active, onClick }: {
  color: string; icon: React.ElementType; label: string; value: string;
  suffix?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{
        textAlign: 'left', padding: '10px 11px', borderRadius: 10, cursor: 'pointer',
        background: active ? `${color}1c` : `${color}0d`,
        border: `1px solid ${active ? color : `${color}33`}`,
        transition: 'background .15s, border-color .15s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon size={11} style={{ color }} />
        <span style={{ color, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>
          {label.toUpperCase()}
        </span>
      </div>
      <div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 3, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {suffix && <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>{suffix}</span>}
      </div>
    </button>
  );
}

function DetailCard({ title, color, icon: Icon, children }: {
  title: string; color: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div style={{ padding: 12, borderRadius: 10, background: `${color}0d`, border: `1px solid ${color}33`, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontSize: 9.5, fontWeight: 700, marginBottom: 7, letterSpacing: '0.06em' }}>
        <Icon size={11} /> {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
      <span style={{ color: isDark ? '#aaa' : '#444', fontSize: 11 }}>{label}</span>
      <span style={{ color: isDark ? '#fff' : '#111', fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function ChildDistricts({ stats, parentId, app, border, cardBg, ts, tm, tp }: {
  stats: StatsTable; parentId: string;
  app: ReturnType<typeof useApp>;
  border: string; cardBg: string; ts: string; tm: string; tp: string;
}) {
  const kids = useMemo(() => Object.entries(stats)
    .filter(([, d]) => d.parent_id === parentId)
    .map(([id, d]) => ({ id, data: d }))
    .sort((a, b) => b.data.affected_pop_total - a.data.affected_pop_total), [stats, parentId]);
  if (kids.length === 0) return null;
  return (
    <div style={{ padding: 12, borderRadius: 10, background: cardBg, border: `1px solid ${border}`, marginBottom: 14 }}>
      <div style={{ color: ts, fontSize: 9.5, fontWeight: 700, marginBottom: 7, letterSpacing: '0.06em' }}>
        DISTRICTS IN THIS PROVINCE
      </div>
      {kids.slice(0, 5).map(({ id, data }) => (
        <button key={id} onClick={() => app.selectRegion(id)}
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '5px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
          <span style={{ color: ts, fontSize: 11 }}>{data.name}</span>
          <span style={{ color: tp, fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatBig(data.affected_pop_total)}
          </span>
        </button>
      ))}
      {kids.length > 5 && (
        <div style={{ color: tm, fontSize: 9, marginTop: 4, textAlign: 'center' }}>+ {kids.length - 5} more</div>
      )}
    </div>
  );
}

function Histogram({ stats, metric, ids, isDark }: {
  stats: StatsTable; metric: string; ids?: Set<string>; isDark: boolean;
}) {
  const data = useMemo(() => {
    const vals: number[] = [];
    for (const [id, d] of Object.entries(stats)) {
      if (ids && !ids.has(id)) continue;
      const v = d[metric] as number;
      if (typeof v === 'number' && isFinite(v) && v > 0) vals.push(v);
    }
    if (vals.length === 0) return [];
    vals.sort((a, b) => a - b);
    const min = vals[0], max = vals[vals.length - 1];
    const bins = 12;
    const w = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      bin: i, label: formatNumber(min + i * w), count: 0,
    }));
    for (const v of vals) buckets[Math.min(bins - 1, Math.floor((v - min) / w))].count++;
    return buckets;
  }, [stats, metric, ids]);

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 18, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 8, fill: isDark ? '#888' : '#666' }} interval={1} angle={-30} textAnchor="end" />
        <YAxis tick={{ fontSize: 8, fill: isDark ? '#888' : '#666' }} width={24} />
        <Tooltip contentStyle={{ fontSize: 11, background: isDark ? '#0f0f0f' : '#fff', border: `1px solid ${isDark ? '#2e2e2e' : '#e0e0e0'}`, borderRadius: 8 }} />
        <Bar dataKey="count" fill="#c8a951" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
