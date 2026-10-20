import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import s from './Feedback.module.css';

interface ToastItem {
  id: number;
  text: string;
  icon: IconName;
}

const Ctx = createContext<(text: string, icon?: IconName) => void>(() => {});

/** Minimal toast queue for "copied!" style confirmations (aria-live polite). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, icon: IconName = 'check') => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, text, icon }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2400);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={s.toasts} aria-live="polite" role="status">
        <AnimatePresence>
          {items.map((it) => (
            <motion.div
              key={it.id}
              className={s.toast}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
            >
              <Icon name={it.icon} size={16} className={s.toastIcon} />
              {it.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
