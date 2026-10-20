import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import s from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** accessible name (also used as tooltip) — required */
  label: string;
  /** render the label text next to the icon */
  showLabel?: boolean;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'plain' | 'outline';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, showLabel, active, size = 'md', variant = 'plain', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={showLabel ? undefined : label}
      title={label}
      className={[s.btn, size !== 'md' ? s[size] : '', variant === 'outline' ? s.outline : '', active ? s.active : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} />
      {showLabel && <span className={s.label}>{label}</span>}
    </button>
  );
});

type BtnBase = { variant?: 'default' | 'primary' | 'ghost'; icon?: IconName; children: ReactNode };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & BtnBase>(function Button(
  { variant = 'default', icon, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={[s.button, variant !== 'default' ? s[variant] : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'default',
  icon,
  children,
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & BtnBase) {
  return (
    <a className={[s.button, variant !== 'default' ? s[variant] : '', className].filter(Boolean).join(' ')} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </a>
  );
}
