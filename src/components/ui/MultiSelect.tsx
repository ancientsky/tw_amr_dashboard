import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../../i18n';
import { Icon } from './icons';
import type { SelectOption } from './Select';
import { usePopover } from './usePopover';
import s from './Controls.module.css';

export interface MultiSelectProps<V extends string> {
  options: readonly SelectOption<V>[];
  value: readonly V[];
  onChange: (v: V[]) => void;
  label: string;
  showLabel?: boolean;
  /** max selectable (e.g. 8 to respect the categorical palette) */
  max?: number;
  align?: 'start' | 'end';
  className?: string;
  minWidth?: number;
}

/** Multi-select listbox with checkboxes, select-all / clear, keyboard support (Space toggles). */
export function MultiSelect<V extends string>({
  options,
  value,
  onChange,
  label,
  showLabel,
  max,
  align = 'start',
  className,
  minWidth,
}: MultiSelectProps<V>) {
  const t = useT();
  const id = useId();
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const selected = new Set(value);

  useEffect(() => {
    if (open) requestAnimationFrame(() => list.current?.focus());
  }, [open]);

  const toggle = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (selected.has(o.value)) onChange(value.filter((v) => v !== o.value));
    else if (!max || value.length < max) onChange([...value, o.value]);
  };

  const onKey = (e: KeyboardEvent) => {
    const n = options.length;
    if (e.key === 'ArrowDown') setActive((a) => Math.min(n - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === ' ' || e.key === 'Enter') toggle(active);
    else if (e.key === 'Escape') {
      setOpen(false);
      btn.current?.focus();
    } else return;
    e.preventDefault();
  };

  const summary =
    value.length === 0
      ? t('common.all')
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : value.length === options.length
          ? t('common.all')
          : t('common.selected', { n: value.length });

  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      {showLabel && <span className={s.fieldLabel}>{label}</span>}
      <div className={s.popWrap} ref={ref}>
        <button
          ref={btn}
          type="button"
          className={s.trigger}
          style={minWidth ? { minWidth } : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-label={`${label}: ${summary}`}
          onClick={() => setOpen(!open)}
        >
          <span className={s.triggerText}>{summary}</span>
          <Icon name="chevron-down" size={16} className={s.chev} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              ref={list}
              id={`${id}-list`}
              role="listbox"
              aria-multiselectable="true"
              aria-label={label}
              tabIndex={-1}
              aria-activedescendant={`${id}-opt-${active}`}
              className={[s.listbox, align === 'end' ? s.alignEnd : ''].join(' ')}
              onKeyDown={onKey}
            >
              {options.map((o, i) => {
                const sel = selected.has(o.value);
                const blocked = !sel && !!max && value.length >= max;
                return (
                  <div
                    key={o.value}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={sel}
                    aria-disabled={o.disabled || blocked || undefined}
                    data-active={i === active}
                    className={s.option}
                    style={o.disabled || blocked ? { opacity: 0.45 } : undefined}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => toggle(i)}
                  >
                    <span className={s.box}>{sel && <Icon name="check" size={12} />}</span>
                    {o.color && <span className={s.swatch} style={{ background: o.color }} />}
                    <span>{o.label}</span>
                    {o.hint && <span className={s.optionHint}>{o.hint}</span>}
                  </div>
                );
              })}
              <div className={s.listFoot}>
                {!max && (
                  <button type="button" className={s.linkBtn} onClick={() => onChange(options.filter((o) => !o.disabled).map((o) => o.value))}>
                    {t('actions.selectAll')}
                  </button>
                )}
                <button type="button" className={s.linkBtn} onClick={() => onChange([])}>
                  {t('actions.clear')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
