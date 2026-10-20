import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALES, type Locale } from '../../data/types';

export const LANG_KEY = 'twamr.lang';
export const DEFAULT_LOCALE: Locale = 'zh-TW';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<LocaleCtx | null>(null);

export function normalizeLocale(v: string | null | undefined): Locale | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === 'zh-tw' || s === 'zh' || s === 'zh-hant' || s.startsWith('zh-hant') || s === 'tw') return 'zh-TW';
  if (s.startsWith('zh')) return 'zh-TW';
  if (s === 'en' || s.startsWith('en-')) return 'en';
  if (s === 'ja' || s.startsWith('ja-') || s === 'jp') return 'ja';
  return (LOCALES as readonly string[]).includes(v) ? (v as Locale) : null;
}

function readStored(): Locale | null {
  try {
    return normalizeLocale(localStorage.getItem(LANG_KEY));
  } catch {
    return null;
  }
}

function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  for (const l of navigator.languages ?? [navigator.language]) {
    const n = normalizeLocale(l);
    if (n) return n;
  }
  return DEFAULT_LOCALE;
}

/**
 * zh-TW (primary) / en / ja. Resolution: `?lang=` (urlLang prop) → localStorage `twamr.lang`
 * → browser language → zh-TW. Sets `<html lang>`.
 */
export function LocaleProvider({
  children,
  urlLang,
  persist = true,
  onUserChange,
}: {
  children: ReactNode;
  urlLang?: string | null;
  persist?: boolean;
  onUserChange?: (l: Locale) => void;
}) {
  const [stored, setStored] = useState<Locale | null>(() => (persist ? readStored() : null));
  const [override, setOverride] = useState<Locale | null>(null);
  const fromUrl = normalizeLocale(urlLang);
  useEffect(() => setOverride(null), [fromUrl]);

  const locale: Locale = override ?? fromUrl ?? stored ?? browserLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      setOverride(l);
      if (persist) {
        setStored(l);
        try {
          localStorage.setItem(LANG_KEY, l);
        } catch {
          /* ignore */
        }
      }
      onUserChange?.(l);
    },
    [persist, onUserChange],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLocale must be used inside <LocaleProvider>');
  return c;
}
