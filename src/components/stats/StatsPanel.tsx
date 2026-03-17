'use client';

import { useMemo, useState } from 'react';
import {
  Droplets, Wind, Activity, Users, MapPin,
  TrendingUp, TrendingDown, Minus, Cpu, Download,
  RotateCcw, Stethoscope, Info, BarChart3,
} from 'lucide-react';
import { SelectedRegion, RiskData, RiskType, RISK_TYPE_CONFIG } from '@/lib/types';
import { getRiskColor, getRiskLabel, formatPopulation, getAQICategory, generateTimeSeriesData } from '@/lib/utils';
import TrendChart from './TrendChart';
import { useTheme } from '@/lib/theme';

interface StatsPanelProps {
  selectedRegion: SelectedRegion | null;
  riskData: RiskData | null;
  riskType: RiskType;
  predictionOffset: number;
  onReset: () => void;
}

type Tab = 'scores' | 'indicators' | 'trends' | 'model';

const CONFIDENCE: Record<number, 'HIGH' | 'MEDIUM' | 'LOW'> = { 0: 'HIGH', 1: 'HIGH', 2: 'MEDIUM', 3: 'LOW' };

/* Derive 3 month labels from today */
function getMonthLabels(): [string, string, string] {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const m1 = new Date(now.getFullYear(), now.getMonth(), 1);
  const m2 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const m3 = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  return [fmt(m1), fmt(m2), fmt(m3)];
}

/* ── Shared MetricRow ── */
function MetricRow({ label, value, unit, color, isDark }: { label: string; value: string | number; unit?: string; color?: string; isDark: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
      <span style={{ color: isDark ? '#aaaaaa' : '#444444', fontSize: 11 }}>{label}</span>
      <span style={{ color: color || (isDark ? '#ffffff' : '#111111'), fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
        {value}{unit && <span style={{ color: isDark ? '#666666' : '#888888', fontSize: 9, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  );
}

/* ── DIRE-style Prediction Card (time-period, single risk type) ── */
function PredictionCard({
  score, monthLabel, isCurrent, color, bg, isDark,
}: {
  score: number; monthLabel: string; isCurrent: boolean;
  color: string; bg: string; isDark: boolean;
}) {
  const riskLvl = getRiskLabel(score);
  return (
    <div style={{
      flex: 1, borderRadius: 12, padding: '14px 10px', textAlign: 'center',
      background: isDark ? `${color}18` : `${color}10`,
      border: `1.5px solid ${color}45`,
      boxShadow: isDark ? `0 0 20px ${color}12` : `0 2px 12px ${color}14`,
      transition: 'all 0.2s',
    }}>
      {/* Big score number */}
      <div style={{
        fontSize: 36, fontWeight: 900, color, lineHeight: 1,
        fontFamily: 'monospace', letterSpacing: '-0.03em',
      }}>{score}</div>
      {/* /100 */}
      <div style={{ fontSize: 9, color: isDark ? '#666666' : '#888888', marginTop: 2, fontFamily: 'monospace' }}>/100</div>
      {/* Month */}
      <div style={{ fontSize: 10, color: isDark ? '#aaaaaa' : '#333333', marginTop: 6, fontWeight: 600, lineHeight: 1.3 }}>
        {monthLabel}
      </div>
      {/* Predicted / Current badge */}
      <div style={{ fontSize: 8, color: isDark ? '#666666' : '#888888', marginTop: 2 }}>
        ({isCurrent ? 'Current' : 'Predicted'})
      </div>
      {/* Risk level chip */}
      <div style={{ marginTop: 6 }}>
        <span style={{
          display: 'inline-block', padding: '2px 7px', borderRadius: 4,
          fontSize: 8, fontWeight: 700,
          background: `${color}25`, color, border: `1px solid ${color}50`,
          letterSpacing: '0.05em',
        }}>
          {riskLvl}
        </span>
      </div>
    </div>
  );
}

/* ── Confidence badge ── */
function Confidence({ level, isDark }: { level: 'HIGH' | 'MEDIUM' | 'LOW'; isDark: boolean }) {
  const c = { HIGH: '#22c55e', MEDIUM: '#c8a951', LOW: '#c2410c' }[level];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <span style={{ color: isDark ? '#aaaaaa' : '#444444', fontSize: 11 }}>Model Confidence</span>
      <span style={{ padding: '3px 10px', borderRadius: 5, background: `${c}15`, color: c, border: `1px solid ${c}35`, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
        {level}
      </span>
    </div>
  );
}

/* ── Progress bar ── */
function ScoreBar({ label, value, color, isDark }: { label: string; value: number; color: string; isDark: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ color: isDark ? '#aaaaaa' : '#444444', fontSize: 11 }}>{label}</span>
        <span style={{ color, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{value} / 100</span>
      </div>
      <div style={{ height: 6, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.08)' : '#eeeeee', overflow: 'hidden' }}>
        <div className="bar-fill" style={{ height: '100%', width: `${value}%`, borderRadius: 6, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        {['Lowest', 'Low', 'Medium', 'High', 'Highest'].map(t => (
          <span key={t} style={{ fontSize: 7, color: isDark ? '#666666' : '#888888' }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function StatsPanel({ selectedRegion, riskData, riskType, predictionOffset, onReset }: StatsPanelProps) {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('scores');

  const cfg = RISK_TYPE_CONFIG[riskType];

  const bg = isDark ? '#1a1a1a' : '#ffffff';
  const cardBg = isDark ? '#222222' : '#f8fafc';
  const border = isDark ? '#2e2e2e' : '#e0e0e0';
  const tp = isDark ? '#ffffff' : '#111111';
  const ts = isDark ? '#aaaaaa' : '#444444';
  const tm = isDark ? '#666666' : '#888888';

  const data = useMemo(() => {
    if (!riskData) return null;
    const off = predictionOffset;
    const jitter = (v: number) => Math.min(100, Math.max(5, Math.round(v + off * (Math.random() > 0.5 ? 5 : -3))));

    if (!selectedRegion) return {
      level: 'country', name: 'Pakistan',
      flood_risk: jitter(65), smog_risk: jitter(58), ew_flood_risk: jitter(72),
      respiratory_risk: jitter(63), aqi: 185, pm25: 87.4,
      rainfall_mm: 142.3, river_level: 6.2, population: 231000000,
      affected_area_pct: 28.5, trend: 'rising' as const,
      districts_count: 161, high_risk_districts: 42,
      resp_cases_per_100k: 342, resp_hospitalization_rate: 8.4,
    };

    if (selectedRegion.level === 'province') {
      const p = riskData.provinces[selectedRegion.name];
      if (!p) return null;
      return {
        level: 'province', name: selectedRegion.name, ...p,
        flood_risk: jitter(p.flood_risk), smog_risk: jitter(p.smog_risk),
        ew_flood_risk: jitter(p.ew_flood_risk), respiratory_risk: jitter(p.respiratory_risk),
        river_level: 4.8, population: 50000000, affected_area_pct: 22, trend: 'rising' as const,
        resp_hospitalization_rate: 7.2,
      };
    }

    const d = riskData.districts[selectedRegion.name];
    if (!d) return null;
    return {
      level: 'district', name: selectedRegion.name, ...d,
      flood_risk: jitter(d.flood_risk), smog_risk: jitter(d.smog_risk),
      ew_flood_risk: jitter(d.ew_flood_risk), respiratory_risk: jitter(d.respiratory_risk),
      districts_count: undefined, high_risk_districts: undefined,
    };
  }, [selectedRegion, riskData, predictionOffset]);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'scores',     label: 'Scores',     icon: BarChart3 },
    { key: 'indicators', label: 'Indicators', icon: Activity },
    { key: 'trends',     label: 'Trends',     icon: TrendingUp },
    { key: 'model',      label: 'Model',      icon: Cpu },
  ];

  const primaryScore = data
    ? riskType === 'flood' ? data.flood_risk
      : riskType === 'smog' ? data.smog_risk
      : data.respiratory_risk
    : 0;

  const aqiInfo = data ? getAQICategory(data.aqi) : null;

  return (
    <aside style={{ width: 296, background: bg, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'background 0.25s' }}>

      {/* ── Region header ── */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: isDark ? '#222222' : '#f5f5f5', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <MapPin size={11} style={{ color: tm }} />
              <span style={{ color: tm, fontSize: 9, fontWeight: 600, letterSpacing: '0.07em' }}>
                {selectedRegion ? selectedRegion.level.toUpperCase() + ' SELECTED' : 'NATIONAL VIEW'}
              </span>
            </div>
            <div style={{ color: tp, fontWeight: 700, fontSize: 15 }}>
              {selectedRegion ? selectedRegion.name : 'Pakistan'}
            </div>
            {selectedRegion?.province && (
              <div style={{ color: ts, fontSize: 11 }}>{selectedRegion.province}</div>
            )}
          </div>
          {selectedRegion && (
            <button onClick={onReset} style={{ padding: 6, borderRadius: 6, background: 'transparent', border: `1px solid ${border}`, color: tm, cursor: 'pointer' }} title="Reset">
              <RotateCcw size={11} />
            </button>
          )}
        </div>

        {/* Risk type badge */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
          <span style={{ color: cfg.color, fontSize: 10, fontWeight: 600 }}>{cfg.label}</span>
          <span style={{ marginLeft: 'auto', color: tm, fontSize: 9 }}>{getMonthLabels()[Math.min(predictionOffset, 2)]}</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '9px 4px', fontSize: 10, fontWeight: active ? 700 : 500,
                background: active ? '#c8a951' : 'transparent',
                color: active ? '#080e1c' : tm,
                border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid #c8a951' : '2px solid transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {data ? (
          <>
            {/* ══ SCORES TAB ══ */}
            {tab === 'scores' && (
              <div style={{ padding: 14 }} className="anim-fade-up">

                {/* ── DIRE-style: 3 time-period prediction cards for selected risk type ── */}
                {(() => {
                  const [m0, m1, m2] = getMonthLabels();
                  const baseScore = primaryScore;
                  // Simulate modest monthly change (~3-7 pts per month)
                  const s0 = baseScore;
                  const s1 = Math.min(99, Math.max(5, Math.round(baseScore + (Math.random() > 0.5 ? 5 : -3))));
                  const s2 = Math.min(99, Math.max(5, Math.round(s1 + (Math.random() > 0.5 ? 4 : -2))));

                  // DIRE card colors: current=amber, next=blue, last=darker blue
                  const CARD_COLORS = [
                    { color: '#c8a951', bg: '#c8a951' },   // amber — current
                    { color: '#3d8bcd', bg: '#3d8bcd' },   // steel blue — +1 mo
                    { color: '#2d6fa8', bg: '#2d6fa8' },   // deeper blue — +2 mo
                  ];
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: isDark ? '#666666' : '#888888', fontSize: 9, letterSpacing: '0.07em', fontWeight: 600, marginBottom: 10 }}>
                        {cfg.label.toUpperCase()} — PREDICTIONS
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <PredictionCard score={s0} monthLabel={m0} isCurrent={true}  color={CARD_COLORS[0].color} bg={CARD_COLORS[0].bg} isDark={isDark} />
                        <PredictionCard score={s1} monthLabel={m1} isCurrent={false} color={CARD_COLORS[1].color} bg={CARD_COLORS[1].bg} isDark={isDark} />
                        <PredictionCard score={s2} monthLabel={m2} isCurrent={false} color={CARD_COLORS[2].color} bg={CARD_COLORS[2].bg} isDark={isDark} />
                      </div>
                    </div>
                  );
                })()}

                <Confidence level={CONFIDENCE[predictionOffset]} isDark={isDark} />

                {/* Trend indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` }}>
                  <span style={{ color: ts, fontSize: 11 }}>Score Trend</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    background: data.trend === 'rising' ? 'rgba(194,65,12,0.12)' : data.trend === 'falling' ? 'rgba(34,197,94,0.12)' : 'rgba(200,169,81,0.12)',
                    color: data.trend === 'rising' ? '#c2410c' : data.trend === 'falling' ? '#22c55e' : '#c8a951',
                  }}>
                    {data.trend === 'rising' ? <TrendingUp size={10} /> : data.trend === 'falling' ? <TrendingDown size={10} /> : <Minus size={10} />}
                    {data.trend.charAt(0).toUpperCase() + data.trend.slice(1)}
                  </span>
                </div>

                {/* Score bars */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ color: tm, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 10 }}>SCORE DISTRIBUTION</div>
                  <ScoreBar label="Flood Risk" value={data.flood_risk} color="#3b82f6" isDark={isDark} />
                  <ScoreBar label="Smog / Air Quality" value={data.smog_risk} color="#a855f7" isDark={isDark} />
                  <ScoreBar label="Respiratory Infection" value={data.respiratory_risk} color="#14b8a6" isDark={isDark} />
                </div>

                {/* Population */}
                {data.population && (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Users size={11} style={{ color: tm }} />
                      <span style={{ color: tm, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em' }}>POPULATION STATISTICS</span>
                    </div>
                    <MetricRow label="Total Population" value={formatPopulation(data.population)} isDark={isDark} color={ts} />
                    <MetricRow label="Affected Area" value={data.affected_area_pct.toFixed(1)} unit="%" isDark={isDark} color={cfg.color} />
                    <MetricRow label="At-Risk Pop." value={formatPopulation(Math.round(data.population * data.affected_area_pct / 100))} isDark={isDark} color={cfg.color} />
                  </div>
                )}
              </div>
            )}

            {/* ══ INDICATORS TAB ══ */}
            {tab === 'indicators' && (
              <div style={{ padding: 14 }} className="anim-fade-up">
                {/* Flood indicators */}
                <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: isDark ? 'rgba(59,130,246,0.06)' : '#eff6ff', border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : '#bfdbfe'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Droplets size={11} style={{ color: '#3b82f6' }} />
                    <span style={{ color: isDark ? '#93c5fd' : '#1d4ed8', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>FLOOD INDICATORS</span>
                  </div>
                  <MetricRow label="24h Rainfall" value={data.rainfall_mm.toFixed(1)} unit="mm" isDark={isDark} color="#3b82f6" />
                  <MetricRow label="River Level" value={data.river_level.toFixed(2)} unit="m" isDark={isDark}
                    color={data.river_level > 8 ? '#c2410c' : data.river_level > 5 ? '#ea580c' : '#22c55e'} />
                  <MetricRow label="Flood Score" value={data.flood_risk} unit="/100" isDark={isDark} color={getRiskColor(data.flood_risk)} />
                  <MetricRow label="EW Flood Score" value={data.ew_flood_risk} unit="/100" isDark={isDark} color={getRiskColor(data.ew_flood_risk)} />
                </div>

                {/* Smog */}
                <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: isDark ? 'rgba(168,85,247,0.06)' : '#faf5ff', border: `1px solid ${isDark ? 'rgba(168,85,247,0.2)' : '#e9d5ff'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Wind size={11} style={{ color: '#a855f7' }} />
                    <span style={{ color: isDark ? '#c4b5fd' : '#7c3aed', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>SMOG / AIR QUALITY</span>
                  </div>
                  {/* Smog intensity bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: ts, fontSize: 11 }}>Smog Intensity</span>
                      <span style={{ color: getRiskColor(data.smog_risk), fontSize: 11, fontWeight: 700 }}>
                        {getRiskLabel(data.smog_risk)}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 6, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.07)' : '#ede9fe' }}>
                      <div style={{ height: '100%', width: `${data.smog_risk}%`, borderRadius: 6, background: 'linear-gradient(90deg, #7c3aed88, #a855f7)' }} />
                    </div>
                  </div>
                  <MetricRow label="PM2.5" value={data.pm25.toFixed(1)} unit="μg/m³" isDark={isDark} color={data.pm25 > 100 ? '#c2410c' : data.pm25 > 50 ? '#ea580c' : '#22c55e'} />
                  <MetricRow label="Smog Score" value={data.smog_risk} unit="/100" isDark={isDark} color={getRiskColor(data.smog_risk)} />
                </div>

                {/* Respiratory */}
                <div style={{ padding: 12, borderRadius: 10, background: isDark ? 'rgba(20,184,166,0.06)' : '#f0fdfa', border: `1px solid ${isDark ? 'rgba(20,184,166,0.2)' : '#99f6e4'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Stethoscope size={11} style={{ color: '#14b8a6' }} />
                    <span style={{ color: isDark ? '#5eead4' : '#0f766e', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>RESPIRATORY INDICATORS</span>
                  </div>
                  <MetricRow label="Cases / 100k pop." value={data.resp_cases_per_100k?.toFixed(1) || '–'} isDark={isDark} color="#14b8a6" />
                  <MetricRow label="Hospitalisation Rate" value={`${data.resp_hospitalization_rate?.toFixed(1) || '–'}%`} isDark={isDark} color="#14b8a6" />
                  <MetricRow label="Risk Score" value={data.respiratory_risk} unit="/100" isDark={isDark} color={getRiskColor(data.respiratory_risk)} />
                </div>
              </div>
            )}

            {/* ══ TRENDS TAB ══ */}
            {tab === 'trends' && (
              <div style={{ padding: 14 }} className="anim-fade-up">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ color: tm, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em' }}>
                    HISTORICAL DATA — {data.name}
                  </span>
                  <button style={{ color: tm, background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Download size={11} />
                  </button>
                </div>
                <TrendChart baseValue={data.flood_risk} color="#3b82f6" label="Flood Risk Score (30 days)" height={65} isDark={isDark} />
                <div style={{ height: 12 }} />
                <TrendChart baseValue={data.smog_risk} color="#a855f7" label="Smog Risk Score (30 days)" height={65} isDark={isDark} />
                <div style={{ height: 12 }} />
                <TrendChart baseValue={data.respiratory_risk} color="#14b8a6" label="Respiratory Risk Score (30 days)" height={65} isDark={isDark} />
                <div style={{ height: 12 }} />
                <TrendChart baseValue={Math.min(100, data.aqi / 5)} color="#f59e0b" label="AQI Normalised (30 days)" height={65} isDark={isDark} />
              </div>
            )}

            {/* ══ MODEL TAB ══ */}
            {tab === 'model' && (
              <div style={{ padding: 14 }} className="anim-fade-up">
                {/* Model prediction cards */}
                <div style={{ padding: 12, borderRadius: 10, marginBottom: 14, background: isDark ? 'rgba(200,169,81,0.06)' : '#fffbeb', border: `1px solid ${isDark ? 'rgba(200,169,81,0.2)' : '#fde68a'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Cpu size={11} style={{ color: '#c8a951' }} />
                      <span style={{ color: '#c8a951', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>AI PREDICTION MODEL</span>
                    </div>
                    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(200,169,81,0.15)', color: '#c8a951', fontSize: 8, fontWeight: 700 }}>PLACEHOLDER</span>
                  </div>

                  {/* 3-month prediction cards */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[
                      { m: 'Mar 2026', v: Math.min(99, primaryScore + 5) },
                      { m: 'Apr 2026', v: Math.min(99, primaryScore + 9) },
                      { m: 'May 2026', v: Math.min(99, primaryScore + 4) },
                    ].map(p => (
                      <div key={p.m} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: isDark ? `${cfg.color}15` : `${cfg.color}10`, border: `1px solid ${cfg.color}30` }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: cfg.color, fontFamily: 'monospace', lineHeight: 1 }}>{p.v}</div>
                        <div style={{ fontSize: 8, color: ts, marginTop: 3 }}>{p.m}</div>
                        <div style={{ fontSize: 8, color: tm }}>(Predicted)</div>
                      </div>
                    ))}
                  </div>

                  <Confidence level={CONFIDENCE[predictionOffset]} isDark={isDark} />
                </div>

                {/* Model details */}
                <div style={{ color: tm, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 8 }}>MODEL PARAMETERS</div>
                <MetricRow label="Model Type" value="Ensemble ML" isDark={isDark} color={ts} />
                <MetricRow label="Training Period" value="2018–2024" isDark={isDark} color={ts} />
                <MetricRow label="Prediction Horizon" value="90 days" isDark={isDark} color={ts} />
                <MetricRow label="Spatial Resolution" value="District-level" isDark={isDark} color={ts} />
                <MetricRow label="Accuracy (validation)" value="84.2%" isDark={isDark} color="#22c55e" />
                <MetricRow label="Last Updated" value="6 hrs ago" isDark={isDark} color={tm} />

                <div style={{ marginTop: 14 }}>
                  <div style={{ color: tm, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', marginBottom: 8 }}>DATA SOURCES</div>
                  {['Pakistan Meteorological Dept (PMD)', 'NDMA Flood Reports', 'EPA Pakistan AQI', 'WHO Health Data', 'Satellite Imagery (Sentinel-2)'].map(src => (
                    <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: tm, flexShrink: 0 }} />
                      <span style={{ color: ts, fontSize: 10 }}>{src}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14 }}>
                  <button style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: isDark ? 'rgba(200,169,81,0.08)' : '#fffbeb', border: '1px solid rgba(200,169,81,0.3)', color: '#c8a951', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Download size={12} />
                    Generate Full Report
                  </button>
                </div>

                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                    <Info size={10} style={{ color: tm, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: tm, fontSize: 9, lineHeight: 1.5 }}>
                      Predictions are generated by PHI Lab's proprietary ML model and are intended for research purposes only. Not a substitute for official government advisories.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, textAlign: 'center', padding: 24 }}>
            <MapPin size={28} style={{ color: tm, marginBottom: 10, opacity: 0.4 }} />
            <p style={{ color: ts, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Select a Region</p>
            <p style={{ color: tm, fontSize: 10, lineHeight: 1.6 }}>Click on the map or use the left panel to select a province or district to view predictions.</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '8px 14px', borderTop: `1px solid ${border}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc', flexShrink: 0 }}>
        <p style={{ color: tm, fontSize: 9, letterSpacing: '0.04em' }}>
          PHI Lab · University of Oxford · Pakistan Risk Predictor
        </p>
        <p style={{ color: tm, fontSize: 9, marginTop: 2 }}>
          Developed by <span style={{ color: ts, fontWeight: 600 }}>Abubakar</span>
        </p>
      </div>
    </aside>
  );
}
