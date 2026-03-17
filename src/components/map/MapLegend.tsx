'use client';

import { RiskType, RISK_TYPE_CONFIG } from '@/lib/types';

interface MapLegendProps {
  riskType: RiskType;
  isDark: boolean;
}

const DARK_PALETTES: Record<RiskType, string[]> = {
  flood:       ['#1a3d55', '#1b6690', '#a86c10', '#bd3e10', '#8c1a1a'],
  smog:        ['#2d1b69', '#5b21b6', '#a86c10', '#bd3e10', '#7c1a1a'],
  respiratory: ['#134e4a', '#0d9488', '#a86c10', '#bd3e10', '#7f1d1d'],
};

const LIGHT_PALETTES: Record<RiskType, string[]> = {
  flood:       ['#b8d4e8', '#5a9fc4', '#d4940e', '#c95414', '#a01818'],
  smog:        ['#e4d4f7', '#9d6cd4', '#d4940e', '#c95414', '#8c1414'],
  respiratory: ['#b8eae4', '#3ab8a8', '#d4940e', '#c95414', '#9c1a1a'],
};

const TIERS = ['Lowest', 'Low', 'Medium', 'High', 'Highest'];

export default function MapLegend({ riskType, isDark }: MapLegendProps) {
  const cfg     = RISK_TYPE_CONFIG[riskType];
  const palette = isDark ? DARK_PALETTES[riskType] : LIGHT_PALETTES[riskType];

  const bg     = isDark ? 'rgba(17,17,17,0.94)' : 'rgba(255,255,255,0.97)';
  const border = isDark ? '#2e2e2e'            : '#d6e0eb';
  const ts     = isDark ? '#ffffff'            : '#111111';
  const tm     = isDark ? '#666666'            : '#888888';

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '12px 16px',
      backdropFilter: 'blur(14px)',
      boxShadow: isDark
        ? '0 8px 32px rgba(0,0,0,0.55)'
        : '0 4px 20px rgba(0,0,0,0.1)',
      minWidth: 160,
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
        <span style={{ color: cfg.color, fontSize: 11, fontWeight: 800, letterSpacing: '0.07em' }}>
          {cfg.label.toUpperCase()}
        </span>
      </div>

      {/* Simple swatch rows — exactly like DIRE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {TIERS.map((tier, i) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              background: palette[i],
            }} />
            <span style={{ color: ts, fontSize: 12, fontWeight: 500 }}>{tier}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
