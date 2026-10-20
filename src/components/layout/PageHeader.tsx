import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import s from './layout.module.css';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  hero?: boolean;
}

/** Page title block (h1). Use once per page. */
export function PageHeader({ eyebrow, title, subtitle, aside, hero }: PageHeaderProps) {
  return (
    <header className={[s.pageHeader, hero ? s.hero : ''].join(' ')}>
      <div className={s.pageTitles}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <motion.h1 className={s.pageTitle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          {title}
        </motion.h1>
        {subtitle && <p className={s.pageSubtitle}>{subtitle}</p>}
      </div>
      {aside && <div className={s.pageAside}>{aside}</div>}
    </header>
  );
}

/** Titled page section. */
export function Section({ title, aside, children, id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className={s.section} id={id}>
      {(title || aside) && (
        <div className={s.sectionHead}>
          {title && <h2 className={s.sectionTitle}>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
