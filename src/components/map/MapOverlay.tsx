'use client';

import { useState } from 'react';
import { RotateCcw, Crosshair, Layers, ChevronDown } from 'lucide-react';
import { RiskType, SelectedRegion, RISK_TYPE_CONFIG } from '@/lib/types';
import MapLegend from './MapLegend';

interface MapOverlayProps {
  riskType: RiskType;
  selectedRegion: SelectedRegion | null;
  onReset: () => void;
  isDark: boolean;
}

export default function MapOverlay({ riskType, selectedRegion, onReset, isDark }: MapOverlayProps) {
  const [legendVisible, setLegendVisible] = useState(true);

  const cfg = RISK_TYPE_CONFIG[riskType];
  const glassBg     = isDark ? 'rgba(17,17,17,0.90)'  : 'rgba(255,255,255,0.93)';
  const glassBorder = isDark ? '#2e2e2e'              : '#d6e0eb';
  const textMuted   = isDark ? '#666666'              : '#888888';
  const textPrimary = isDark ? '#ffffff'              : '#111111';

  return (
    <>
      {/* ── Top-left: viewing indicator ── */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 12,
            background: glassBg, border: `1px solid ${glassBorder}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 8px ${cfg.color}80`, flexShrink: 0 }} />
          <div>
            <div style={{ color: textPrimary, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{cfg.label}</div>
            <div style={{ color: textMuted, fontSize: 9 }}>{cfg.description}</div>
          </div>
        </div>

        {/* Coordinates */}
        <div style={{ padding: '6px 10px', borderRadius: 8, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Crosshair size={10} style={{ color: textMuted }} />
          <span style={{ color: textMuted, fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            30.37°N · 69.34°E · EPSG:4326
          </span>
        </div>
      </div>

      {/* ── Top-right: reset button ── */}
      {selectedRegion && (
        <div className="absolute top-4 right-14 z-[1000]">
          <button
            onClick={onReset}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: glassBg, border: `1px solid ${glassBorder}`,
              color: textMuted, fontSize: 11, fontWeight: 500,
              backdropFilter: 'blur(10px)',
            }}
          >
            <RotateCcw size={11} />
            Reset View
          </button>
        </div>
      )}

      {/* ── Bottom-left: Legend toggle button + legend ── */}
      <div className="absolute bottom-6 left-4 z-[1000] flex flex-col items-start gap-2">
        {/* Toggle button */}
        <button
          onClick={() => setLegendVisible(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            background: legendVisible
              ? (isDark ? `${cfg.color}18` : `${cfg.color}12`)
              : glassBg,
            border: `1px solid ${legendVisible ? cfg.color + '50' : glassBorder}`,
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s',
          }}
        >
          <Layers size={12} style={{ color: legendVisible ? cfg.color : textMuted }} />
          <span style={{ color: legendVisible ? cfg.color : textMuted, fontSize: 10, fontWeight: 600 }}>
            Legend
          </span>
          <ChevronDown
            size={10}
            style={{
              color: legendVisible ? cfg.color : textMuted,
              transform: legendVisible ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {/* Legend panel — slide in/out */}
        <div
          style={{
            overflow: 'hidden',
            maxHeight: legendVisible ? 220 : 0,
            opacity: legendVisible ? 1 : 0,
            transition: 'max-height 0.25s ease, opacity 0.2s ease',
            pointerEvents: legendVisible ? 'auto' : 'none',
          }}
        >
          <MapLegend riskType={riskType} isDark={isDark} />
        </div>
      </div>

      {/* ── Bottom-right: portal badge ── */}
      <div
        style={{
          position: 'absolute', bottom: 24, right: 56, zIndex: 1000,
          padding: '7px 12px', borderRadius: 12,
          background: glassBg, border: `1px solid ${glassBorder}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ color: isDark ? cfg.color : textPrimary, fontSize: 10, fontWeight: 700 }}>PHI Lab Risk Predictor</div>
        <div style={{ color: textMuted, fontSize: 9 }}>University of Oxford · Pakistan</div>
      </div>
    </>
  );
}
