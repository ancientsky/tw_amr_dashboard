import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import s from './layout.module.css';

export default function NotFound() {
  const t = useT();
  return (
    <div className="container">
      <div className={s.notFound}>
        <div className={s.code404} aria-hidden="true">
          {t('notFound.code')}
        </div>
        <h1 style={{ fontSize: 'var(--fs-xl)' }}>{t('notFound.title')}</h1>
        <p className="muted">{t('notFound.body')}</p>
        <Link to="/" style={{ fontWeight: 600 }}>
          ← {t('notFound.home')}
        </Link>
      </div>
    </div>
  );
}
