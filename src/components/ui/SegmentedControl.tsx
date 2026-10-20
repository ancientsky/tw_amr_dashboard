import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import s from './Controls.module.css';

export interface SegmentOption<V extends string = string> {
  value: V;
  label: ReactNode;
  title?: string;
}

export interface SegmentedControlProps<V extends string> {
  options: readonly SegmentOption<V>[];
  value: V;
  onChange: (v: V) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Radio-group segmented control with sliding pill (arrow keys move selection). */
export function SegmentedControl<V extends string>({ options, value, onChange, label, size = 'md', className }: SegmentedControlProps<V>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    refs.current[n]?.focus();
    onChange(options[n].value);
  };
  return (
    <div role="radiogroup" aria-label={label} className={[s.segmented, size === 'sm' ? s.sm : '', className].filter(Boolean).join(' ')}>
      {options.map((o, i) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            title={o.title}
            className={s.segment}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {sel && <motion.span layoutId={`${id}-pill`} className={s.segmentPill} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
