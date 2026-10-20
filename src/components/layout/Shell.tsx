import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { navFor } from '../../app/nav';
import { NotFoundPage, ROUTES } from '../../app/routes';
import { ChatLauncher } from '../../features/chatbot/ChatLauncher';
import { useT } from '../../i18n';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion';
import { Footer } from './Footer';
import { SkeletonGrid } from './PlaceholderPage';
import { ProvisionalBanner } from './ProvisionalBanner';
import { TopNav } from './TopNav';
import s from './layout.module.css';

function PageFallback() {
  return (
    <div className="container" style={{ paddingTop: 96 }}>
      <SkeletonGrid />
    </div>
  );
}

/** App chrome: skip link, top nav, per-route provisional banner, animated routes, footer, chat launcher. */
export function Shell({ children }: { children?: ReactNode }) {
  const t = useT();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const nav = navFor(location.pathname);

  // Title per route + scroll to top on route change (not on query changes).
  useEffect(() => {
    const page = nav ? t(`nav.${nav.key}`) : t('notFound.title');
    document.title = nav?.path === '/' ? `${t('app.name')} — ${t('app.fullName')}` : `${page} · ${t('app.name')}`;
  }, [nav, t]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const motionProps = reduced
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
        exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
      };

  return (
    <div className={s.shell}>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        {t('nav.skip')}
      </a>
      <TopNav chatSlot={null} />
      {nav && nav.datasets.length > 0 && <ProvisionalBanner key={nav.path} datasets={nav.datasets} variant={nav.banner} />}
      <main id="main" className={s.main} tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} {...motionProps}>
            <Suspense fallback={<PageFallback />}>
              <Routes location={location}>
                {ROUTES.map((r) => (
                  <Route key={r.path} path={r.path} element={<r.Component />} />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              {children}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <ChatLauncher />
    </div>
  );
}
