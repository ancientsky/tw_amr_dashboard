import { AnimatePresence, motion } from 'framer-motion';
import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import s from './Feedback.module.css';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  placement?: 'top' | 'bottom';
}

/** Hover/focus tooltip. The trigger gets aria-describedby; content is mirrored for keyboard users. */
export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': open ? id : undefined })
    : children;
  return (
    <span
      className={s.tipWrap}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      {child}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            className={[s.tip, placement === 'bottom' ? s.tipBottom : ''].join(' ')}
            initial={{ opacity: 0, y: placement === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
