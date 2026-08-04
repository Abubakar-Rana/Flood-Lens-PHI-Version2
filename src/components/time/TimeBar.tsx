'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, BarChart3, CalendarRange, ChevronDown, Radio, TrendingUp, Waves } from 'lucide-react';
import { useApp } from '@/lib/state';
import { loadAllTimelines, loadCountries, loadEvent, loadYears } from '@/lib/data';
import type { AllTimelines, CountryInfo, EventFacts, MetricKey, YearDef } from '@/lib/types';

// Charting is client-only and the heaviest thing on the page — keep it out of
// the first paint so the map and numbers arrive first.
const SeasonChart = dynamic(() => import('./SeasonChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const TrendChart = dynamic(() => import('./TrendChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const DamageBars = dynamic(() => import('./DamageBars'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

function ChartSkeleton() {
  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 170, borderRadius: 10,
      background: 'linear-gradient(90deg, rgba(128,128,128,0.06), rgba(128,128,128,0.12), rgba(128,128,128,0.06))',
      backgroundSize: '200% 100%', animation: 'tb-shimmer 1.4s infinite',
    }} />
  );
}

type ChartMode = 'season' | 'trend' | 'damage';

export default function TimeBar({ isDark }: { isDark: boolean }) {
  const app = useApp();
  const [years, setYears] = useState<YearDef[]>([]);
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [all, setAll] = useState<AllTimelines | null>(null);
  const [event, setEvent] = useState<EventFacts | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // Year-on-year is the landing view: it answers "is this getting worse?"
  // without the reader choosing anything first. The monthly and comparison
  // views are one click away.
  const [mode, setMode] = useState<ChartMode>('trend');

  const year = years.find(y => y.id === app.year) ?? null;

  useEffect(() => { loadYears().then(r => setYears(r.years)).catch(() => {}); }, []);
  // One request covers every country and both views, so switching country or
  // chart mode never refetches anything already in memory.
  useEffect(() => { loadAllTimelines().then(setAll).catch(() => {}); }, []);

  useEffect(() => {
    loadCountries().then(idx =>
      setCountry(idx.countries.find(c => c.code === app.countryCode) ?? null));
  }, [app.countryCode]);

  useEffect(() => {
    if (!year) return;
    let alive = true;
    loadEvent(app.countryCode, year)
      .then(e => alive && setEvent(e))
      .catch(() => alive && setEvent(null));
    return () => { alive = false; };
  }, [app.countryCode, year]);

  const monthly = all?.monthly?.[app.year] ?? null;
  const zoomedIn = app.selectedRegionId != null || app.provinceFilter.size > 0;

  const bg = isDark ? '#111' : '#fff';
  const border = isDark ? '#2e2e2e' : '#d6e0eb';
  const tp = isDark ? '#fff' : '#111';
  const ts = isDark ? '#aaa' : '#444';
  const tm = isDark ? '#666' : '#888';

  const caption = useMemo(() => {
    if (mode === 'trend') {
      return 'Year on year, all six countries. Dotted = 2027 projected.';
    }
    if (mode === 'damage') {
      return ('Each panel has its own scale — people run to millions while hospitals '
        + 'run to hundreds, so one shared axis would flatten three of the four to nothing. '
        + 'Compare bars within a panel; compare shapes across panels. Hollow bar = 2027 projected.');
    }
    return monthly?.note ?? '';
  }, [mode, monthly]);

  return (
    <div style={{
      flexShrink: 0, background: bg, borderBottom: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Title row ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
        borderBottom: collapsed ? 'none' : `1px solid ${border}`, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: tp, fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {country?.name ?? '—'}
          </span>
          {/* Zooming into a district is the easiest state to get stuck in, so
              the way out is a solid filled button — it has to read as the
              primary action for as long as it exists. */}
          {zoomedIn && (
            <button
              onClick={() => { app.selectRegion(null); app.clearProvinces(); }}
              className="back-to-country"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 13px', borderRadius: 8, fontSize: 11.5, fontWeight: 800,
                background: '#c8a951', border: '1px solid #b8962f',
                color: '#1a1200', cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(200,169,81,0.45)',
              }}
            >
              <ArrowLeft size={13} /> Back to whole country
            </button>
          )}
          <span style={{ color: tm, fontSize: 10.5 }}>
            {year?.headline}
            {year?.window && ` · ${year.window.start} to ${year.window.end}`}
          </span>
        </div>

        {/* What the chart shows */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0, padding: 2, borderRadius: 9, border: `1px solid ${border}` }}>
          {([
            { k: 'season' as ChartMode, label: 'Monthly Series', icon: CalendarRange },
            { k: 'trend' as ChartMode, label: 'Year Series', icon: TrendingUp },
            { k: 'damage' as ChartMode, label: 'Comparison Chart', icon: BarChart3 },
          ]).map(o => {
            const on = mode === o.k;
            const Icon = o.icon;
            return (
              <button
                key={o.k}
                onClick={() => setMode(o.k)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 7, fontSize: 10.5,
                  fontWeight: on ? 800 : 600, cursor: 'pointer',
                  background: on ? (isDark ? 'rgba(200,169,81,0.18)' : 'rgba(200,169,81,0.2)') : 'transparent',
                  color: on ? (isDark ? '#c8a951' : '#7a5c0f') : ts,
                  border: 'none', whiteSpace: 'nowrap',
                }}
              >
                <Icon size={12} /> {o.label}
              </button>
            );
          })}
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
          title={collapsed ? 'Show chart' : 'Hide chart'}
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

      {/* ── The chart gets the full width. The headline numbers live in the
             right-hand panel and are not repeated here. ─────────────────── */}
      {!collapsed && (
        <div style={{ padding: '6px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ color: tp, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em' }}>
              {mode === 'season' && `PEOPLE EXPOSED THROUGH ${app.year} — ALL COUNTRIES`}
              {mode === 'trend' && 'YEAR ON YEAR — ALL COUNTRIES'}
              {mode === 'damage' && `DAMAGE BREAKDOWN — ${(country?.name ?? '').toUpperCase()}`}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: isDark ? '#22c55e' : '#15803d', fontSize: 8.5,
              fontWeight: 700, letterSpacing: '0.06em',
            }}>
              <Radio size={9} className="pulse-dot" /> LIVE
            </span>
            <span style={{ color: tm, fontSize: 9, marginLeft: 'auto' }}>
              {mode === 'damage'
                ? 'click a panel to colour the map by it'
                : 'compressed (log) scale · click a country to load it'}
            </span>
          </div>

          <div style={{ width: '100%', height: 196 }}>
            {mode === 'season' && (
              <SeasonChart
                monthly={monthly}
                yearId={app.year}
                activeCountry={app.countryCode}
                onPickCountry={app.setCountry}
                isDark={isDark}
              />
            )}
            {mode === 'trend' && (
              <TrendChart
                all={all}
                metricKey={app.metric}
                activeCountry={app.countryCode}
                scrubYear={app.scrubYear}
                onScrub={app.setScrubYear}
                onPickCountry={app.setCountry}
                isDark={isDark}
              />
            )}
            {mode === 'damage' && (
              <DamageBars
                all={all}
                countryCode={app.countryCode}
                countryName={country?.name ?? ''}
                activeMetric={app.metric}
                onPickMetric={m => app.setMetric(m as MetricKey)}
                isDark={isDark}
              />
            )}
          </div>

          <div style={{ color: tm, fontSize: 9, marginTop: 3, lineHeight: 1.5 }}>
            {caption}
            {mode === 'season' && event && year?.kind === 'event' && (
              <> · {event.measured.districts_flooded} of {event.measured.districts_total} districts
                 saw flooding</>
            )}
          </div>
        </div>
      )}

      <style>{`
        .pulse-dot { animation: pulse-fade 1.8s ease-in-out infinite; }
        @keyframes pulse-fade { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes tb-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .back-to-country { animation: back-pop .28s ease-out; }
        @keyframes back-pop {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .back-to-country:hover { filter: brightness(1.08); }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot, .back-to-country { animation: none; }
        }
      `}</style>
    </div>
  );
}
