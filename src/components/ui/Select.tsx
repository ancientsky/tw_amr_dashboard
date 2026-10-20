import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './icons';
import { usePopover } from './usePopover';
import s from './Controls.module.css';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  hint?: ReactNode;
  /** colour swatch (e.g. series colour) */
  color?: string;
  disabled?: boolean;
}

export interface SelectProps<V extends string> {
  options: readonly SelectOption<V>[];
  value: V;
  onChange: (v: V) => void;
  /** accessible name (also shown as a visible label when `showLabel`) */
  label: string;
  showLabel?: boolean;
  align?: 'start' | 'end';
  className?: string;
  minWidth?: number;
}

const pop = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] },
};

/** Styled single-select listbox (button + ARIA listbox, keyboard: arrows/Home/End/Enter/Esc/type-ahead). */
export function Select<V extends string>({ options, value, onChange, label, showLabel, align = 'start', className, minWidth }: SelectProps<V>) {
  const id = useId();
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selIdx);
  const typed = useRef({ s: '', t: 0 });

  useEffect(() => {
    if (open) {
      setActive(selIdx);
      requestAnimationFrame(() => list.current?.focus());
    }
  }, [open, selIdx]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };

  const onListKey = (e: KeyboardEvent) => {
    const n = options.length;
    if (e.key === 'ArrowDown') setActive((a) => Math.min(n - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      if (e.key === 'Escape') btn.current?.focus();
      return;
    } else if (e.key.length === 1) {
      const now = Date.now();
      typed.current.s = now - typed.current.t > 600 ? e.key : typed.current.s + e.key;
      typed.current.t = now;
      const q = typed.current.s.toLowerCase();
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(q));
      if (hit >= 0) setActive(hit);
      return;
    } else return;
    e.preventDefault();
  };

  const current = options[selIdx];

  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      {showLabel && (
        <span className={s.fieldLabel} id={`${id}-label`}>
          {label}
        </span>
      )}
      <div className={s.popWrap} ref={ref}>
        <button
          ref={btn}
          type="button"
          className={s.trigger}
          style={minWidth ? { minWidth } : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-label={showLabel ? undefined : `${label}: ${current?.label ?? ''}`}
          aria-labelledby={showLabel ? `${id}-label ${id}-value` : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className={s.triggerText} id={`${id}-value`}>
            {current?.color && <span className={s.swatch} style={{ background: current.color, display: 'inline-block', marginRight: 8 }} />}
            {current?.label ?? '—'}
          </span>
          <Icon name="chevron-down" size={16} className={s.chev} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              {...pop}
              ref={list}
              id={`${id}-list`}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`${id}-opt-${active}`}
              className={[s.listbox, align === 'end' ? s.alignEnd : ''].join(' ')}
              onKeyDown={onListKey}
            >
              {options.map((o, i) => (
                <div
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  data-active={i === active}
                  className={s.option}
                  style={o.disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className={s.optionCheck}>{o.value === value && <Icon name="check" size={16} />}</span>
                  {o.color && <span className={s.swatch} style={{ background: o.color }} />}
                  <span>{o.label}</span>
                  {o.hint && <span className={s.optionHint}>{o.hint}</span>}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
