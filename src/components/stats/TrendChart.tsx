'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { generateTimeSeriesData } from '@/lib/utils';

interface TrendChartProps {
  baseValue: number;
  color: string;
  label: string;
  height?: number;
  isDark: boolean;
}

const CustomTooltip = ({ active, payload, label, isDark }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      padding: '6px 10px', borderRadius: 8,
      background: isDark ? '#0c1426' : '#ffffff',
      border: `1px solid ${isDark ? '#234571' : '#dde3ee'}`,
      color: isDark ? '#dde4ef' : '#0c1829',
      fontSize: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ color: isDark ? '#3f5272' : '#8b9cbd', marginBottom: 2 }}>{label}</div>
      <div style={{ color: payload[0].color, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
        {payload[0].value}
      </div>
    </div>
  );
};

export default function TrendChart({ baseValue, color, label, height = 60, isDark }: TrendChartProps) {
  const data = useMemo(() => generateTimeSeriesData(baseValue, 30), [baseValue]);
  const current = data[data.length - 1]?.value ?? baseValue;
  const gradId = `grad-${label.replace(/\W/g, '')}`;

  return (
    <div className="mb-1">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: isDark ? '#8b9cbd' : '#455474', fontSize: 10 }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{current}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: isDark ? '#3f5272' : '#8b9cbd' }} tickCount={3} />
          <Tooltip content={<CustomTooltip isDark={isDark} />} />
          <Area
            type="monotone" dataKey="value" stroke={color}
            strokeWidth={1.5} fill={`url(#${gradId})`}
            dot={false} activeDot={{ r: 3, fill: color, stroke: isDark ? '#0c1426' : '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
