import { Icon, type IconName } from '../../components/ui';
import { useT } from '../../i18n';
import s from './dataApi.module.css';

const FACTS: { key: 'cors' | 'caching' | 'versioning' | 'licence'; icon: IconName }[] = [
  { key: 'cors', icon: 'globe' },
  { key: 'caching', icon: 'sort' },
  { key: 'versioning', icon: 'code' },
  { key: 'licence', icon: 'info' },
];

/** CORS, caching, versioning and licence notes for the static API. */
export function ApiFacts() {
  const t = useT();
  return (
    <ul className={s.facts}>
      {FACTS.map((f) => (
        <li key={f.key} className={s.fact}>
          <span className={s.factIcon}>
            <Icon name={f.icon} size={18} />
          </span>
          <div>
            <h3 className={s.factTitle}>{t(`data.api.facts.${f.key}.t`)}</h3>
            <p className={s.factBody}>{t(`data.api.facts.${f.key}.d`)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
