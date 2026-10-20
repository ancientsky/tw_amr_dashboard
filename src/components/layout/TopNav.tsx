import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { NAV } from '../../app/nav';
import { useT } from '../../i18n';
import { LogoMark } from '../brand/LogoMark';
import { IconButton } from '../ui/IconButton';
import { LangSwitch } from './LangSwitch';
import { SideNav } from './SideNav';
import { ThemeToggle } from './ThemeToggle';
import s from './layout.module.css';

export function TopNav({ chatSlot }: { chatSlot?: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <header className={s.nav} data-print="hide">
      <div className={`container ${s.navInner}`}>
        <Link to="/" className={s.brand} aria-label={t('app.home')}>
          <span className={s.brandMark}>
            <LogoMark size={30} />
          </span>
          <span className={s.brandText}>
            <span className={s.brandName}>{t('app.name')}</span>
            <span className={s.brandSub}>{t('app.fullName')}</span>
          </span>
        </Link>
        <nav className={s.links} aria-label={t('nav.primary')}>
          {NAV.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'} className={({ isActive }) => [s.link, isActive ? s.linkActive : ''].join(' ')}>
              {({ isActive }) => (
                <>
                  {t(`nav.${n.key}`)}
                  {isActive && <motion.span layoutId="nav-dot" className={s.linkDot} transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={s.tools}>
          <LangSwitch />
          <ThemeToggle />
          {chatSlot}
          <IconButton icon="menu" label={t('nav.openMenu')} className={s.menuBtn} onClick={() => setOpen(true)} aria-expanded={open} />
        </div>
      </div>
      <SideNav open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
