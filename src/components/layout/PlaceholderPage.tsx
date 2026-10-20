import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { NavItem } from '../../app/nav';
import { useT } from '../../i18n';
import { Skeleton } from '../ui/Skeleton';
import { PageHeader } from './PageHeader';
import s from './layout.module.css';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Styled placeholder for a route that another agent will implement:
 * i18n title/subtitle + "coming online" notice + skeleton grid.
 */
export function PlaceholderPage({ pageKey, children, hero }: { pageKey: NavItem['key']; children?: ReactNode; hero?: boolean }) {
  const t = useT();
  return (
    <div className="container">
      <PageHeader
        hero={hero}
        eyebrow={t(`pages.${pageKey}.eyebrow`)}
        title={t(`pages.${pageKey}.title`)}
        subtitle={t(`pages.${pageKey}.subtitle`)}
      />
      {children ?? (
        <>
          <div className={s.comingOnline} role="status">
            <span className={s.pulse} aria-hidden="true" />
            <span>
              <strong style={{ color: 'var(--ink)', marginRight: 8 }}>{t('common.comingOnline')}</strong>
              {t('common.comingOnlineBody')}
            </span>
          </div>
          <SkeletonGrid />
        </>
      )}
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <motion.div className={s.placeholderGrid} variants={stagger} initial="hidden" animate="show" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.div key={i} className={`${s.phCard} ${s.phKpi}`} variants={item}>
          <Skeleton width="55%" height={12} />
          <Skeleton width="40%" height={34} radius={8} />
          <Skeleton width="70%" height={10} />
        </motion.div>
      ))}
      <motion.div className={`${s.phCard} ${s.phWide}`} variants={item}>
        <Skeleton width="35%" height={14} />
        <Skeleton width="55%" height={10} />
        <Skeleton height={280} radius={12} />
      </motion.div>
      <motion.div className={`${s.phCard} ${s.phSide}`} variants={item}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="70%" height={10} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={30} radius={8} />
        ))}
      </motion.div>
    </motion.div>
  );
}
