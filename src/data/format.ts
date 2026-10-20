/** Locale-aware formatting helpers. Pure functions; no React. */
import type { Dim, Locale, LocalizedText } from './types';

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    nfCache.set(key, f);
  }
  return f;
}

export const EM_DASH = '—';

/** 41.234 → "41.2%" (value already in percent units). */
export function fmtPct(v: number | null | undefined, locale: Locale = 'en', digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EM_DASH;
  return `${nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)}%`;
}

/** 12840 → "12,840"; compact → "12.8K" / "1.3萬" per locale. */
export function fmtNumber(
  v: number | null | undefined,
  locale: Locale = 'en',
  opts: { digits?: number; compact?: boolean } = {},
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EM_DASH;
  if (opts.compact && Math.abs(v) >= 1000) {
    return nf(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  }
  const d = opts.digits ?? (Number.isInteger(v) ? 0 : 1);
  return nf(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
}

/** Signed delta: +2.1 / −0.4 (uses a true minus sign). */
export function fmtDelta(v: number | null | undefined, locale: Locale = 'en', digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return EM_DASH;
  const s = nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v));
  if (Math.abs(v) < 10 ** -digits / 2) return `±${s}`;
  return `${v > 0 ? '+' : '−'}${s}`;
}

/** Pick the locale string with fallback (locale → en → zh-TW → ''). */
export function localized(text: LocalizedText | string | undefined | null, locale: Locale): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[locale] || text.en || text['zh-TW'] || '';
}

/** Localized dim name by code (`name[locale]`), falling back to the code itself. */
export function dimName(dims: Dim[] | undefined, code: string, locale: Locale): string {
  const d = dims?.find((x) => x.code === code);
  return d ? localized(d.name, locale) || code : code;
}

/** Build a fast code → name lookup for one dim list. */
export function dimNamer(dims: Dim[] | undefined, locale: Locale): (code: string) => string {
  const m = new Map((dims ?? []).map((d) => [d.code, localized(d.name, locale) || d.code]));
  return (code) => m.get(code) ?? code;
}

/** ISO date/time → localized short date. */
export function fmtDate(iso: string | undefined, locale: Locale): string {
  if (!iso) return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

/** "Resistance trend: KPN × MEM" → "resistance-trend-kpn-mem" (file names). */
export function slugify(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'chart'
  );
}

/** CSV encoder (RFC 4180, UTF-8 BOM added by caller when downloading). */
export function toCsv(rows: readonly Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}
