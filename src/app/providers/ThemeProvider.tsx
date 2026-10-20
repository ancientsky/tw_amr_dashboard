import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'twamr.theme';

interface ThemeCtx {
  theme: Theme;
  /** true when the user explicitly chose (persisted) rather than following the OS */
  explicit: boolean;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(t: Theme) {
  const el = document.documentElement;
  el.dataset.theme = t;
  el.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#070b0a' : '#f7f8f7');
}

/**
 * Light / dark ("black-green") theme. Resolution order:
 * `?theme=` in the hash query (urlTheme prop) → localStorage `twamr.theme` → prefers-color-scheme.
 * A URL theme applies for the session without being persisted; an explicit toggle persists.
 */
export function ThemeProvider({
  children,
  urlTheme,
  persist = true,
  onUserChange,
}: {
  children: ReactNode;
  urlTheme?: string | null;
  persist?: boolean;
  /** called after the user toggles (e.g. to drop a stale ?theme= from the URL) */
  onUserChange?: (t: Theme) => void;
}) {
  const [stored, setStored] = useState<Theme | null>(() => (persist ? readStored() : null));
  const [system, setSystem] = useState<Theme>(systemTheme);
  const [override, setOverride] = useState<Theme | null>(null);

  const fromUrl = isTheme(urlTheme) ? urlTheme : null;
  // A user toggle after load wins over the URL value until the URL changes again.
  useEffect(() => setOverride(null), [fromUrl]);

  const theme: Theme = override ?? fromUrl ?? stored ?? system;

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  const setTheme = useCallback(
    (t: Theme) => {
      setOverride(t);
      if (persist) {
        setStored(t);
        try {
          localStorage.setItem(THEME_KEY, t);
        } catch {
          /* storage unavailable */
        }
      }
      onUserChange?.(t);
    },
    [persist, onUserChange],
  );

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      explicit: Boolean(override ?? fromUrl ?? stored),
      setTheme,
      toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, override, fromUrl, stored, setTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used inside <ThemeProvider>');
  return c;
}
