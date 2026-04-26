'use client';

import { useState } from 'react';
import { Crosshair, Layers, ChevronDown, RotateCcw } from 'lucide-react';
import { useApp } from '@/lib/state';
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

  return (
    <>
      {/* Top-left: active metric */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(12px)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: semColor, boxShadow: `0 0 8px ${semColor}80` }} />
          <div>
            <div style={{ color: tp, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{m.label}</div>
            <div style={{ color: tm, fontSize: 9 }}>{m.description}</div>
          </div>
        </div>

        {/* Filter status */}
        {(app.provinceFilter.size > 0 || app.metricMin !== null || app.metricMax !== null || app.amenityFilter.size > 0) && (
          <div style={{ padding: '6px 10px', borderRadius: 8, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={10} style={{ color: '#c8a951' }} />
            <span style={{ color: tp, fontSize: 10 }}>
              {app.provinceFilter.size > 0 && <>{app.provinceFilter.size} province · </>}
              {(app.metricMin !== null || app.metricMax !== null) && <>range · </>}
              {app.amenityFilter.size > 0 && <>{app.amenityFilter.size} amenity</>}
            </span>
          </div>
        )}

        <div style={{ padding: '6px 10px', borderRadius: 8, background: glassBg, border: `1px solid ${glassBorder}`, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Crosshair size={10} style={{ color: tm }} />
          <span style={{ color: tm, fontSize: 9, fontFamily: 'monospace' }}>EPSG:4326 · {app.countryCode.toUpperCase()}</span>
        </div>
      </div>

      {/* Top-right: reset selection */}
      {app.selectedDistrictId && (
        <div className="absolute top-4 right-14 z-[1000]">
          <button onClick={() => app.selectDistrict(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: glassBg, border: `1px solid ${glassBorder}`, color: tm, fontSize: 11, backdropFilter: 'blur(10px)' }}>
            <RotateCcw size={11} /> Clear selection
          </button>
        </div>
      )}

      {/* Bottom-left: legend */}
      <div className="absolute bottom-6 left-4 z-[1000] flex flex-col items-start gap-2">
        <button onClick={() => setLegendVisible(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: legendVisible ? (isDark ? `${semColor}18` : `${semColor}12`) : glassBg, border: `1px solid ${legendVisible ? semColor + '50' : glassBorder}`, backdropFilter: 'blur(10px)' }}>
          <Layers size={12} style={{ color: legendVisible ? semColor : tm }} />
          <span style={{ color: legendVisible ? semColor : tm, fontSize: 10, fontWeight: 600 }}>Legend</span>
          <ChevronDown size={10} style={{ color: legendVisible ? semColor : tm, transform: legendVisible ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }} />
        </button>
        <div style={{ overflow: 'hidden', maxHeight: legendVisible ? 320 : 0, opacity: legendVisible ? 1 : 0, transition: 'max-height .25s, opacity .2s', pointerEvents: legendVisible ? 'auto' : 'none' }}>
          <MapLegend isDark={isDark} />
        </div>
      </div>
    </>
  );
}
