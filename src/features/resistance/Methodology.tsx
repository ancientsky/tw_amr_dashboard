import { useT } from '../../i18n';
import { Icon } from '../../components/ui/icons';
import s from './resistance.module.css';

const ITEMS = ['thas', 'sir', 'ns', 'suppress', 'precision', 'coho', 'dedup', 'firstIsolate'] as const;

/** Collapsible inline methodology (all text in i18n: resistance.method.*). */
export function Methodology({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const t = useT();
  return (
    <details className={s.method} open={defaultOpen}>
      <summary className={s.methodSummary}>
        <Icon name="info" size={18} />
        <span>{t('resistance.method.title')}</span>
        <Icon name="chevron-down" size={16} className={s.methodChev} />
      </summary>
      <dl className={s.methodList}>
        {ITEMS.map((k) => (
          <div key={k} className={s.methodItem}>
            <dt>{t(`resistance.method.${k}.term`)}</dt>
            <dd>{t(`resistance.method.${k}.body`)}</dd>
          </div>
        ))}
      </dl>
      <p className={s.methodMore}>
        <a href="#/about">{t('resistance.method.more')} →</a>
      </p>
    </details>
  );
}
