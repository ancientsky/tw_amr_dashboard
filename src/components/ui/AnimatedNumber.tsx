import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface AnimatedNumberProps {
  value: number | null | undefined;
  /** formatter for the displayed value (receives the tweened number) */
  format?: (v: number) => string;
  duration?: number;
  /** start from this value on first mount (default 0) */
  from?: number;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * requestAnimationFrame tween with cubic ease-out. Animates from the previous value
 * on change; renders the final value immediately under prefers-reduced-motion.
 * The accessible text is always the final value (aria-label), not intermediate frames.
 */
export function AnimatedNumber({ value, format = (v) => String(Math.round(v)), duration = 900, from = 0, className }: AnimatedNumberProps) {
  const reduced = usePrefersReducedMotion();
  const target = value ?? 0;
  const [display, setDisplay] = useState<number>(reduced ? target : from);
  const prev = useRef<number>(reduced ? target : from);
  const raf = useRef<number>();

  useEffect(() => {
    if (value === null || value === undefined) return;
    if (reduced || duration <= 0) {
      prev.current = target;
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const a = prev.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = a + (target - a) * easeOutCubic(t);
      setDisplay(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      prev.current = target;
    };
  }, [target, value, duration, reduced]);

  if (value === null || value === undefined) return <span className={className}>—</span>;
  return (
    <span className={className} aria-label={format(target)}>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  );
}
