import { useMemo } from 'react';
import { useLocale } from '../app/providers/LocaleProvider';
import type { Locale, LocalizedText } from '../data/types';
import en from './en.json';
import ja from './ja.json';
import zhTW from './zh-TW.json';

type Dict = Record<string, unknown>;
export type Vars = Record<string, string | number>;

const DICTS: Record<Locale, Dict> = { 'zh-TW': zhTW, en, ja };

function lookup(dict: Dict, key: string): string | undefined {
  // flat dot-key first (lets other agents append "feature.key": "…" at top level)
  const flat = dict[key];
  if (typeof flat === 'string') return flat;
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) cur = (cur as Dict)[part];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Pure translate with fallback chain locale → en → key. */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  const s = lookup(DICTS[locale], key) ?? lookup(DICTS.en, key) ?? key;
  return interpolate(s, vars);
}

export function hasKey(locale: Locale, key: string): boolean {
  return lookup(DICTS[locale], key) !== undefined;
}

/** Pick a LocalizedText for a locale, falling back to en → zh-TW. */
export function translateLocalized(text: LocalizedText | string | null | undefined, locale: Locale): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[locale] || text.en || text['zh-TW'] || '';
}

export interface TFunction {
  (key: string, vars?: Vars): string;
  /** same function, so `const { t } = useT()` also works */
  t: TFunction;
  /** localized-text picker: tl({ 'zh-TW', en, ja }) */
  tl: (text: LocalizedText | string | null | undefined) => string;
  locale: Locale;
}

/**
 * `const t = useT(); t('nav.overview'); t('kpi.vsPrev', { year: 2023 }); t.tl(dim.name)`
 * or `const { t, tl, locale } = useT();`
 */
export function useT(): TFunction {
  const { locale } = useLocale();
  return useMemo(() => {
    const fn = ((key: string, vars?: Vars) => translate(locale, key, vars)) as TFunction;
    fn.t = fn;
    fn.tl = (text) => translateLocalized(text, locale);
    fn.locale = locale;
    return fn;
  }, [locale]);
}

export { DICTS as dictionaries };
