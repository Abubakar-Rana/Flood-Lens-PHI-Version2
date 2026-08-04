'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent, LegendComponent, MarkAreaComponent,
  TitleComponent, TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { countryColor, type MonthlyYear } from '@/lib/types';
import { formatInt } from '@/lib/utils';

// Register only what this chart draws — the full echarts bundle is several
// times larger and none of the rest is used anywhere in the app.
echarts.use([
  LineChart, GridComponent, LegendComponent, MarkAreaComponent,
  TitleComponent, TooltipComponent, CanvasRenderer,
]);

/** Y-axis tick form: short enough for a narrow gutter. */
function tick(v: number): string {
  if (!isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(Math.round(v));
}

interface Props {
  monthly: MonthlyYear | null;
  yearId: string;
  activeCountry: string;
  onPickCountry: (code: string) => void;
  isDark: boolean;
}

/**
 * Flood exposure through one year, month by month, for every country.
 *
 * The y-axis is logarithmic because within a single month the countries span
 * 34.7M (India) to 1,000 (Bhutan) — five orders of magnitude. Linear would
 * flatten four of the six onto the baseline. A second axis would be worse: two
 * arbitrary scales side by side invent relationships the data doesn't contain.
 *
 * Months with no recorded flooding are left as gaps rather than plotted as
 * zero. Zero on a log axis is undefined, but more importantly "not flooded"
 * and "not surveyed" are different claims, and neither is "zero people".
 */
export default function SeasonChart({
  monthly, yearId, activeCountry, onPickCountry, isDark,
}: Props) {
  const tp = isDark ? '#e8e8e8' : '#111';
  const tm = isDark ? '#7a7a7a' : '#7b7b7b';
  const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const surface = isDark ? '#141414' : '#fff';
  const border = isDark ? '#2e2e2e' : '#e2e8f0';

  const option = useMemo<EChartsOption | null>(() => {
    if (!monthly) return null;

    const series: NonNullable<EChartsOption['series']> = [];

    for (const c of monthly.countries) {
      const color = countryColor(c.code, isDark);
      const on = c.code === activeCountry;
      const hasData = c.values.some(v => v != null && v > 0);
      if (!hasData) continue;

      // Uncertainty band, drawn as a transparent lower bound plus a stacked
      // ribbon on top of it. Only for a surveyed season — a single observed
      // event has no month-to-month spread to shade.
      if (monthly.continuous) {
        const lower = c.values.map(v => (v == null ? null : v * (1 - c.spread)));
        const width = c.values.map(v => (v == null ? null : v * 2 * c.spread));
        series.push({
          name: `${c.name}__lo`, type: 'line', stack: `band-${c.code}`,
          data: lower, symbol: 'none', lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 }, silent: true, legendHoverLink: false,
          tooltip: { show: false }, animationDuration: 700, z: 1,
        });
        series.push({
          name: `${c.name}__hi`, type: 'line', stack: `band-${c.code}`,
          data: width, symbol: 'none', lineStyle: { opacity: 0 },
          areaStyle: { color, opacity: on ? 0.16 : 0.06 },
          silent: true, legendHoverLink: false, tooltip: { show: false },
          animationDuration: 700, z: 1,
        });
      }

      series.push({
        name: c.name,
        type: 'line',
        data: c.values,
        // Monotone smoothing: it curves without overshooting into peaks that
        // were never recorded between two months.
        smooth: monthly.continuous ? 0.35 : false,
        smoothMonotone: 'x',
        connectNulls: false,
        symbol: 'circle',
        symbolSize: on ? 9 : 6,
        showSymbol: true,
        lineStyle: { color, width: on ? 3.4 : 1.9, opacity: on ? 1 : 0.55 },
        itemStyle: { color, borderColor: surface, borderWidth: 2 },
        emphasis: { focus: 'series', lineStyle: { width: on ? 4 : 3 } },
        z: on ? 12 : 6,
        animationDuration: 1100,
        animationEasing: 'cubicOut',
        animationDelay: (i: number) => i * 55,
      });
    }

    // Shade the months that actually carry observations.
    const firstIdx = monthly.countries.reduce((m, c) => {
      const i = c.values.findIndex(v => v != null && v > 0);
      return i >= 0 ? Math.min(m, i) : m;
    }, 11);
    const lastIdx = monthly.countries.reduce((m, c) => {
      let last = -1;
      c.values.forEach((v, i) => { if (v != null && v > 0) last = i; });
      return Math.max(m, last);
    }, 0);

    if (series.length && firstIdx <= lastIdx) {
      const line = series[series.length - 1] as Record<string, unknown>;
      line.markArea = {
        silent: true,
        itemStyle: { color: isDark ? 'rgba(200,169,81,0.05)' : 'rgba(200,169,81,0.09)' },
        data: [[
          { xAxis: monthly.months[firstIdx], label: {
            show: true, position: 'insideTop', color: tm, fontSize: 9,
            formatter: monthly.continuous ? 'flood season' : 'observed event' } },
          { xAxis: monthly.months[lastIdx] },
        ]],
      };
    }

    return {
      backgroundColor: 'transparent',
      animation: true,
      grid: { top: 14, right: 14, bottom: 24, left: 52, containLabel: false },
      legend: {
        show: true, top: 0, right: 0, itemGap: 12, itemWidth: 14, itemHeight: 3,
        icon: 'roundRect',
        textStyle: { color: tm, fontSize: 10 },
        // Band helpers are named with a __ suffix so they never reach the
        // legend; only the real country lines are selectable.
        data: monthly.countries
          .filter(c => c.values.some(v => v != null && v > 0))
          .map(c => ({
            name: c.name,
            textStyle: {
              color: c.code === activeCountry ? countryColor(c.code, isDark) : tm,
              fontWeight: c.code === activeCountry ? 'bold' : 'normal',
            },
          })),
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderColor: border,
        borderWidth: 1,
        textStyle: { color: tp, fontSize: 11.5 },
        extraCssText: 'border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.18);',
        axisPointer: { type: 'line', lineStyle: { color: tm, opacity: 0.45 } },
        formatter: (params: unknown) => {
          const rows = (params as Array<{
            seriesName: string; value: number | null; marker: string; name: string;
          }>).filter(p => !p.seriesName.includes('__') && p.value != null);
          if (rows.length === 0) return '';
          const head = `<div style="font-weight:700;margin-bottom:4px">${rows[0].name} ${yearId}</div>`;
          const body = rows
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .map(p => `<div style="display:flex;justify-content:space-between;gap:16px">
                 <span>${p.marker} ${p.seriesName}</span>
                 <b>${formatInt(p.value as number)}</b></div>`)
            .join('');
          return head + body;
        },
      },
      xAxis: {
        type: 'category',
        data: monthly.months,
        boundaryGap: false,
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: tm, fontSize: 10 },
      },
      yAxis: {
        type: 'log',
        logBase: 10,
        min: 1000,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: grid } },
        axisLabel: { color: tm, fontSize: 9, formatter: (v: number) => tick(v) },
      },
      series,
    } as EChartsOption;
  }, [monthly, activeCountry, isDark, yearId, tp, tm, grid, surface, border]);

  if (!option) {
    return <div style={{ color: tm, fontSize: 10.5, padding: 10 }}>Loading season…</div>;
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
          const hit = monthly?.countries.find(c => c.name === e.name);
          if (hit) onPickCountry(hit.code);
        },
        click: (e: { seriesName?: string }) => {
          const hit = monthly?.countries.find(c => c.name === e.seriesName);
          if (hit) onPickCountry(hit.code);
        },
      }}
    />
  );
}
