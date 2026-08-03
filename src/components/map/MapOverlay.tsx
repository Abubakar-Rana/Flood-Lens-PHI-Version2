'use client';

import { useState } from 'react';
import { ChevronDown, Layers, Loader2, TrendingUp, Waves } from 'lucide-react';
import { useApp, LATEST_OBSERVED_YEAR } from '@/lib/state';
import { METRIC_BY_KEY } from '@/lib/types';
import MapLegend from './MapLegend';

export default function MapOverlay({ isDark }: { isDark: boolean }) {
  const app = useApp();
  const [legendVisible, setLegendVisible] = useState(true);
  const m = METRIC_BY_KEY[app.metric];

  const glassBg = isDark ? 'rgba(17,17,17,0.90)' : 'rgba(255,255,255,0.93)';
  const glassBorder = isDark ? '#2e2e2e' : '#d6e0eb';
  const tm = isDark ? '#666' : '#888';
  const tp = isDark ? '#fff' : '#111';

  const semColor = m.semantics === 'hot' ? '#ef4444' : m.semantics === 'cool' ? '#22c55e' : '#3b82f6';
  const projected = app.scrubYear > LATEST_OBSERVED_YEAR;

  return (
    <>
      {/* A projected year is a different claim from an observed one. Say so on
          the map itself, not only in the chart legend. */}
      {projected && (
        <div className="absolute left-1/2 z-[1000]" style={{ top: 178, transform: 'translateX(-50%)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px',
            borderRadius: 20, background: 'rgba(200,169,81,0.16)',
            border: '1px solid rgba(200,169,81,0.5)', backdropFilter: 'blur(10px)',
          }}>
            <TrendingUp size={12} style={{ color: '#c8a951' }} />
            <span style={{ color: '#c8a951', fontSize: 11, fontWeight: 700 }}>
              {app.scrubYear} — projected, not observed
            </span>
            <button
              onClick={() => app.setScrubYear(LATEST_OBSERVED_YEAR)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#c8a951', fontSize: 10, textDecoration: 'underline', padding: 0,
              }}
            >
              back to {LATEST_OBSERVED_YEAR}
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay — centre of map */}
      {app.loading && (
        <div className="absolute inset-0 z-[999] pointer-events-none flex items-center justify-center">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12,
            background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          }}>
            <Loader2 size={14} style={{ color: '#c8a951', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: tp, fontSize: 12, fontWeight: 600 }}>Loading {app.countryCode.toUpperCase()} data…</span>
          </div>
        </div>
      )}

      {/* Bottom-left: what the colours mean */}
      <div className="absolute bottom-6 left-4 z-[1000] flex flex-col items-start gap-2">
        <button onClick={() => setLegendVisible(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: legendVisible ? (isDark ? `${semColor}18` : `${semColor}12`) : glassBg, border: `1px solid ${legendVisible ? semColor + '50' : glassBorder}`, backdropFilter: 'blur(10px)' }}>
          <Layers size={12} style={{ color: legendVisible ? semColor : tm }} />
          <span style={{ color: legendVisible ? semColor : tm, fontSize: 10, fontWeight: 600 }}>What the colours mean</span>
          <ChevronDown size={10} style={{ color: legendVisible ? semColor : tm, transform: legendVisible ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }} />
        </button>
        <div style={{ overflow: 'hidden', maxHeight: legendVisible ? 340 : 0, opacity: legendVisible ? 1 : 0, transition: 'max-height .25s, opacity .2s', pointerEvents: legendVisible ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <MapLegend isDark={isDark} />
            {app.showExtent && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                borderRadius: 10, background: glassBg, border: `1px solid ${glassBorder}`,
                backdropFilter: 'blur(10px)',
              }}>
                <Waves size={12} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <span style={{ width: 16, height: 9, background: '#38bdf8', borderRadius: 2, flexShrink: 0 }} />
                <span style={{ color: tp, fontSize: 10 }}>Water seen from space</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
