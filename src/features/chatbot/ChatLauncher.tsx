import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Drawer } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/icons';
import { useT } from '../../i18n';
import s from './chatbot.module.css';

/** Window event other components can dispatch to open the assistant: openChat({ q: '…' }). */
export const CHAT_OPEN_EVENT = 'twamr:chat-open';
export function openChat(detail: { q?: string } = {}): void {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail }));
}

/**
 * Floating chatbot launcher + drawer (PLACEHOLDER).
 * The chatbot agent replaces <ChatPanel/> below with the real assistant; keep the
 * launcher API (`openChat`, CHAT_OPEN_EVENT) stable.
 */
export function ChatLauncher() {
  const t = useT();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setOpen(true);
    window.addEventListener(CHAT_OPEN_EVENT, fn);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, fn);
  }, []);

  const hidden = pathname === '/chat';

  return (
    <>
      <AnimatePresence>
        {!hidden && !open && (
          <motion.button
            type="button"
            className={s.launcher}
            onClick={() => setOpen(true)}
            aria-label={t('chat.launcher')}
            title={t('chat.launcher')}
            initial={{ opacity: 0, scale: 0.8, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 16 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            data-print="hide"
          >
            <Icon name="chat" size={22} />
            <span className={s.launcherLabel}>{t('nav.chat')}</span>
          </motion.button>
        )}
      </AnimatePresence>
      <Drawer open={open} onClose={() => setOpen(false)} title={t('chat.title')} width={420}>
        <ChatPanel />
      </Drawer>
    </>
  );
}

/** Placeholder assistant body — replaced by the chatbot agent. */
export function ChatPanel() {
  const t = useT();
  return (
    <div className={s.panel}>
      <div className={s.bubble}>
        <span className={s.avatar} aria-hidden="true">
          <Icon name="chat" size={16} />
        </span>
        <p>{t('chat.comingSoon')}</p>
      </div>
      <form className={s.composer} onSubmit={(e) => e.preventDefault()}>
        <input className={s.input} placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')} disabled />
        <button type="submit" className={s.send} aria-label={t('chat.send')} disabled>
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
