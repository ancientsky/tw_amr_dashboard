import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import s from './Feedback.module.css';

export interface EmptyStateProps {
  title: ReactNode;
  body?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, body, icon = 'chart', action, className }: EmptyStateProps) {
  return (
    <div className={[s.empty, className].filter(Boolean).join(' ')} role="status">
      <span className={s.emptyIcon}>
        <Icon name={icon} size={22} />
      </span>
      <div className={s.emptyTitle}>{title}</div>
      {body && <p className={s.emptyBody}>{body}</p>}
      {action}
    </div>
  );
}
