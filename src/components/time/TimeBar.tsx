'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area, ComposedChart, LabelList, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChevronDown, Info, Radio, Waves } from 'lucide-react';
import { useApp } from '@/lib/state';
import { loadCountries, loadEvent, loadStats, loadTimeline, loadYears } from '@/lib/data';
import {
  lensesForKind, type CountryInfo, type EventFacts, type LensDef,
  type StatsTable, type Timeline, type YearDef,
} from '@/lib/types';
import { formatBig, formatInt, statsForLevel } from '@/lib/utils';

/** Axis-tick form: always short enough to fit a narrow gutter. */
function compactTick(v: number): string {
  if (!isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(Math.round(v));
}

/** Sum one field across every district in the table. */
function total(stats: StatsTable | null, key: string): number {
  if (!stats) return 0;
  let n = 0;
  for (const d of Object.values(stats)) {
    const v = d[key];
    if (typeof v === 'number' && isFinite(v)) n += v;
  }
  return n;
}

export default function TimeBar({ isDark }: { isDark: boolean }) {
  const app = useApp();
  const [years, setYears] = useState<YearDef[]>([]);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [stats, setStats] = useState<StatsTable | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [event, setEvent] = useState<EventFacts | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const year = years.find(y => y.id === app.year) ?? null;

  useEffect(() => { loadYears().then(r => setYears(r.years)); }, []);

  useEffect(() => {
    loadCountries().then(idx =>
      setCountry(idx.countries.find(c => c.code === app.countryCode) ?? null));
    loadTimeline(app.countryCode).then(setTimeline).catch(() => setTimeline(null));
  }, [app.countryCode]);

  useEffect(() => {
    if (!year) return;
    let alive = true;
    loadStats(app.countryCode, year).then(s => alive && setStats(s));
    loadEvent(app.countryCode, year)
      .then(e => alive && setEvent(e))
      .catch(() => alive && setEvent(null));
    return () => { alive = false; };
  }, [app.countryCode, year]);

  // Tiles and chart describe whatever the map is showing — the whole country,
  // or the one region the user clicked. That link is the point of the bar:
  // pick a place on the map, the numbers and the timeline follow it.
  const scope = useMemo(() => {
    if (!stats) return null;
    const id = app.selectedRegionId;
    if (id) {
      if (stats[id]) return { name: stats[id].name, row: stats[id], isRegion: true };
      const prov = statsForLevel(stats, 'admin1');
      if (prov[id]) return { name: prov[id].name, row: prov[id], isRegion: true };
    }
    return { name: country?.name ?? '', row: null, isRegion: false };
  }, [stats, app.selectedRegionId, country]);

  const lenses = useMemo(() => lensesForKind(year?.kind ?? 'event'), [year]);

  const valueFor = (lens: LensDef): number => {
    const key = lens.metric as string;
    if (scope?.row) {
      const v = scope.row[key];
      return typeof v === 'number' ? v : 0;
    }
    return total(stats, key);
  };

  // A selected region carries its share of the national series, so the chart
  // reads for that place rather than snapping back to the country.
  const regionShare = useMemo(() => {
    if (!scope?.row || !stats) return 1;
    const key = app.metric as string;
    const nat = total(stats, key);
    const own = (scope.row[key] as number) ?? 0;
    return nat > 0 ? own / nat : 0;
  }, [scope, stats, app.metric]);

  const bg = isDark ? '#111' : '#fff';
  const border = isDark ? '#2e2e2e' : '#d6e0eb';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';

  return (
    <div style={{
      flexShrink: 0, background: bg, borderBottom: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Title row: place, event window, year track ───────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
        borderBottom: collapsed ? 'none' : `1px solid ${border}`, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: tp, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {scope?.name || '—'}
            </span>
            {scope?.isRegion && (
              <button
                onClick={() => app.selectRegion(null)}
                style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  background: 'rgba(200,169,81,0.16)', border: '1px solid rgba(200,169,81,0.4)',
                  color: isDark ? '#c8a951' : '#8a6914', cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                BACK TO WHOLE COUNTRY
              </button>
            )}
          </div>
          <div style={{ color: tm, fontSize: 10.5, marginTop: 1 }}>
            {year?.headline}
            {year?.window && ` · ${year.window.start} to ${year.window.end}`}
          </div>
        </div>

        {/* Year track — the one control that changes what "affected" means */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {years.map(y => {
            const active = y.id === app.year;
            return (
              <button
                key={y.id}
                onClick={() => app.setYear(y.id)}
                title={y.blurb}
                style={{
                  padding: '6px 13px', borderRadius: 8, fontSize: 11.5,
                  fontWeight: active ? 800 : 600, cursor: 'pointer',
                  background: active ? '#c8a951' : 'transparent',
                  color: active ? '#1a1200' : ts,
                  border: `1px solid ${active ? '#c8a951' : border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {y.label}
              </button>
            );
          })}
        </div>

        {year?.kind === 'event' && (
          <button
            onClick={app.toggleExtent}
            title="Show the satellite flood extent on the map"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              padding: '6px 11px', borderRadius: 8, fontSize: 10.5, fontWeight: 700,
              cursor: 'pointer',
              background: app.showExtent ? 'rgba(56,189,248,0.16)' : 'transparent',
              color: app.showExtent ? (isDark ? '#38bdf8' : '#0369a1') : ts,
              border: `1px solid ${app.showExtent ? '#38bdf8' : border}`,
            }}
          >
            <Waves size={12} /> Flood water
          </button>
        )}

        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Show numbers' : 'Hide numbers'}
          style={{
            flexShrink: 0, padding: 6, borderRadius: 7, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${border}`, color: tm,
            display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronDown size={12} style={{
            transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s',
          }} />
        </button>
      </div>

      {!collapsed && (
        <div className="timebar-body" style={{ padding: '10px 14px 12px' }}>
          {/* ── Headline numbers. Each tile is also the map's colour control ── */}
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: 'grid', gap: 8,
              gridTemplateColumns: `repeat(auto-fit, minmax(112px, 1fr))`,
            }}>
              {lenses.map(lens => {
                const active = app.lens === lens.key;
                const v = valueFor(lens);
                return (
                  <button
                    key={lens.key}
                    onClick={() => app.setLens(lens.key)}
                    title={lens.question}
                    style={{
                      textAlign: 'left', padding: '9px 11px', borderRadius: 10,
                      cursor: 'pointer', minWidth: 0,
                      background: active ? `${lens.color}1f` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'),
                      border: `1px solid ${active ? lens.color : border}`,
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    <div style={{
                      color: active ? lens.color : tp,
                      fontSize: 27, fontWeight: 800, lineHeight: 1.05,
                      letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {formatBig(v)}
                      {lens.key === 'water' && (
                        <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 3 }}>km²</span>
                      )}
                    </div>
                    <div style={{
                      color: active ? lens.color : tm, fontSize: 9.5, fontWeight: 700,
                      letterSpacing: '0.05em', marginTop: 3, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {lens.label.toUpperCase()}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginTop: 7,
              color: tm, fontSize: 9.5, flexWrap: 'wrap',
            }}>
              <Info size={10} />
              Tap any number to colour the map by it.
              {year?.kind === 'event' && event && (
                <span>
                  · {event.measured.districts_flooded} of {event.measured.districts_total} districts
                  saw flooding · hospitals &amp; schools counted within{' '}
                  {event.measured.proximity_radius_km} km of flood water
                </span>
              )}
            </div>
          </div>

          {/* ── The timeline. Clicking a year repaints the map. ───────────── */}
          <div className="timebar-chart" style={{ borderLeft: `1px solid ${border}`, paddingLeft: 14, minWidth: 0 }}>
            <TrendChart
              timeline={timeline}
              metricKey={app.metric}
              share={regionShare}
              scrubYear={app.scrubYear}
              onScrub={app.setScrubYear}
              isDark={isDark}
              scopeName={scope?.name ?? ''}
              accent={app.lens ? lenses.find(l => l.key === app.lens)?.color ?? '#c8a951' : '#c8a951'}
            />
          </div>
        </div>
      )}

      <style>{`
        .timebar-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 42%);
          gap: 14px;
          align-items: stretch;
        }
        /* Below this the two columns can no longer both breathe — stack them
           and let the chart keep its full height rather than squeezing it. */
        @media (max-width: 1180px) {
          .timebar-body { grid-template-columns: minmax(0, 1fr); }
          .timebar-chart { border-left: none !important; padding-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────────
// One measure, one axis, three years. Both observed years carry the SAME
// field (whichever the reader picked), which is why only fields present in
// both stats tables get a series — "land flooded" has no 2025 counterpart and
// is excluded upstream in the ETL.
//
// The two observed years differ by 5x (Bangladesh) to 269x (Nepal), so every
// point is direct-labelled: on a linear axis the smaller year would otherwise
// sit on the baseline and read as zero. The 1-in-100-year figure stays off
// this axis — at ~24x the projection it would flatten everything else — and
// is called out as its own scenario card in the right panel.

function TrendChart({
  timeline, metricKey, share, scrubYear, onScrub, isDark, scopeName, accent,
}: {
  timeline: Timeline | null;
  metricKey: string;
  share: number;
  scrubYear: number;
  onScrub: (y: number) => void;
  isDark: boolean;
  scopeName: string;
  accent: string;
}) {
  const tp = isDark ? '#fff' : '#111';
  const tm = isDark ? '#666' : '#888';
  const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const surface = isDark ? '#111' : '#fff';

  const series = timeline?.metrics?.[metricKey] ?? null;

  const data = useMemo(() => {
    if (!series) return [];
    return series.points.map(p => ({
      year: p.year,
      value: p.value * share,
      observed: p.kind === 'observed' ? p.value * share : null,
      band: p.kind === 'projected' && p.low != null && p.high != null
        ? [p.low * share, p.high * share] as [number, number]
        : null,
      kind: p.kind,
    }));
  }, [series, share]);

  if (!timeline) {
    return <div style={{ color: tm, fontSize: 10, padding: 8 }}>Loading timeline…</div>;
  }
  if (!series || data.length === 0) {
    return (
      <div style={{ color: tm, fontSize: 10.5, padding: '18px 8px', lineHeight: 1.6 }}>
        No year-on-year series for this measure — <strong style={{ color: tp }}>land flooded</strong>{' '}
        is only measured during an observed flood, so there is no 2025 figure to compare against.
        Pick <strong style={{ color: tp }}>People</strong> or <strong style={{ color: tp }}>Children</strong>{' '}
        to see the trend.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 172 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
        <span style={{ color: tp, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em' }}>
          {series.label.toUpperCase()} — YEAR BY YEAR
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          color: '#16a34a', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em',
        }}>
          <Radio size={9} className="pulse-dot" /> LIVE
        </span>
        <span style={{ marginLeft: 'auto', color: tm, fontSize: 9.5 }}>
          {scrubYear >= 2027 ? 'projected' : 'observed'} · {scrubYear}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 22, bottom: 2, left: -6 }}
            onClick={(e: { activeLabel?: string | number }) => {
              const y = Number(e?.activeLabel);
              if (isFinite(y)) onScrub(y);
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Plausible range for the projected year. */}
            <Area
              dataKey="band" stroke="none" fill={accent} fillOpacity={0.16}
              isAnimationActive animationDuration={600} connectNulls
            />
            {/* Full series. Solid through the observed years; the reference
                line below marks where measurement stops and modelling starts. */}
            <Line
              dataKey="value" stroke={accent} strokeWidth={2.5}
              dot={{ r: 5, fill: accent, stroke: surface, strokeWidth: 2 }}
              activeDot={{ r: 7 }}
              isAnimationActive animationDuration={800} name="Affected"
            >
              <LabelList
                dataKey="value" position="top" offset={10}
                formatter={((v: number) => compactTick(v)) as never}
                style={{ fill: tp, fontSize: 11, fontWeight: 800 }}
              />
            </Line>
            <ReferenceLine
              x={2026.5} stroke={tm} strokeWidth={1} strokeOpacity={0.45}
              label={{ value: 'projected →', position: 'insideTopRight',
                       fill: tm, fontSize: 9 }}
            />
            {scrubYear >= 2025 && scrubYear <= 2027 && (
              <ReferenceLine x={scrubYear} stroke={accent} strokeWidth={1} strokeOpacity={0.4} />
            )}
            <XAxis
              dataKey="year" tick={{ fontSize: 11, fill: tm, fontWeight: 600 }}
              axisLine={{ stroke: grid }} tickLine={false} interval={0}
              type="number" domain={[2024.7, 2027.3]} ticks={[2025, 2026, 2027]}
            />
            <YAxis
              tick={{ fontSize: 9, fill: tm }} width={44}
              axisLine={false} tickLine={false}
              tickFormatter={compactTick}
            />
            <Tooltip
              cursor={{ stroke: accent, strokeWidth: 1, strokeOpacity: 0.35 }}
              contentStyle={{
                fontSize: 11.5, background: surface, border: `1px solid ${grid}`,
                borderRadius: 8,
              }}
              labelStyle={{ color: tp, fontWeight: 700 }}
              formatter={((v: unknown, name: unknown) => {
                if (Array.isArray(v)) {
                  return [`${formatInt(v[0] as number)} – ${formatInt(v[1] as number)}`, 'Likely range'];
                }
                const n = Number(v);
                if (!isFinite(n)) return [null, null];
                return [formatInt(n), String(name)];
              }) as never}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        color: tm, fontSize: 9, marginTop: 3,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent }} />
          Measured (2025, 2026)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 9, borderRadius: 2, background: accent, opacity: 0.3 }} />
          2027 expected, likely range
        </span>
        <span style={{ marginLeft: 'auto' }}>Click a year to map it</span>
      </div>

      <style>{`
        .pulse-dot { animation: pulse-fade 1.8s ease-in-out infinite; }
        @keyframes pulse-fade { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
      `}</style>
      <span className="sr-only">
        {series.label} in {scopeName}: {data.map(d => `${d.year} ${Math.round(d.value)}`).join(', ')}.
      </span>
    </div>
  );
}
