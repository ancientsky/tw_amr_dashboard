import { useId } from 'react';

export interface SparklineProps {
  values: (number | null)[];
  width?: number;
  height?: number;
  /** colour of the current-period end-dot and line (default accent) */
  color?: string;
  className?: string;
  /** draw a soft area wash under the line */
  area?: boolean;
}

/** Tiny SVG sparkline: muted line, accent end-dot with a surface ring. Decorative (aria-hidden). */
export function Sparkline({ values, width = 120, height = 32, color, className, area = true }: SparklineProps) {
  const gid = useId();
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2));
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  const c = color ?? 'var(--accent)';
  const areaD = `${d}L${x(last.i).toFixed(1)},${height}L${x(pts[0].i).toFixed(1)},${height}Z`;
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.18" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaD} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.i)} cy={y(last.v)} r="3.5" fill={c} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}
