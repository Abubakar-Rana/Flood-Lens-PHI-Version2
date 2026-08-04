'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowLeft, ChevronDown, Info, Radio, Waves } from 'lucide-react';
import { useApp } from '@/lib/state';
import { loadAllTimelines, loadCountries, loadEvent, loadStats, loadYears } from '@/lib/data';
import {
  countryColor, lensColor, lensesForKind,
  type AllTimelines, type CountryInfo, type EventFacts, type LensDef,
  type StatsTable, type YearDef,
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
  const [allTimelines, setAllTimelines] = useState<AllTimelines | null>(null);
  const [event, setEvent] = useState<EventFacts | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const year = years.find(y => y.id === app.year) ?? null;

  useEffect(() => { loadYears().then(r => setYears(r.years)); }, []);
  // One request covers every country, so switching country never refetches
  // anything the chart already has.
  useEffect(() => { loadAllTimelines().then(setAllTimelines).catch(() => {}); }, []);

  useEffect(() => {
    loadCountries().then(idx =>
      setCountry(idx.countries.find(c => c.code === app.countryCode) ?? null));
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

  // The chart compares countries, so it always plots national figures — a
  // single district has no meaningful place on an axis shared with six
  // countries. The tiles above it stay scoped to the selected region.

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
            {/* Zooming into a district is the easiest state to get stuck in,
                so the way out is a solid filled button rather than a tinted
                chip — it has to read as the primary action while it exists. */}
            {scope?.isRegion && (
              <button
                onClick={() => { app.selectRegion(null); app.clearProvinces(); }}
                className="back-to-country"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 800,
                  background: '#c8a951', border: '1px solid #b8962f',
                  color: '#1a1200', cursor: 'pointer', letterSpacing: '0.01em',
                  boxShadow: '0 2px 8px rgba(200,169,81,0.4)',
                }}
              >
                <ArrowLeft size={13} /> Back to {country?.name ?? 'whole country'}
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
                const lc = lensColor(lens, isDark);
                return (
                  <button
                    key={lens.key}
                    onClick={() => app.setLens(lens.key)}
                    title={lens.question}
                    style={{
                      textAlign: 'left', padding: '9px 11px', borderRadius: 10,
                      cursor: 'pointer', minWidth: 0,
                      background: active ? `${lc}1f` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'),
                      border: `1px solid ${active ? lc : border}`,
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    <div style={{
                      color: active ? lc : tp,
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
                      color: active ? lc : tm, fontSize: 9.5, fontWeight: 700,
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
              all={allTimelines}
              metricKey={app.metric}
              activeCountry={app.countryCode}
              scrubYear={app.scrubYear}
              onScrub={app.setScrubYear}
              onPickCountry={app.setCountry}
              isDark={isDark}
            />
          </div>
        </div>
      )}

      <style>{`
        .timebar-body {
          display: grid;
          /* Tiles take only what they need; the chart absorbs the rest. */
          grid-template-columns: minmax(0, 0.85fr) minmax(420px, 1.15fr);
          gap: 14px;
          align-items: stretch;
        }
        /* Below this the two columns can no longer both breathe — stack them
           and let the chart keep its full height rather than squeezing it. */
        @media (max-width: 1180px) {
          .timebar-body { grid-template-columns: minmax(0, 1fr); }
          .timebar-chart { border-left: none !important; padding-left: 0 !important; }
        }
        .back-to-country { animation: back-pop .28s ease-out; }
        @keyframes back-pop {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        .back-to-country:hover { filter: brightness(1.08); }
        @media (prefers-reduced-motion: reduce) { .back-to-country { animation: none; } }
      `}</style>
    </div>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────────
// One measure, six countries, three years. The measure is whichever question
// the reader picked, so the plot never mixes units — every line on it counts
// the same thing.
//
// The y-axis is logarithmic, and that is not a stylistic choice: for people
// affected the countries span 127M (India) to 57K (Bhutan) — four orders of
// magnitude. On a linear axis the four smaller countries would lie flat on
// the baseline and read as zero. A log axis is the standard tool for
// comparing quantities of different magnitude, its ticks are still plain
// numbers (100, 10K, 1M), and it makes the thing worth comparing — the shape
// of each country's change — legible for all six at once. A second y-axis
// would have been the wrong fix: two arbitrary scales side by side invent
// relationships that aren't in the data.
//
// Each country keeps a fixed hue, so filtering or re-sorting never repaints
// a line the reader has already learned.

const LOG_TICKS = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];
/** Log scales cannot plot zero. Bhutan records 0 hospitals near flood water in
 *  2026, so plotted values are floored just under the first tick; the tooltip
 *  and labels always report the true figure. */
const LOG_FLOOR = 0.6;

function TrendChart({
  all, metricKey, activeCountry, scrubYear, onScrub, onPickCountry, isDark,
}: {
  all: AllTimelines | null;
  metricKey: string;
  activeCountry: string;
  scrubYear: number;
  onScrub: (y: number) => void;
  onPickCountry: (code: string) => void;
  isDark: boolean;
}) {
  const tp = isDark ? '#fff' : '#111';
  const tm = isDark ? '#666' : '#888';
  const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const surface = isDark ? '#111' : '#fff';

  const tracks = useMemo(() => (all?.countries ?? [])
    .filter(c => c.series[metricKey]?.length)
    .map(c => ({ code: c.code, name: c.name, color: countryColor(c.code, isDark),
                 points: c.series[metricKey] })),
    [all, metricKey, isDark]);

  // One row per year. Each country gets two keys so the measured stretch can
  // be drawn solid and the projected stretch dotted — Recharts applies one
  // dash pattern per <Line>, so the split has to happen in the data.
  const data = useMemo(() => {
    if (tracks.length === 0) return [];
    return (all?.years ?? [2025, 2026, 2027]).map(year => {
      const row: Record<string, number | null> = { year };
      for (const t of tracks) {
        const p = t.points.find(x => x.year === year);
        const raw = p ? p.value : null;
        const plotted = raw == null ? null : Math.max(raw, LOG_FLOOR);
        row[`${t.code}_raw`] = raw;
        row[`${t.code}_solid`] = year <= 2026 ? plotted : null;
        row[`${t.code}_dash`] = year >= 2026 ? plotted : null;
      }
      return row;
    });
  }, [tracks, all]);

  const domain = useMemo((): [number, number] => {
    let lo = Infinity, hi = 0;
    for (const row of data) {
      for (const t of tracks) {
        const v = row[`${t.code}_solid`] ?? row[`${t.code}_dash`];
        if (typeof v === 'number' && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
    }
    if (!isFinite(lo) || hi <= 0) return [1, 100];
    // Snap out to whole decades so the gridlines land on round numbers.
    return [Math.max(LOG_FLOOR, 10 ** Math.floor(Math.log10(lo))),
            10 ** Math.ceil(Math.log10(hi))];
  }, [data, tracks]);

  if (!all) {
    return <div style={{ color: tm, fontSize: 10, padding: 8 }}>Loading timeline…</div>;
  }
  if (tracks.length === 0) {
    return (
      <div style={{ color: tm, fontSize: 10.5, padding: '18px 8px', lineHeight: 1.6 }}>
        <strong style={{ color: tp }}>Land flooded</strong> is only measured during an observed
        flood, so there is no 2025 figure to compare against. Pick{' '}
        <strong style={{ color: tp }}>People</strong>, <strong style={{ color: tp }}>Children</strong>,{' '}
        <strong style={{ color: tp }}>Hospitals</strong> or <strong style={{ color: tp }}>Schools</strong>{' '}
        to see all six countries over time.
      </div>
    );
  }

  const title = all.labels[metricKey] ?? 'Flood impact';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 210 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
        <span style={{ color: tp, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em' }}>
          {title.toUpperCase()} — ALL COUNTRIES
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          color: isDark ? '#22c55e' : '#15803d', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em',
        }}>
          <Radio size={9} className="pulse-dot" /> LIVE · 2026
        </span>
        <span style={{ marginLeft: 'auto', color: tm, fontSize: 9 }}>
          compressed (log) scale so all six fit
        </span>
      </div>

      {/* Legend doubles as the country picker — identity is never colour
          alone, every line is named, and clicking one loads that country. */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
        {tracks.map(t => {
          const on = activeCountry === t.code;
          return (
            <button
              key={t.code}
              onClick={() => onPickCountry(t.code)}
              title={`Show ${t.name} on the map`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
                background: on ? `${t.color}22` : 'transparent',
                border: `1px solid ${on ? t.color : 'transparent'}`,
                color: on ? t.color : tm, fontSize: 9.5, fontWeight: on ? 800 : 600,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.color }} />
              {t.name}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 16, bottom: 2, left: -4 }}
            onClick={(e: { activeLabel?: string | number }) => {
              const y = Number(e?.activeLabel);
              if (isFinite(y)) onScrub(y);
            }}
            style={{ cursor: 'pointer' }}
          >
            <ReferenceLine
              x={2026} stroke={tm} strokeWidth={1} strokeOpacity={0.35}
              strokeDasharray="3 3"
            />
            {scrubYear >= 2025 && scrubYear <= 2027 && (
              <ReferenceLine x={scrubYear} stroke={tp} strokeWidth={1} strokeOpacity={0.18} />
            )}

            {tracks.map((t, i) => {
              const on = activeCountry === t.code;
              const w = on ? 3.2 : 1.8;
              const fade = on ? 1 : 0.5;
              return [
                // Measured stretch — solid.
                <Line
                  key={`${t.code}-s`} type="monotone"
                  dataKey={`${t.code}_solid`} stroke={t.color}
                  strokeWidth={w} strokeOpacity={fade} connectNulls={false}
                  dot={(props: DotProps) => (
                    <TrendDot {...props} color={t.color} surface={surface}
                      active={on} opacity={fade} />
                  )}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: surface }}
                  isAnimationActive animationDuration={900} animationBegin={i * 110}
                  name={t.name}
                />,
                // Projected stretch — dotted, so a reader can tell at a glance
                // where measurement stops and modelling starts.
                <Line
                  key={`${t.code}-d`} type="monotone"
                  dataKey={`${t.code}_dash`} stroke={t.color}
                  strokeWidth={w} strokeOpacity={fade * 0.9}
                  strokeDasharray="2 5" strokeLinecap="round" connectNulls={false}
                  dot={{ r: on ? 4 : 3, fill: surface, stroke: t.color, strokeWidth: 2, strokeOpacity: fade }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: surface }}
                  isAnimationActive animationDuration={900} animationBegin={420 + i * 110}
                  legendType="none" name={`${t.name} (2027 projected)`}
                />,
              ];
            })}

            <XAxis
              dataKey="year" tick={{ fontSize: 11, fill: tm, fontWeight: 700 }}
              axisLine={{ stroke: grid }} tickLine={false} interval={0}
              type="number" domain={[2024.85, 2027.15]} ticks={[2025, 2026, 2027]}
            />
            <YAxis
              scale="log" domain={domain} ticks={LOG_TICKS} allowDataOverflow
              tick={{ fontSize: 9, fill: tm }} width={42}
              axisLine={false} tickLine={false} tickFormatter={compactTick}
            />
            <Tooltip
              cursor={{ stroke: tm, strokeWidth: 1, strokeOpacity: 0.4 }}
              contentStyle={{
                fontSize: 11.5, background: surface, border: `1px solid ${grid}`,
                borderRadius: 8,
              }}
              labelStyle={{ color: tp, fontWeight: 800 }}
              labelFormatter={((y: number) =>
                y === 2027 ? '2027 · projected' : `${y} · measured`) as never}
              formatter={((v: unknown, name: unknown, entry: { payload?: Record<string, number | null> }) => {
                const key = String(name ?? '');
                // Report the true figure, not the log-floored plotting value.
                const track = tracks.find(t => t.name === key);
                const raw = track ? entry?.payload?.[`${track.code}_raw`] : null;
                const n = raw ?? Number(v);
                return typeof n === 'number' && isFinite(n) ? [formatInt(n), key] : [null, null];
              }) as never}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        color: tm, fontSize: 9, marginTop: 2,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 0, borderTop: `2px solid ${tm}` }} />
          measured
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 14, height: 0, borderTop: `2px dotted ${tm}` }} />
          2027 projected
        </span>
        <span style={{ marginLeft: 'auto' }}>Click a country to load it · click a year to map it</span>
      </div>

      <style>{`
        .pulse-dot { animation: pulse-fade 1.8s ease-in-out infinite; }
        @keyframes pulse-fade { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        /* The latest measured year keeps a slow halo so the chart reads as a
           live instrument rather than a static export. */
        .live-halo { animation: live-halo 2s ease-out infinite; transform-origin: center; }
        @keyframes live-halo {
          0%   { r: 5;  opacity: 0.55; }
          70%  { r: 13; opacity: 0; }
          100% { r: 13; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot, .live-halo { animation: none; }
        }
      `}</style>
      <span className="sr-only">
        {title} for 2025, 2026 and projected 2027:{' '}
        {tracks.map(t => `${t.name} ${t.points
          .map(p => `${p.year} ${Math.round(p.value)}`).join(', ')}`).join('; ')}.
      </span>
    </div>
  );
}

interface DotProps {
  cx?: number; cy?: number; payload?: { year?: number };
}

/** Point marker. The 2026 point gets an expanding halo — that is the newest
 *  measurement, and the pulse is what makes the panel read as live. */
function TrendDot({ cx, cy, payload, color, surface, active, opacity }:
  DotProps & { color: string; surface: string; active: boolean; opacity: number }) {
  if (cx == null || cy == null) return <g />;
  const isLatest = payload?.year === 2026;
  const r = active ? 5 : 4;
  return (
    <g opacity={opacity}>
      {isLatest && <circle className="live-halo" cx={cx} cy={cy} r={5} fill={color} />}
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={surface} strokeWidth={2} />
    </g>
  );
}
