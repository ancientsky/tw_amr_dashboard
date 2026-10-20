import { Link } from 'react-router-dom';
import { NAV } from '../../app/nav';
import { useMeta } from '../../app/providers/DataProvider';
import { REPO_URL } from '../../app/url';
import { fmtDate } from '../../data/format';
import { useT } from '../../i18n';
import { LogoMark } from '../brand/LogoMark';
import { Icon } from '../ui/icons';
import s from './layout.module.css';

export function Footer() {
  const t = useT();
  const { meta } = useMeta();
  const base = import.meta.env.BASE_URL;
  return (
    <footer className={s.footer}>
      <div className="container">
        <div className={s.footGrid}>
          <div>
            <Link to="/" className={s.brand} aria-label={t('app.home')}>
              <span className={s.brandMark}>
                <LogoMark size={28} />
              </span>
              <span className={s.brandText}>
                <span className={s.brandName}>{t('app.name')}</span>
                <span className={s.brandSub}>{t('app.fullName')}</span>
              </span>
            </Link>
            <p className={s.tagline}>{t('app.tagline')}</p>
          </div>
          <nav aria-label={t('footer.explore')}>
            <div className={s.footHead}>{t('footer.explore')}</div>
            <ul className={s.footLinks}>
              {NAV.filter((n) => n.path !== '/').map((n) => (
                <li key={n.path}>
                  <Link to={n.path}>{t(`nav.${n.key}`)}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <div className={s.footHead}>{t('footer.developers')}</div>
            <ul className={s.footLinks}>
              <li>
                <a href={`${base}api/v1/`}>
                  {t('footer.api')}
                  <Icon name="external" size={12} />
                </a>
              </li>
              <li>
                <a href={`${REPO_URL}/blob/main/docs/EMBED.md`} target="_blank" rel="noreferrer">
                  {t('footer.embed')}
                  <Icon name="external" size={12} />
                </a>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  {t('footer.github')}
                  <Icon name="external" size={12} />
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className={s.footHead}>{t('footer.sources')}</div>
            <p className={s.footText}>{t('footer.sourcesBody')}</p>
            <div className={s.footHead}>{t('footer.disclaimer')}</div>
            <p className={s.footText}>{t('footer.disclaimerBody')}</p>
          </div>
        </div>
        <div className={s.footBottom}>
          <span>© {new Date().getFullYear()} {t('app.name')} · {t('footer.license')}</span>
          {meta?.lastBuild && <span className="tnum">{t('footer.lastBuild', { date: fmtDate(meta.lastBuild, t.locale) })}</span>}
        </div>
      </div>
    </footer>
  );
}
