import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useT } from '../../i18n';
import { Icon } from '../ui/icons';
import s from './layout.module.css';

export function ThemeToggle() {
  const t = useT();
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? t('theme.toLight') : t('theme.toDark');
  return (
    <button type="button" className={s.themeBtn} onClick={toggle} aria-label={label} title={label}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -40 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 40 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'grid' }}
        >
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
