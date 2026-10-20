import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { REPO_URL } from '../../app/url';
import { useOptionalDataset } from '../../data/load';
import type { DatasetName } from '../../data/types';
import { useT } from '../../i18n';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/icons';
import s from './layout.module.css';

type Name = Exclude<DatasetName, 'meta'>;

/** True if any of the (up to 3) datasets' envelopes says provisional. Hooks are fixed-count. */
function useAnyProvisional(datasets: readonly Name[]): boolean {
  const a = useOptionalDataset(datasets[0]);
  const b = useOptionalDataset(datasets[1]);
  const c = useOptionalDataset(datasets[2]);
  return [a, b, c].some((d) => Boolean(d.data && (d.data as { provisional?: boolean }).provisional));
}

/**
 * Per-dataset provenance notice: rendered only when one of `datasets` has
 * `provisional: true` in its own envelope (resistance/isolates are real → no banner).
 * 'site' variant (overview) summarises which sections are still provisional.
 */
export function ProvisionalBanner({ datasets, variant = 'section' }: { datasets: readonly Name[]; variant?: 'section' | 'site' }) {
  const t = useT();
  const key = `twamr.banner.${variant}.${datasets.join('+')}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const show = useAnyProvisional(datasets) && !dismissed && datasets.length > 0;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.aside
          key={key}
          className={s.banner}
          role="note"
          aria-label={t('provisional.title')}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          data-print="hide"
        >
          <div className={`container ${s.bannerInner}`}>
            <Icon name="info" size={18} className={s.bannerIcon} />
            <p className={s.bannerText}>
              <strong>{t('provisional.title')}</strong>
              {variant === 'site' ? t('provisional.siteBody') : t('provisional.body')}
              <a href={`${REPO_URL}#adding-reports`} target="_blank" rel="noreferrer">
                {t('provisional.howTo')} →
              </a>
            </p>
            <IconButton
              size="sm"
              icon="close"
              label={t('provisional.dismiss')}
              onClick={() => {
                setDismissed(true);
                try {
                  sessionStorage.setItem(key, '1');
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
