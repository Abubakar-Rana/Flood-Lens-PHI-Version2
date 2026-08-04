'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent, LegendComponent, MarkLineComponent, TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { countryColor, type AllTimelines } from '@/lib/types';
import { formatInt } from '@/lib/utils';

echarts.use([
  LineChart, GridComponent, LegendComponent, MarkLineComponent,
  TooltipComponent, CanvasRenderer,
]);

function tick(v: number): string {
  if (!isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(Math.round(v));
}

interface Props {
  all: AllTimelines | null;
  metricKey: string;
  activeCountry: string;
  scrubYear: number;
  onScrub: (y: number) => void;
  onPickCountry: (code: string) => void;
  isDark: boolean;
}

/**
 * One measure, six countries, 2025 → 2026 → projected 2027.
 *
 * Measured years are drawn solid; the 2027 leg is dotted, because the change
 * from "what satellites recorded" to "what a model expects" is the single most
 * important thing a reader can misread here. Log axis for the same reason as
 * the season chart — India and Bhutan are four orders of magnitude apart.
 */
export default function TrendChart({
  all, metricKey, activeCountry, scrubYear, onScrub, onPickCountry, isDark,
}: Props) {
  const tp = isDark ? '#e8e8e8' : '#111';
  const tm = isDark ? '#7a7a7a' : '#7b7b7b';
  const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const surface = isDark ? '#141414' : '#fff';
  const border = isDark ? '#2e2e2e' : '#e2e8f0';

  const tracks = useMemo(() => (all?.countries ?? [])
    .filter(c => c.series[metricKey]?.length)
    .map(c => ({ code: c.code, name: c.name, points: c.series[metricKey] })),
    [all, metricKey]);

  const option = useMemo<EChartsOption | null>(() => {
    if (tracks.length === 0) return null;
    const years = (all?.years ?? [2025, 2026, 2027]).map(String);
    const series: NonNullable<EChartsOption['series']> = [];

    for (const t of tracks) {
      const color = countryColor(t.code, isDark);
      const on = t.code === activeCountry;
      const byYear = (y: number) => t.points.find(p => p.year === y)?.value ?? null;

      // Split into a measured leg and a projected leg so each can carry its
      // own dash pattern; they share the 2026 point so the line stays joined.
      series.push({
        name: t.name, type: 'line',
        data: [byYear(2025), byYear(2026), null],
        smooth: 0.3, smoothMonotone: 'x', connectNulls: false,
        symbol: 'circle', symbolSize: on ? 9 : 6,
        lineStyle: { color, width: on ? 3.4 : 1.9, opacity: on ? 1 : 0.55 },
        itemStyle: { color, borderColor: surface, borderWidth: 2 },
        emphasis: { focus: 'series' },
        z: on ? 12 : 6,
        animationDuration: 1000, animationEasing: 'cubicOut',
      });
      series.push({
        name: `${t.name}__proj`, type: 'line',
        data: [null, byYear(2026), byYear(2027)],
        smooth: 0.3, smoothMonotone: 'x', connectNulls: false,
        symbol: 'emptyCircle', symbolSize: on ? 8 : 6,
        lineStyle: { color, width: on ? 3.2 : 1.8, opacity: on ? 0.95 : 0.5, type: 'dotted' },
        itemStyle: { color, borderColor: surface, borderWidth: 2 },
        z: on ? 11 : 5, legendHoverLink: false,
        animationDuration: 1000, animationDelay: 380, animationEasing: 'cubicOut',
      });
    }

    // Mark where measurement stops.
    const last = series[series.length - 1] as Record<string, unknown>;
    last.markLine = {
      silent: true, symbol: 'none',
      lineStyle: { color: tm, type: 'dashed', opacity: 0.5 },
      label: { show: true, formatter: 'projected →', color: tm, fontSize: 9, position: 'insideEndTop' },
      data: [{ xAxis: '2026' }],
    };

    return {
      backgroundColor: 'transparent',
      grid: { top: 14, right: 14, bottom: 24, left: 52, containLabel: false },
      legend: {
        show: true, top: 0, right: 0, itemGap: 12, itemWidth: 14, itemHeight: 3,
        icon: 'roundRect', textStyle: { color: tm, fontSize: 10 },
        data: tracks.map(t => ({
          name: t.name,
          textStyle: {
            color: t.code === activeCountry ? countryColor(t.code, isDark) : tm,
            fontWeight: t.code === activeCountry ? 'bold' : 'normal',
          },
        })),
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface, borderColor: border, borderWidth: 1,
        textStyle: { color: tp, fontSize: 11.5 },
        extraCssText: 'border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.18);',
        axisPointer: { type: 'line', lineStyle: { color: tm, opacity: 0.45 } },
        formatter: (params: unknown) => {
          const arr = params as Array<{
            seriesName: string; value: number | null; marker: string; name: string;
          }>;
          const projected = arr[0]?.name === '2027';
          // Both legs share the 2026 point; keep one row per country.
          const seen = new Set<string>();
          const rows = arr.filter(p => {
            const base = p.seriesName.replace('__proj', '');
            if (p.value == null || seen.has(base)) return false;
            seen.add(base);
            return true;
          });
          if (rows.length === 0) return '';
          const head = `<div style="font-weight:700;margin-bottom:4px">${arr[0].name}${
            projected ? ' · projected' : ' · measured'}</div>`;
          return head + rows
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .map(p => `<div style="display:flex;justify-content:space-between;gap:16px">
                 <span>${p.marker} ${p.seriesName.replace('__proj', '')}</span>
                 <b>${formatInt(p.value as number)}</b></div>`)
            .join('');
        },
      },
      xAxis: {
        type: 'category', data: years, boundaryGap: false,
        axisLine: { lineStyle: { color: grid } }, axisTick: { show: false },
        axisLabel: {
          fontSize: 11, fontWeight: 'bold',
          color: (v: string) => (Number(v) === scrubYear ? tp : tm),
        },
      },
      yAxis: {
        type: 'log', logBase: 10, min: 1,
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: grid } },
        axisLabel: { color: tm, fontSize: 9, formatter: (v: number) => tick(v) },
      },
      series,
    } as EChartsOption;
  }, [tracks, all, activeCountry, scrubYear, isDark, tp, tm, grid, surface, border]);

  if (!option) {
    return (
      <div style={{ color: tm, fontSize: 10.5, padding: '18px 8px', lineHeight: 1.6 }}>
        <strong style={{ color: tp }}>Land flooded</strong> is only measured during an observed
        flood, so there is no 2025 figure to compare against. Pick another measure to see
        all six countries year on year.
      </div>
    );
  }

  return (
    <ReactECharts
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      style={{ width: '100%', height: '100%', minHeight: 170 }}
      opts={{ renderer: 'canvas' }}
      onEvents={{
        legendselectchanged: (e: { name: string }) => {
          const hit = tracks.find(t => t.name === e.name);
          if (hit) onPickCountry(hit.code);
        },
        click: (e: { seriesName?: string; name?: string }) => {
          const y = Number(e?.name);
          if (isFinite(y)) onScrub(y);
          const hit = tracks.find(t => t.name === (e.seriesName ?? '').replace('__proj', ''));
          if (hit) onPickCountry(hit.code);
        },
      }}
    />
  );
}
