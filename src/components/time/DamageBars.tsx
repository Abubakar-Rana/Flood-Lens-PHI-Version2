'use client';

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { LENS_BY_KEY, TREND_LENSES, lensColor, type AllTimelines } from '@/lib/types';
import { formatInt } from '@/lib/utils';

echarts.use([BarChart, GridComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

function compact(v: number): string {
  if (!isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 10_000) return `${Math.round(v / 1_000)}K`;
  if (a >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

interface Props {
  all: AllTimelines | null;
  countryCode: string;
  countryName: string;
  isDark: boolean;
  onPickMetric: (metric: string) => void;
  activeMetric: string;
}

/**
 * All four damage measures for one country, as small multiples.
 *
 * Deliberately NOT one clustered bar chart. Bars encode value by length from
 * zero, so every bar in a group must share an axis — and these four measures
 * don't: people affected runs to 33.9M while hospitals affected runs to 469.
 * Put them in one group and three of the four bars are invisible slivers; put
 * a log scale under bars and the lengths stop meaning anything at all.
 *
 * Small multiples solve it properly: four panels, each zero-based on its own
 * scale, sharing an x-axis of years and a fixed hue per measure. Comparing
 * *within* a panel is exact; comparing *across* panels is comparing shapes,
 * which is the honest thing to do with different units. Every bar carries its
 * value as a label so no number depends on reading a pixel length.
 */
export default function DamageBars({
  all, countryCode, countryName, isDark, onPickMetric, activeMetric,
}: Props) {
  const tp = isDark ? '#e8e8e8' : '#111';
  const tm = isDark ? '#7a7a7a' : '#7b7b7b';
  const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const surface = isDark ? '#141414' : '#fff';
  const border = isDark ? '#2e2e2e' : '#e2e8f0';

  const panels = useMemo(() => {
    const country = all?.countries.find(c => c.code === countryCode);
    if (!country) return [];
    return TREND_LENSES
      .map(k => LENS_BY_KEY[k])
      .filter(l => country.series[l.metric]?.length)
      .map(l => ({
        metric: l.metric as string,
        label: all!.labels[l.metric] ?? l.label,
        color: lensColor(l, isDark),
        points: country.series[l.metric],
      }));
  }, [all, countryCode, isDark]);

  const option = useMemo<EChartsOption | null>(() => {
    if (panels.length === 0) return null;
    const n = panels.length;
    const gap = 3.2;                       // % of width between panels
    const w = (100 - gap * (n + 1)) / n;

    const grids: NonNullable<EChartsOption['grid']> = [];
    const xAxes: NonNullable<EChartsOption['xAxis']> = [];
    const yAxes: NonNullable<EChartsOption['yAxis']> = [];
    const titles: NonNullable<EChartsOption['title']> = [];
    const series: NonNullable<EChartsOption['series']> = [];

    panels.forEach((p, i) => {
      const left = gap + i * (w + gap);
      const on = p.metric === activeMetric;

      grids.push({ left: `${left}%`, width: `${w}%`, top: 30, bottom: 24 });
      xAxes.push({
        gridIndex: i, type: 'category',
        data: p.points.map(pt => String(pt.year)),
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: tm, fontSize: 9.5 },
      });
      yAxes.push({
        gridIndex: i, type: 'value', min: 0,       // bars must start at zero
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: grid, type: 'dashed' } },
      });
      titles.push({
        text: p.label, left: `${left}%`, top: 2,
        textStyle: {
          color: on ? p.color : tm, fontSize: 10,
          fontWeight: on ? 'bold' : 'normal',
        },
      });

      series.push({
        name: p.label, type: 'bar', xAxisIndex: i, yAxisIndex: i,
        data: p.points.map(pt => ({
          value: pt.value,
          itemStyle: {
            color: p.color,
            // The projected year is drawn hollow so it can never be mistaken
            // for a measurement at a glance.
            opacity: pt.kind === 'projected' ? 0.32 : (on ? 1 : 0.72),
            borderColor: p.color,
            borderWidth: pt.kind === 'projected' ? 1.5 : 0,
            borderType: pt.kind === 'projected' ? 'dashed' : 'solid',
          },
        })),
        barMaxWidth: 26,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: {
          show: true, position: 'top', color: tp, fontSize: 9.5, fontWeight: 'bold',
          formatter: (d: { value?: unknown }) => compact(Number(d.value)),
        },
        animationDuration: 800,
        animationEasing: 'elasticOut',
        animationDelay: (idx: number) => i * 120 + idx * 70,
      });
    });

    return {
      backgroundColor: 'transparent',
      grid: grids, xAxis: xAxes, yAxis: yAxes, title: titles, series,
      tooltip: {
        trigger: 'item',
        backgroundColor: surface, borderColor: border, borderWidth: 1,
        textStyle: { color: tp, fontSize: 11.5 },
        extraCssText: 'border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.18);',
        formatter: (params: unknown) => {
          const p = params as { seriesName: string; name: string; value: number };
          const projected = p.name === '2027';
          return `<div style="font-weight:700;margin-bottom:3px">${countryName} · ${p.name}${
            projected ? ' (projected)' : ''}</div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span>${p.seriesName}</span><b>${formatInt(p.value)}</b></div>`;
        },
      },
    } as EChartsOption;
  }, [panels, activeMetric, countryName, tp, tm, grid, surface, border]);

  if (!option) {
    return <div style={{ color: tm, fontSize: 10.5, padding: 10 }}>Loading damage figures…</div>;
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
        click: (e: { seriesName?: string }) => {
          const hit = panels.find(p => p.label === e.seriesName);
          if (hit) onPickMetric(hit.metric);
        },
      }}
    />
  );
}
