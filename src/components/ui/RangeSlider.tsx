import { useId, type CSSProperties } from 'react';
import s from './Controls.module.css';

export interface RangeSliderProps {
  min: number;
  max: number;
  value: readonly [number, number];
  onChange: (v: [number, number]) => void;
  step?: number;
  label: string;
  showLabel?: boolean;
  /** render tick labels under the track (default: endpoints only) */
  ticks?: number[];
  format?: (v: number) => string;
  className?: string;
}

/** Dual-thumb range (year range). Two native range inputs → full keyboard + screen-reader support. */
export function RangeSlider({ min, max, value, onChange, step = 1, label, showLabel = true, ticks, format = String, className }: RangeSliderProps) {
  const id = useId();
  const [a, b] = value;
  const span = Math.max(1, max - min);
  const left = ((a - min) / span) * 100;
  const right = ((b - min) / span) * 100;
  const fill: CSSProperties = { left: `${left}%`, width: `${Math.max(0, right - left)}%` };
  return (
    <div className={[s.range, className].filter(Boolean).join(' ')} role="group" aria-labelledby={`${id}-l`}>
      <div className={s.rangeHead}>
        <span id={`${id}-l`} className={showLabel ? s.fieldLabel : 'sr-only'}>
          {label}
        </span>
        <span aria-hidden="true">
          {format(a)} – {format(b)}
        </span>
      </div>
      <div className={s.track}>
        <div className={s.rail} />
        <div className={s.fill} style={fill} />
        <input
          className={s.thumbInput}
          type="range"
          min={min}
          max={max}
          step={step}
          value={a}
          aria-label={`${label} — from`}
          aria-valuetext={format(a)}
          onChange={(e) => onChange([Math.min(Number(e.target.value), b), b])}
          style={{ zIndex: a > max - (max - min) * 0.1 ? 3 : 2 }}
        />
        <input
          className={s.thumbInput}
          type="range"
          min={min}
          max={max}
          step={step}
          value={b}
          aria-label={`${label} — to`}
          aria-valuetext={format(b)}
          onChange={(e) => onChange([a, Math.max(Number(e.target.value), a)])}
          style={{ zIndex: 2 }}
        />
      </div>
      <div className={s.ticks} aria-hidden="true">
        {(ticks ?? [min, max]).map((t) => (
          <span key={t}>{format(t)}</span>
        ))}
      </div>
    </div>
  );
}
