import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';
import { IconButton } from './IconButton';
import s from './Feedback.module.css';

function useDialogBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = requestAnimationFrame(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
      el?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
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
      cancelAnimationFrame(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose, panel]);
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** max width in px (default 640) */
  width?: number;
  /** fill the viewport (fullscreen fallback) */
  full?: boolean;
  actions?: ReactNode;
}

/** Centered dialog (portal, focus trap, Esc, scroll lock, animated). */
export function Modal({ open, onClose, title, children, width, full, actions }: ModalProps) {
  const t = useT();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panel);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="ov" className={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div key="pos" className={s.modalPos} style={full ? { padding: 12 } : undefined}>
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-t`}
              tabIndex={-1}
              className={[s.modal, full ? s.full : ''].join(' ')}
              style={width ? ({ '--modal-w': `${width}px` } as CSSProperties) : undefined}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={s.modalHead}>
                <h2 id={`${id}-t`} className={s.modalTitle}>
                  {title}
                </h2>
                <div style={{ display: 'flex', gap: 4 }}>
                  {actions}
                  <IconButton icon="close" label={t('actions.close')} onClick={onClose} data-autofocus />
                </div>
              </div>
              <div className={s.modalBody}>{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'left' | 'right';
  width?: number;
}

/** Side sheet (portal, focus trap, Esc, animated slide). */
export function Drawer({ open, onClose, title, children, side = 'right', width }: DrawerProps) {
  const t = useT();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panel);
  if (typeof document === 'undefined') return null;
  const off = side === 'right' ? '100%' : '-100%';
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ov"
            className={`${s.overlay} ${s.drawerOverlay}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="dr"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            tabIndex={-1}
            className={`${s.drawer} ${s[side]}`}
            style={width ? ({ '--drawer-w': `${width}px` } as CSSProperties) : undefined}
            initial={{ x: off }}
            animate={{ x: 0 }}
            exit={{ x: off }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          >
            <div className={s.modalHead}>
              <h2 id={`${id}-t`} className={s.modalTitle}>
                {title}
              </h2>
              <IconButton icon="close" label={t('actions.close')} onClick={onClose} data-autofocus />
            </div>
            <div className={s.modalBody}>{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
