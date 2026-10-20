import type { CSSProperties, ReactNode } from 'react';
import { useT } from '../../i18n';
import { fmtDelta } from '../../data/format';
import { AnimatedNumber } from './AnimatedNumber';
import { Icon } from './icons';
import { Sparkline } from './Sparkline';
import s from './Kpi.module.css';

export interface KpiProps {
  label: ReactNode;
  value: number | null | undefined;
  /** formatter for the main value (default: 1 decimal) */
  format?: (v: number) => string;
  /** unit rendered after the number, e.g. '%' */
  unit?: ReactNode;
  /** signed change vs comparison period (same units as value, e.g. pp) */
  delta?: number | null;
  /** label for the comparison, e.g. "vs 2023" */
  deltaLabel?: ReactNode;
  /** unit suffix shown with the delta, e.g. 'pp' */
  deltaUnit?: string;
  /** direction considered good — resistance going up is bad → 'down' (default) */
  goodDirection?: 'up' | 'down' | 'none';
  /** sparkline values (12 points ideal); null = gap */
  trend?: (number | null)[];
  /** custom node in the sparkline slot (overrides `trend`) */
  sparkline?: ReactNode;
  /** small chip(s) top-right (e.g. provisional / precision badge) */
  badge?: ReactNode;
  caption?: ReactNode;
  /** accent colour for the top hairline + sparkline end-dot */
  accent?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Stat tile: label · animated value · signed delta (colour = direction × good/bad) ·
 * optional sparkline. Hero values use proportional figures (dataviz figure contract).
 */
export function Kpi({
  label,
  value,
  format = (v) => v.toFixed(1),
  unit,
  delta,
  deltaLabel,
  deltaUnit,
  goodDirection = 'down',
  trend,
  sparkline,
  badge,
  caption,
  accent,
  onClick,
  className,
}: KpiProps) {
  const t = useT();
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const dir = !hasDelta || Math.abs(delta) < 0.05 ? 0 : delta > 0 ? 1 : -1;
  const tone =
    dir === 0 || goodDirection === 'none'
      ? s.neutral
      : (dir > 0) === (goodDirection === 'up')
        ? s.good
        : s.bad;
  const style = accent ? ({ '--kpi-accent': accent } as CSSProperties) : undefined;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={[s.kpi, onClick ? s.interactive : '', className].filter(Boolean).join(' ')}
      style={style}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className={s.head}>
        <span className={s.label}>{label}</span>
        {badge}
      </div>
      <div className={s.valueRow}>
        <AnimatedNumber className={s.value} value={value} format={format} />
        {unit && value !== null && value !== undefined ? <span className={s.unit}>{unit}</span> : null}
      </div>
      <div className={s.foot}>
        {hasDelta ? (
          <span>
            <span className={`${s.delta} ${tone}`}>
              {dir !== 0 && <Icon name={dir > 0 ? 'arrow-up' : 'arrow-down'} size={12} />}
              {fmtDelta(delta, t.locale)}
              {deltaUnit ? ` ${deltaUnit}` : ''}
            </span>
            {deltaLabel && <span className={s.deltaNote}>{deltaLabel}</span>}
          </span>
        ) : (
          <span />
        )}
        {sparkline ??
          (trend && trend.length > 1 ? (
            <Sparkline className={s.spark} values={trend} color={accent} />
          ) : null)}
      </div>
      {caption && <div className={s.caption}>{caption}</div>}
    </Tag>
  );
}
