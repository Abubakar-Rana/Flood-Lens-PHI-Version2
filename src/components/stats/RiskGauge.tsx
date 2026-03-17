'use client';

import { getRiskColor, getRiskLabel } from '@/lib/utils';

interface RiskGaugeProps {
  score: number;
  label: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showArc?: boolean;
}

export default function RiskGauge({ score, label, icon, size = 'md', showArc = true }: RiskGaugeProps) {
  const color = getRiskColor(score);
  const riskLabel = getRiskLabel(score);

  const dims = { sm: 72, md: 96, lg: 120 };
  const strokes = { sm: 5, md: 7, lg: 9 };
  const s = dims[size];
  const strokeW = strokes[size];
  const cx = s / 2;
  const cy = s / 2;
  const r = cx - strokeW / 2 - 2;

  // Arc: 220deg sweep starting at -200deg (bottom-left)
  const startAngle = -220;
  const sweepAngle = 260; // total arc degrees
  const fillAngle = (score / 100) * sweepAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (startDeg: number, endDeg: number) => {
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const bgPath = arcPath(startAngle, startAngle + sweepAngle);
  const fillPath = score > 0 ? arcPath(startAngle, startAngle + fillAngle) : '';

  // Tick marks
  const ticks = [0, 25, 50, 75, 100].map(v => {
    const angle = startAngle + (v / 100) * sweepAngle;
    const rad = toRad(angle);
    const outerR = r + strokeW / 2 + 2;
    const innerR = r - strokeW / 2 - 2;
    return {
      x1: cx + outerR * Math.cos(rad),
      y1: cy + outerR * Math.sin(rad),
      x2: cx + innerR * Math.cos(rad),
      y2: cy + innerR * Math.sin(rad),
    };
  });

  const fontSize = size === 'sm' ? 13 : size === 'md' ? 18 : 24;
  const subFontSize = size === 'sm' ? 6 : size === 'md' ? 7 : 9;
  const labelFontSize = size === 'sm' ? 7 : size === 'md' ? 8 : 10;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: s, height: s }}>
        <svg width={s} height={s} style={{ overflow: 'visible' }}>
          {/* Background arc */}
          <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} strokeLinecap="round" />

          {/* Filled arc */}
          {fillPath && (
            <path d={fillPath} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color}80)` }} />
          )}

          {/* Tick marks */}
          {ticks.map((tick, i) => (
            <line key={i} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeLinecap="round" />
          ))}

          {/* Score text */}
          <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={fontSize} fontWeight="800" fill={color} fontFamily="monospace"
            style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}>
            {score}
          </text>
          <text x={cx} y={cy + fontSize / 2 + 2} textAnchor="middle"
            fontSize={subFontSize} fill="rgba(255,255,255,0.3)" fontFamily="monospace">
            /100
          </text>
        </svg>

        {/* Center icon */}
        {icon && (
          <div className="absolute" style={{ top: '60%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            {icon}
          </div>
        )}
      </div>

      <div className="text-center mt-1">
        <div className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: color + '20', color, border: `1px solid ${color}40`, fontSize: subFontSize + 1 }}>
          {riskLabel}
        </div>
        <div className="mt-0.5 text-xs font-medium" style={{ color: '#94a3b8', fontSize: labelFontSize }}>
          {label}
        </div>
      </div>
    </div>
  );
}
