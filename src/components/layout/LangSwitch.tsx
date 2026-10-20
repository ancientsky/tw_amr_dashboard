import { AnimatePresence, motion } from 'framer-motion';
import { useRef, type KeyboardEvent } from 'react';
import { useLocale } from '../../app/providers/LocaleProvider';
import { LOCALES, type Locale } from '../../data/types';
import { useT } from '../../i18n';
import { Icon } from '../ui/icons';
import { usePopover } from '../ui/usePopover';
import s from './layout.module.css';

export function LangSwitch() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const menu = useRef<HTMLDivElement>(null);

  const onKey = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length]?.focus();
    else return;
    e.preventDefault();
  };

  const pick = (l: Locale) => {
    setLocale(l);
    setOpen(false);
  };

  return (
    <div className={s.langWrap} ref={ref}>
      <button
        type="button"
        className={s.langBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('lang.label')}: ${t(`lang.${locale}`)}`}
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
        }}
      >
        <Icon name="globe" size={17} />
        <span>{t(`lang.short.${locale}`)}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            role="menu"
            aria-label={t('lang.label')}
            className={s.langMenu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onKeyDown={onKey}
          >
            {LOCALES.map((l) => (
              <button key={l} type="button" role="menuitemradio" aria-checked={l === locale} lang={l} className={s.langItem} onClick={() => pick(l)}>
                <span className={s.langCheck}>{l === locale && <Icon name="check" size={16} />}</span>
                {t(`lang.${l}`)}
                <span className={s.langCode}>{t(`lang.short.${l}`)}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Inline segmented variant for the mobile drawer. */
export function LangSegmented() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <div role="radiogroup" aria-label={t('lang.label')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          lang={l}
          className={s.langItem}
          style={{ width: 'auto', border: '1px solid var(--line-strong)', background: l === locale ? 'var(--accent-soft)' : undefined, color: l === locale ? 'var(--accent)' : undefined }}
          onClick={() => setLocale(l)}
        >
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
