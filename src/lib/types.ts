export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';
export type RiskType = 'flood' | 'smog' | 'respiratory';
export type AdminLevel = 'province' | 'district';
export type TrendType = 'rising' | 'stable' | 'falling';

export const RISK_TYPE_CONFIG: Record<RiskType, { label: string; description: string; color: string; mapColors: string[] }> = {
  flood: {
    label: 'Flood Risk',
    description: 'River flooding & early warning',
    color: '#3b82f6',
    mapColors: ['#bfdbfe', '#60a5fa', '#f59e0b', '#ea580c', '#b91c1c'],
  },
  smog: {
    label: 'Smog / Air Quality',
    description: 'Particulate matter & haze',
    color: '#a855f7',
    mapColors: ['#e9d5ff', '#c084fc', '#f59e0b', '#ea580c', '#7c3aed'],
  },
  respiratory: {
    label: 'Respiratory Infection',
    description: 'Pollution-linked health risk',
    color: '#14b8a6',
    mapColors: ['#ccfbf1', '#5eead4', '#f59e0b', '#ea580c', '#115e59'],
  },
};

export interface DistrictData {
  province: string;
  smog_risk: number;
  flood_risk: number;
  ew_flood_risk: number;
  respiratory_risk: number;
  aqi: number;
  pm25: number;
  rainfall_mm: number;
  river_level: number;
  population: number;
  affected_area_pct: number;
  trend: TrendType;
  resp_cases_per_100k: number;
  resp_hospitalization_rate: number;
}

export interface ProvinceData {
  smog_risk: number;
  flood_risk: number;
  ew_flood_risk: number;
  respiratory_risk: number;
  aqi: number;
  pm25: number;
  rainfall_mm: number;
  districts_count: number;
  high_risk_districts: number;
  resp_cases_per_100k: number;
}

export interface RiskData {
  districts: Record<string, DistrictData>;
  provinces: Record<string, ProvinceData>;
}

export interface SelectedRegion {
  level: AdminLevel;
  name: string;
  province?: string;
}
