'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area, ComposedChart, Line, ReferenceDot, ReferenceLine,
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

/** Axis-tick form: always short enough to fit a 40px gutter. */
function compactTick(v: number): string {
  if (!isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
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

  const lenses = useMemo(
    () => lensesForKind(year?.kind ?? 'event'), [year]);

  const valueFor = (lens: LensDef): number => {
    const key = lens.metric as string;
    if (scope?.row) {
      const v = scope.row[key];
      return typeof v === 'number' ? v : 0;
    }
    return total(stats, key);
  };

  // A selected region carries its share of the national timeline, so the
  // projection reads for that place rather than resetting to the country.
  const regionShare = useMemo(() => {
    if (!scope?.row || !stats) return 1;
    const nat = total(stats, 'affected_pop_total');
    const own = (scope.row.affected_pop_total as number) ?? 0;
    return nat > 0 ? own / nat : 0;
  }, [scope, stats]);

  const bg = isDark ? 'rgba(17,17,17,0.93)' : 'rgba(255,255,255,0.95)';
  const border = isDark ? '#2e2e2e' : '#d6e0eb';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';

  return (
    <div
      className="absolute top-3 left-3 right-3 z-[1000]"
      style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 14,
        backdropFilter: 'blur(14px)',
        boxShadow: isDark ? '0 6px 28px rgba(0,0,0,0.45)' : '0 6px 24px rgba(20,40,70,0.12)',
        overflow: 'hidden',
      }}
    >
      {/* ── Title row: place, event window, year track ───────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
        borderBottom: collapsed ? 'none' : `1px solid ${border}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: tp, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {scope?.name || '—'}
            </span>
            {scope?.isRegion && (
              <button
                onClick={() => app.selectRegion(null)}
                style={{
                  padding: '1px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                  background: 'rgba(200,169,81,0.16)', border: '1px solid rgba(200,169,81,0.4)',
                  color: '#c8a951', cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                SHOWING THIS AREA · BACK TO WHOLE COUNTRY
              </button>
            )}
          </div>
          <div style={{ color: tm, fontSize: 10, marginTop: 1 }}>
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
                  padding: '5px 12px', borderRadius: 8, fontSize: 11,
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
              padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
              cursor: 'pointer',
              background: app.showExtent ? 'rgba(56,189,248,0.16)' : 'transparent',
              color: app.showExtent ? '#38bdf8' : ts,
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
            flexShrink: 0, padding: 5, borderRadius: 7, cursor: 'pointer',
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
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, padding: '10px 12px' }}>
          {/* ── Headline numbers. Each tile is also the map's colour control ── */}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{
              display: 'grid', gap: 7,
              gridTemplateColumns: `repeat(${lenses.length}, minmax(0, 1fr))`,
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
                      textAlign: 'left', padding: '8px 10px', borderRadius: 10,
                      cursor: 'pointer', minWidth: 0,
                      background: active ? `${lens.color}1f` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)'),
                      border: `1px solid ${active ? lens.color : border}`,
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    <div style={{
                      color: active ? lens.color : tp,
                      fontSize: 26, fontWeight: 800, lineHeight: 1.05,
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
              display: 'flex', alignItems: 'center', gap: 5, marginTop: 6,
              color: tm, fontSize: 9.5,
            }}>
              <Info size={10} />
              Tap any number to colour the map by it.
              {year?.kind === 'event' && event && (
                <span style={{ marginLeft: 'auto' }}>
                  {event.measured.districts_flooded} of {event.measured.districts_total} districts
                  saw flooding · hospitals &amp; schools counted within{' '}
                  {event.measured.proximity_radius_km} km of flood water
                </span>
              )}
            </div>
          </div>

          {/* ── The timeline. Clicking a year repaints the map. ───────────── */}
          <div style={{
            flex: '0 0 400px', minWidth: 300, borderLeft: `1px solid ${border}`,
            paddingLeft: 12,
          }}>
            <TrendChart
              timeline={timeline}
              share={regionShare}
              scrubYear={app.scrubYear}
              onScrub={app.setScrubYear}
              isDark={isDark}
              scopeName={scope?.name ?? ''}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────────
// One measure, one axis: people affected by flooding. Three things sit on it —
// the July 2026 flood as it was observed, the expected-per-year risk curve
// projected forward, and the uncertainty band around that curve. The 2025
// baseline is deliberately absent: it counts everyone living in a flood-prone
// zone (33.9M for Pakistan), which is a standing condition rather than an
// occurrence, and putting it here would read as a 99% crash. It has its own
// tile row instead. The 1-in-100-year figure is likewise kept off this axis —
// at ~24x the projection it would flatten the curve to a straight line — and
// is called out as a separate scenario number.

function TrendChart({
  timeline, share, scrubYear, onScrub, isDark, scopeName,
}: {
  timeline: Timeline | null;
  share: number;
  scrubYear: number;
  onScrub: (y: number) => void;
  isDark: boolean;
  scopeName: string;
}) {
  const tp = isDark ? '#fff' : '#111';
  const tm = isDark ? '#666' : '#888';
  const grid = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const surface = isDark ? '#111' : '#fff';

  const data = useMemo(() => {
    if (!timeline) return [];
    const obs = timeline.observed.find(o => o.track === 'event');
    if (!obs) return [];
    const rows = [{
      year: obs.year,
      observed: obs.value * share,
      central: timeline.expected_annual * share,
      band: [timeline.expected_annual * share, timeline.expected_annual * share] as [number, number],
    }];
    for (const p of timeline.projected) {
      rows.push({
        year: p.year,
        observed: NaN,
        central: p.central * share,
        band: [p.low * share, p.high * share] as [number, number],
      });
    }
    return rows;
  }, [timeline, share]);

  if (!timeline || data.length === 0) {
    return <div style={{ color: tm, fontSize: 10, padding: 8 }}>Loading timeline…</div>;
  }

  const observedYear = data[0].year;
  const active = data.find(d => d.year === scrubYear) ?? data[0];
  const isProjected = scrubYear > observedYear;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ color: tp, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>
          PEOPLE AFFECTED PER YEAR
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          color: '#22c55e', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em',
        }}>
          <Radio size={9} className="pulse-dot" /> LIVE
        </span>
        <span style={{ marginLeft: 'auto', color: tm, fontSize: 9 }}>
          {isProjected ? 'projected' : 'observed'} · {scrubYear}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 84 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 10, bottom: 0, left: -14 }}
            onClick={(e: { activeLabel?: string | number }) => {
              const y = Number(e?.activeLabel);
              if (isFinite(y)) onScrub(y);
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Uncertainty band — half to double the assumed growth rate. */}
            <Area
              dataKey="band" stroke="none" fill="#c8a951" fillOpacity={0.14}
              isAnimationActive animationDuration={700} legendType="none"
            />
            {/* Expected people affected per year. Dashed = modelled, not seen. */}
            <Line
              dataKey="central" stroke="#c8a951" strokeWidth={2}
              strokeDasharray="5 4" dot={false} isAnimationActive
              animationDuration={900} name="Expected per year"
            />
            {/* The one point that actually happened. */}
            <Line
              dataKey="observed" stroke="#c8a951" strokeWidth={2}
              dot={{ r: 5, fill: '#c8a951', stroke: surface, strokeWidth: 2 }}
              isAnimationActive animationDuration={500} name="Observed flood"
              connectNulls={false}
            />
            <ReferenceLine
              x={scrubYear} stroke="#c8a951" strokeWidth={1} strokeOpacity={0.5}
            />
            <ReferenceDot
              x={active.year} y={active.central} r={4}
              fill="#c8a951" stroke={surface} strokeWidth={2}
            />
            <XAxis
              dataKey="year" tick={{ fontSize: 9, fill: tm }}
              axisLine={{ stroke: grid }} tickLine={false} interval={0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: tm }} width={40}
              axisLine={false} tickLine={false}
              // Axis ticks get the abbreviated form; grouped digits at this
              // size clip to something that reads as a different number.
              // The tooltip carries the exact value.
              tickFormatter={compactTick}
            />
            <Tooltip
              cursor={{ stroke: '#c8a951', strokeWidth: 1, strokeOpacity: 0.35 }}
              contentStyle={{
                fontSize: 11, background: surface, border: `1px solid ${grid}`,
                borderRadius: 8,
              }}
              labelStyle={{ color: tp, fontWeight: 700 }}
              formatter={((v: unknown, name: unknown) => {
                if (Array.isArray(v)) {
                  return [`${formatInt(v[0] as number)} – ${formatInt(v[1] as number)}`, 'Range'];
                }
                const n = Number(v);
                return isFinite(n) ? [formatInt(n), String(name)] : [null, null];
              }) as never}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — identity is never colour alone, so the dash pattern is
          named in words as well as drawn. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        color: tm, fontSize: 8.5, marginTop: 2,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#c8a951' }} />
          What happened ({observedYear})
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 14, height: 0, borderTop: '2px dashed #c8a951', display: 'inline-block',
          }} />
          Expected per year (modelled)
        </span>
        <span style={{ marginLeft: 'auto', color: tm }}>
          Click a year to map it
        </span>
      </div>

      <style>{`
        .pulse-dot { animation: pulse-fade 1.8s ease-in-out infinite; }
        @keyframes pulse-fade { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
      `}</style>
      <span className="sr-only">
        Expected people affected per year in {scopeName}, {observedYear} to{' '}
        {data[data.length - 1].year}.
      </span>
    </div>
  );
}
