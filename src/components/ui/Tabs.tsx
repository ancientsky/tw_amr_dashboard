import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import s from './Controls.module.css';

export interface TabItem<V extends string = string> {
  value: V;
  label: ReactNode;
}

export interface TabsProps<V extends string> {
  items: readonly TabItem<V>[];
  value: V;
  onChange: (v: V) => void;
  label: string;
  className?: string;
  /** id prefix for aria-controls → `${idBase}-panel-${value}` */
  idBase?: string;
}

/** WAI-ARIA tablist with roving focus and animated indicator. Render panels yourself. */
export function Tabs<V extends string>({ items, value, onChange, label, className, idBase }: TabsProps<V>) {
  const auto = useId();
  const base = idBase ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = items.length - 1;
    else return;
    e.preventDefault();
    refs.current[n]?.focus();
    onChange(items[n].value);
  };
  return (
    <div role="tablist" aria-label={label} className={[s.tabs, className].filter(Boolean).join(' ')}>
      {items.map((it, i) => {
        const sel = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            id={`${base}-tab-${it.value}`}
            aria-selected={sel}
            aria-controls={`${base}-panel-${it.value}`}
            tabIndex={sel ? 0 : -1}
            className={s.tab}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {it.label}
            {sel && <motion.span layoutId={`${base}-ind`} className={s.tabIndicator} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </button>
        );
      })}
    </div>
  );
}
