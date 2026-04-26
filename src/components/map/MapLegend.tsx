'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/state';
import { loadStats } from '@/lib/data';
import { METRIC_BY_KEY, type StatsTable } from '@/lib/types';
import { formatMetric, getRamp, quantileBreaks, metricValues } from '@/lib/utils';

export default function MapLegend({ isDark }: { isDark: boolean }) {
  const app = useApp();
  const [stats, setStats] = useState<StatsTable | null>(null);

  useEffect(() => { loadStats(app.countryCode).then(setStats); }, [app.countryCode]);

  const m = METRIC_BY_KEY[app.metric];
  const ramp = getRamp(m.semantics, isDark);

  let breaks: number[] = [];
  if (stats) {
    const filterIds = (() => {
      if (app.provinceFilter.size === 0) return undefined;
      const allowed = new Set<string>();
      for (const [id, d] of Object.entries(stats)) {
        if (app.provinceFilter.has(d.parent_id ?? '')) allowed.add(id);
      }
      return allowed;
    })();
    breaks = quantileBreaks(metricValues(stats, app.metric, filterIds), 5);
  }

  const bg = isDark ? 'rgba(17,17,17,0.92)' : 'rgba(255,255,255,0.94)';
  const border = isDark ? '#2e2e2e' : '#d6e0eb';
  const tp = isDark ? '#fff' : '#111';
  const tm = isDark ? '#888' : '#666';

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: 10, minWidth: 200, backdropFilter: 'blur(10px)' }}>
      <div style={{ color: tp, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{m.short}</div>
      <div style={{ color: tm, fontSize: 9, marginBottom: 8 }}>{m.label}{m.unit ? ` (${m.unit})` : ''}</div>
      {breaks.length === 5 ? (
        <div>
          {ramp.map((c, i) => {
            const lo = i === 0 ? 0 : (breaks[i - 1] ?? 0);
            const hi = breaks[i] ?? 0;
            const text = i === 0
              ? `≤ ${formatMetric(hi, m)}`
              : i === 4
                ? `> ${formatMetric(breaks[i - 1] ?? hi, m)}`
                : `${formatMetric(lo, m)} – ${formatMetric(hi, m)}`;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ width: 18, height: 10, background: c, borderRadius: 2, flexShrink: 0, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} />
                <span style={{ color: tp, fontSize: 10, fontFamily: 'monospace' }}>{text}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 10, background: isDark ? '#1a1a1a' : '#e5e7eb', borderRadius: 2, flexShrink: 0, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} />
            <span style={{ color: tm, fontSize: 9 }}>Filtered out / no data</span>
          </div>
        </div>
      ) : (
        <div style={{ color: tm, fontSize: 10 }}>Loading…</div>
      )}
    </div>
  );
}
