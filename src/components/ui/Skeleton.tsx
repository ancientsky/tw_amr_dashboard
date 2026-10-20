import type { CSSProperties } from 'react';
import s from './Feedback.module.css';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Shimmering placeholder block (aria-hidden). Wrap groups in an element with aria-busy. */
export function Skeleton({ width = '100%', height = 16, radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={[s.skeleton, className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}
