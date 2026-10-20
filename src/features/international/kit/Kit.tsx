import { useState, type ReactNode } from 'react';
import { Drawer } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/IconButton';
import { Icon } from '../../../components/ui/icons';
import s from './kit.module.css';

/** Prominent, non-dismissable in-page notice for provisional / model data. */
export function Notice({
  title,
  children,
  tone = 'warn',
  links,
}: {
  title: ReactNode;
  children: ReactNode;
  tone?: 'warn' | 'info';
  links?: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <aside className={`${s.notice} ${tone === 'info' ? s.noticeInfo : ''}`} role="note">
      <Icon name={tone === 'info' ? 'info' : 'alert'} size={20} className={s.noticeIcon} />
      <div className={s.noticeBody}>
        <strong className={s.noticeTitle}>{title}</strong>
        <div className={s.noticeText}>{children}</div>
        {links && links.length > 0 && (
          <div className={s.noticeLinks}>
            {links.map((l) => (
              <a
                key={l.href + l.label}
                href={l.href}
                {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                {l.label}
                {l.external ? ' ↗' : ' →'}
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

/** "Methodology" button + side drawer. */
export function MethodDrawer({
  label,
  title,
  children,
}: {
  label: string;
  title: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="info" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={title} width={560}>
        <div className={s.prose}>{children}</div>
      </Drawer>
    </>
  );
}

/** One row of filters above everything they scope (dataviz: never filters inside a card). */
export function FilterBar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={s.filters} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Small swatch + label legend item (HTML legends next to charts). */
export function LegendSwatch({
  color,
  label,
  muted,
  onClick,
  pressed,
}: {
  color: string;
  label: ReactNode;
  muted?: boolean;
  onClick?: () => void;
  pressed?: boolean;
}) {
  const content = (
    <>
      <span className={s.swatch} style={{ background: color }} aria-hidden="true" />
      <span>{label}</span>
    </>
  );
  if (onClick)
    return (
      <button
        type="button"
        className={`${s.legendItem} ${muted ? s.legendMuted : ''}`}
        onClick={onClick}
        aria-pressed={pressed}
      >
        {content}
      </button>
    );
  return <span className={`${s.legendItem} ${muted ? s.legendMuted : ''}`}>{content}</span>;
}
