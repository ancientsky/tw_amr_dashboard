import type { ReactNode } from 'react';
import s from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'info' | 'warn' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  title?: string;
  className?: string;
}

export function Badge({ children, tone = 'neutral', dot, icon, title, className }: BadgeProps) {
  return (
    <span className={[s.badge, s[tone], className].filter(Boolean).join(' ')} title={title}>
      {dot && <span className={s.dot} aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
