import { RiskLevel } from './types';

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'minimal';
}

export function getRiskColor(score: number): string {
  const level = getRiskLevel(score);
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    minimal: '#3b82f6',
  };
  return colors[level];
}

export function getRiskLabel(score: number): string {
  const level = getRiskLevel(score);
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function getRiskBgClass(score: number): string {
  const level = getRiskLevel(score);
  const classes = {
    critical: 'bg-red-500/20 border-red-500/40 text-red-400',
    high: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
    medium: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
    low: 'bg-green-500/20 border-green-500/40 text-green-400',
    minimal: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  };
  return classes[level];
}

export function formatPopulation(pop: number): string {
  if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`;
  return pop.toString();
}

export function getFloodColor(score: number): string {
  if (score >= 80) return '#7f1d1d';
  if (score >= 60) return '#dc2626';
  if (score >= 40) return '#f97316';
  if (score >= 20) return '#fbbf24';
  return '#fef3c7';
}

export function getSmogColor(score: number): string {
  if (score >= 80) return '#3b0764';
  if (score >= 60) return '#7c3aed';
  if (score >= 40) return '#a855f7';
  if (score >= 20) return '#c084fc';
  return '#ede9fe';
}

export function generateTimeSeriesData(baseValue: number, days: number = 30) {
  const data = [];
  let value = baseValue;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    value = Math.max(0, Math.min(100, value + (Math.random() - 0.48) * 8));
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.round(value),
    });
  }
  return data;
}

export function getAQICategory(aqi: number): { label: string; color: string } {
  if (aqi <= 50) return { label: 'Good', color: '#22c55e' };
  if (aqi <= 100) return { label: 'Moderate', color: '#eab308' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#a855f7' };
  return { label: 'Hazardous', color: '#7f1d1d' };
}
