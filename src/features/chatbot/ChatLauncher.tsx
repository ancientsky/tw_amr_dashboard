import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../../components/ui/icons';
import { usePrefersReducedMotion } from '../../components/ui/usePrefersReducedMotion';
import { useT } from '../../i18n';
import { ChatIcon } from './ui/icons';
import type { ChatRequest } from './ui/ChatPanel';
import s from './chatbot.module.css';

/** Window event other components can dispatch to open the assistant: openChat({ q: '…' }). */
export const CHAT_OPEN_EVENT = 'twamr:chat-open';
export function openChat(detail: { q?: string } = {}): void {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail }));
}

/** The assistant body is code-split: the engine + ECharts load on first open. */
const LazyPanel = lazy(() => import('./ui/ChatPanel'));

function PanelFallback() {
  return (
    <div className={s.fallback} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

/** Hide the floating button while scrolling down on small screens so it never sits on chart toolbars. */
function useAutoHide(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const small = window.matchMedia('(max-width: 720px)').matches;
        if (!small) setHidden(false);
        else if (y > lastY + 6 && y > 120) setHidden(true);
        else if (y < lastY - 6) setHidden(false);
        lastY = y;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return hidden;
}

function ChatDrawer({ open, onClose, request }: { open: boolean; onClose: () => void; request: ChatRequest | null }) {
  const t = useT();
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const small = window.matchMedia('(max-width: 640px)').matches;
    const prevOverflow = document.body.style.overflow;
    if (small) document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(
          (el) => el.offsetParent !== null,
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // the launcher that opened the drawer is unmounted while it is open → focus its replacement
      if (prevFocus?.isConnected) prevFocus.focus();
      else requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-chat-launcher]')?.focus());
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="ov" className={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            key="dr"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            className={s.drawer}
            data-print="hide"
            initial={reduced ? { opacity: 0 } : { x: '104%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '104%' }}
            transition={reduced ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 42 }}
          >
            <header className={s.head}>
              <span className={s.headIcon} aria-hidden="true">
                <ChatIcon name="bot" size={18} />
              </span>
              <h2 id={`${id}-t`} className={s.title}>
                {t('chat.title')}
                <span className={s.titleBadge}>{t('chat.aiBadge')}</span>
              </h2>
              <Link to="/chat" className={s.headBtn} onClick={onClose} aria-label={t('chat.ui.openFull')} title={t('chat.ui.openFull')}>
                <ChatIcon name="expand" size={17} />
              </Link>
              <button type="button" className={s.headBtn} onClick={onClose} aria-label={t('actions.close')} title={t('actions.close')}>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className={s.body}>
              <Suspense fallback={<PanelFallback />}>
                <LazyPanel variant="drawer" request={request} onNavigate={onClose} />
              </Suspense>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Floating assistant launcher (bottom-right, subtle pulse, "AI" badge, tooltip) + drawer.
 * `openChat({ q })` from anywhere opens the drawer and asks `q`; on #/chat the page handles it.
 */
export function ChatLauncher() {
  const t = useT();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<ChatRequest | null>(null);
  const hiddenByScroll = useAutoHide();
  const tipId = useId();
  const onChatPage = pathname === '/chat';

  useEffect(() => {
    const fn = (e: Event) => {
      if (window.location.hash.replace(/^#/, '').split('?')[0] === '/chat') return; // ChatPage handles it
      const q = (e as CustomEvent<{ q?: string }>).detail?.q;
      if (q) setRequest({ q, nonce: Date.now() });
      setOpen(true);
    };
    window.addEventListener(CHAT_OPEN_EVENT, fn);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, fn);
  }, []);

  useEffect(() => {
    if (onChatPage) setOpen(false);
  }, [onChatPage]);

  const close = useCallback(() => {
    setOpen(false);
    setRequest(null); // a remounted panel must not re-send the last openChat() question
  }, []);

  return (
    <>
      <AnimatePresence>
        {!onChatPage && !open && (
          <motion.div
            className={`${s.launcherWrap} ${hiddenByScroll ? s.launcherHidden : ''}`}
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 16 }}
            data-print="hide"
          >
            <button
              type="button"
              className={s.launcher}
              onClick={() => setOpen(true)}
              aria-label={t('chat.launcher')}
              aria-describedby={tipId}
              aria-haspopup="dialog"
              data-chat-launcher=""
            >
              <span className={s.pulse} aria-hidden="true" />
              <Icon name="chat" size={22} />
              <span className={s.launcherLabel}>{t('nav.chat')}</span>
              <span className={s.badge} aria-hidden="true">
                {t('chat.aiBadge')}
              </span>
            </button>
            <span id={tipId} role="tooltip" className={s.tip}>
              {t('chat.launcherTooltip')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <ChatDrawer open={open} onClose={close} request={request} />
    </>
  );
}
