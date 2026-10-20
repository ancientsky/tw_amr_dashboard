import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { usePrefersReducedMotion } from '../../components/ui/usePrefersReducedMotion';

/** Fade/slide a block in when it scrolls into view (no-op under reduced motion). */
export function Reveal({ children, delay = 0, className, id }: { children: ReactNode; delay?: number; className?: string; id?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced)
    return (
      <div className={className} id={id}>
        {children}
      </div>
    );
  return (
    <motion.div
      id={id}
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
