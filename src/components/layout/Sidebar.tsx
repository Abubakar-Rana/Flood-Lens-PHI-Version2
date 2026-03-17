'use client';

import { useState } from 'react';
import { ChevronDown, Search, MapPin, SlidersHorizontal, Droplets, Wind, Stethoscope } from 'lucide-react';
import { AdminLevel, RiskType, SelectedRegion, RISK_TYPE_CONFIG } from '@/lib/types';
import { useTheme } from '@/lib/theme';

interface SidebarProps {
  riskType: RiskType;
  onRiskTypeChange: (t: RiskType) => void;
  adminLevel: AdminLevel;
  onAdminLevelChange: (level: AdminLevel) => void;
  selectedRegion: SelectedRegion | null;
  onRegionSelect: (region: SelectedRegion | null) => void;
  provinces: string[];
  districtsByProvince: Record<string, string[]>;
  predictionOffset: number;
  onPredictionOffsetChange: (v: number) => void;
}

const RISK_TYPES: { value: RiskType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'flood',       label: 'Flood Risk',              icon: Droplets,     desc: 'River flooding & early warning' },
  { value: 'smog',        label: 'Smog / Air Quality',      icon: Wind,         desc: 'Particulate matter & haze index' },
  { value: 'respiratory', label: 'Respiratory Infection',   icon: Stethoscope,  desc: 'Pollution-linked health risk' },
];

const RISK_LEGEND_COLORS = [
  { label: 'Lowest', dark: '#1d4ed8', light: '#93c5fd' },
  { label: 'Low',    dark: '#0891b2', light: '#67e8f9' },
  { label: 'Medium', dark: '#ca8a04', light: '#fde047' },
  { label: 'High',   dark: '#ea580c', light: '#fb923c' },
  { label: 'Highest',dark: '#b91c1c', light: '#f87171' },
];

const PRED_LABELS: Record<number, string> = { 0: 'Current', 1: '+1 Month', 2: '+2 Months', 3: '+3 Months' };

export default function Sidebar({
  riskType, onRiskTypeChange,
  adminLevel, onAdminLevelChange,
  selectedRegion, onRegionSelect,
  provinces, districtsByProvince,
  predictionOffset, onPredictionOffsetChange,
}: SidebarProps) {
  const { isDark } = useTheme();
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Theme-aware color tokens
  const bg          = isDark ? '#0d0d0d'                  : '#f8f8f8';
  const border      = isDark ? '#2e2e2e'                  : '#e0e0e0';
  const textPrimary = isDark ? '#ffffff'                  : '#111111';
  const textSecond  = isDark ? '#aaaaaa'                  : '#444444';
  const textMuted   = isDark ? '#666666'                  : '#888888';
  const textDim     = isDark ? '#555555'                  : '#999999';
  const inputBg     = isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(0,0,0,0.04)';
  const cardBg      = isDark ? 'rgba(255,255,255,0.03)'   : 'rgba(0,0,0,0.02)';
  const iconBg      = isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(0,0,0,0.06)';
  const footerBg    = isDark ? 'rgba(0,0,0,0.3)'          : 'rgba(0,0,0,0.04)';
  const optionBg    = isDark ? '#111111'                  : '#ffffff';
  const sliderTrack = isDark ? 'rgba(255,255,255,0.08)'   : 'rgba(0,0,0,0.1)';

  const adminOptions: { value: AdminLevel; label: string }[] = [
    { value: 'province', label: 'Province' },
    { value: 'district', label: 'District' },
  ];

  const filteredProvinces = provinces.filter(p =>
    p.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (districtsByProvince[p] || []).some(d => d.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeRiskCfg = RISK_TYPE_CONFIG[riskType];

  function SelectField<T extends string>({
    label, value, options, onChange,
  }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
    return (
      <div className="mb-3">
        <label style={{ color: textMuted, fontSize: 10, letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>{label}</label>
        <div className="relative">
          <select
            value={value}
            onChange={e => onChange(e.target.value as T)}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg text-xs font-medium outline-none"
            style={{ background: inputBg, border: `1px solid ${border}`, color: textPrimary, cursor: 'pointer' }}
          >
            {options.map(o => (
              <option key={o.value} value={o.value} style={{ background: optionBg }}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textMuted }} />
        </div>
      </div>
    );
  }

  return (
    <aside
      className="flex flex-col h-full"
      style={{ width: 256, background: bg, borderRight: `1px solid ${border}`, flexShrink: 0 }}
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} style={{ color: '#f59e0b' }} />
          <span style={{ color: textPrimary, fontWeight: 700, fontSize: 13 }}>Layers</span>
        </div>
        <p style={{ color: textDim, fontSize: 9, marginTop: 2, letterSpacing: '0.07em' }}>
          CONFIGURE MAP OVERLAYS & FILTERS
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">

        {/* ── Standard selectors ── */}
        <div>
          <SelectField<string>
            label="COUNTRY"
            value="Pakistan"
            options={[{ value: 'Pakistan', label: 'Pakistan' }]}
            onChange={() => {}}
          />
          <SelectField<AdminLevel>
            label="ADMINISTRATIVE LEVEL"
            value={adminLevel}
            options={adminOptions}
            onChange={onAdminLevelChange}
          />
        </div>

        {/* ── Risk Type selector ── */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
          <label style={{ color: textMuted, fontSize: 10, letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
            RISK TYPE
          </label>
          <div className="space-y-1.5">
            {RISK_TYPES.map(({ value, label, icon: Icon, desc }) => {
              const isActive = riskType === value;
              const cfg = RISK_TYPE_CONFIG[value];
              return (
                <button
                  key={value}
                  onClick={() => onRiskTypeChange(value)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: isActive ? `${cfg.color}18` : cardBg,
                    border: `1px solid ${isActive ? cfg.color + '50' : border}`,
                  }}
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ background: isActive ? cfg.color + '25' : iconBg }}
                  >
                    <Icon size={13} style={{ color: isActive ? cfg.color : textMuted }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: isActive ? textPrimary : textSecond, fontSize: 12, fontWeight: isActive ? 700 : 500, lineHeight: 1.3 }}>{label}</div>
                    <div style={{ color: textDim, fontSize: 9, marginTop: 1 }}>{desc}</div>
                  </div>
                  {isActive && (
                    <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Current selection badge */}
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: `${activeRiskCfg.color}10`, border: `1px solid ${activeRiskCfg.color}25` }}>
            <div className="w-2 h-2 rounded-full" style={{ background: activeRiskCfg.color }} />
            <span style={{ color: activeRiskCfg.color, fontSize: 10, fontWeight: 600 }}>
              Viewing: {activeRiskCfg.label}
            </span>
          </div>
        </div>

        {/* ── Prediction Period ── */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <label style={{ color: textMuted, fontSize: 10, letterSpacing: '0.07em' }}>PREDICTION PERIOD</label>
            <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 700 }}>{PRED_LABELS[predictionOffset]}</span>
          </div>
          <input
            type="range" min={0} max={3} step={1}
            value={predictionOffset}
            onChange={e => onPredictionOffsetChange(Number(e.target.value))}
            className="w-full appearance-none rounded-full outline-none"
            style={{
              height: 5,
              background: `linear-gradient(to right, #f59e0b ${(predictionOffset / 3) * 100}%, ${sliderTrack} ${(predictionOffset / 3) * 100}%)`,
              cursor: 'pointer',
              accentColor: '#f59e0b',
            }}
          />
          <div className="flex justify-between mt-1.5">
            {Object.values(PRED_LABELS).map(l => (
              <span key={l} style={{ color: textDim, fontSize: 8 }}>{l}</span>
            ))}
          </div>
        </div>

        {/* ── Risk Level Legend ── */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ color: textMuted, fontSize: 10, letterSpacing: '0.07em', fontWeight: 600 }}>RISK LEVEL</span>
          </div>
          <div className="space-y-2">
            {RISK_LEGEND_COLORS.map(item => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md flex-shrink-0" style={{ background: isDark ? item.dark : item.light }} />
                <span style={{ color: textSecond, fontSize: 12 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Region Search ── */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={12} style={{ color: '#f59e0b' }} />
            <span style={{ color: textMuted, fontSize: 10, letterSpacing: '0.07em', fontWeight: 600 }}>SELECT REGION</span>
          </div>

          <div className="relative mb-2.5">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: textDim }} />
            <input
              type="text"
              placeholder="Search province / district…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-lg text-xs outline-none"
              style={{ background: inputBg, border: `1px solid ${border}`, color: textPrimary, fontSize: 11 }}
            />
          </div>

          {/* All Pakistan */}
          <button
            onClick={() => onRegionSelect(null)}
            className="w-full text-left px-3 py-2 rounded-lg mb-1 text-xs font-semibold transition-all"
            style={{
              background: !selectedRegion ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: !selectedRegion ? '#f59e0b' : textSecond,
              border: `1px solid ${!selectedRegion ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
            }}
          >
            All Pakistan
          </button>

          {/* Province list */}
          <div className="space-y-0.5">
            {filteredProvinces.map(province => {
              const isExpanded = expandedProvince === province;
              const isSel = selectedRegion?.level === 'province' && selectedRegion.name === province;
              const districts = districtsByProvince[province] || [];
              const matchDist = searchQuery ? districts.filter(d => d.toLowerCase().includes(searchQuery.toLowerCase())) : districts;

              return (
                <div key={province}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onRegionSelect({ level: 'province', name: province })}
                      className="flex-1 text-left px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: isSel ? 'rgba(245,158,11,0.1)' : 'transparent',
                        color: isSel ? '#f59e0b' : textSecond,
                        border: `1px solid ${isSel ? 'rgba(245,158,11,0.25)' : 'transparent'}`,
                        fontSize: 11, fontWeight: isSel ? 600 : 400,
                      }}
                    >
                      {province}
                    </button>
                    {adminLevel === 'district' && districts.length > 0 && (
                      <button
                        onClick={() => setExpandedProvince(isExpanded ? null : province)}
                        className="p-1 rounded flex-shrink-0"
                        style={{ color: textDim }}
                      >
                        <ChevronDown size={10} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                    )}
                  </div>

                  {isExpanded && adminLevel === 'district' && (
                    <div className="ml-3 mt-0.5 space-y-0.5">
                      {matchDist.map(dist => {
                        const dSel = selectedRegion?.level === 'district' && selectedRegion.name === dist;
                        return (
                          <button
                            key={dist}
                            onClick={() => onRegionSelect({ level: 'district', name: dist, province })}
                            className="w-full text-left px-3 py-1 rounded-md transition-all"
                            style={{
                              background: dSel ? 'rgba(245,158,11,0.1)' : 'transparent',
                              color: dSel ? '#f59e0b' : textMuted,
                              border: `1px solid ${dSel ? 'rgba(245,158,11,0.2)' : 'transparent'}`,
                              fontSize: 10, fontWeight: dSel ? 600 : 400,
                            }}
                          >
                            {dist}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 px-4 py-2.5" style={{ borderTop: `1px solid ${border}`, background: footerBg }}>
        <div className="flex items-center justify-between">
          <span style={{ color: textDim, fontSize: 9 }}>161 DISTRICTS · 9 PROVINCES</span>
          <div className="w-2 h-2 rounded-full" style={{ background: activeRiskCfg.color, boxShadow: `0 0 6px ${activeRiskCfg.color}` }} />
        </div>
      </div>
    </aside>
  );
}
