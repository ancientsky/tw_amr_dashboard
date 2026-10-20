import type { ReactNode } from 'react';
import s from './Controls.module.css';

/** Visible label above a control (filters row). */
export function Field({ label, children, id }: { label: ReactNode; children: ReactNode; id?: string }) {
  return (
    <div className={s.field}>
      <span className={s.fieldLabel} id={id}>
        {label}
      </span>
      {children}
    </div>
  );
}
