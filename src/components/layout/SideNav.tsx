import { NavLink } from 'react-router-dom';
import { NAV } from '../../app/nav';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useT } from '../../i18n';
import { Drawer } from '../ui/Modal';
import { Icon } from '../ui/icons';
import { SegmentedControl } from '../ui/SegmentedControl';
import { LangSegmented } from './LangSwitch';
import s from './layout.module.css';

/** Mobile navigation drawer. */
export function SideNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { theme, setTheme } = useTheme();
  return (
    <Drawer open={open} onClose={onClose} title={t('nav.menu')} side="right" width={360}>
      <nav aria-label={t('nav.primary')}>
        <ul className={s.sideList}>
          {NAV.map((n) => (
            <li key={n.path}>
              <NavLink
                to={n.path}
                end={n.path === '/'}
                onClick={onClose}
                className={({ isActive }) => [s.sideLink, isActive ? s.sideLinkActive : ''].join(' ')}
              >
                {t(`nav.${n.key}`)}
                <Icon name="chevron-right" size={16} />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={s.sideTools}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t('lang.label')}
          </div>
          <LangSegmented />
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t('theme.label')}
          </div>
          <SegmentedControl
            label={t('theme.label')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('theme.light') },
              { value: 'dark', label: t('theme.dark') },
            ]}
          />
        </div>
      </div>
    </Drawer>
  );
}
