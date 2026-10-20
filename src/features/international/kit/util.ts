import type { Envelope, Locale } from '../../../data/types';
import { localized } from '../../../data/format';

/** Escape text placed inside ECharts HTML tooltips. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Tooltip row: coloured dot · label · right-aligned value. */
export function tipRow(color: string | undefined, label: string, value: string, bold = false): string {
  const dot = color
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>`
    : '';
  return `<div style="display:flex;justify-content:space-between;gap:16px;align-items:center;${bold ? 'font-weight:650' : ''}"><span>${dot}${esc(label)}</span><span style="font-variant-numeric:tabular-nums">${esc(value)}</span></div>`;
}

export function tipTitle(s: string): string {
  return `<div style="font-weight:650;margin-bottom:6px">${esc(s)}</div>`;
}

export function tipNote(s: string): string {
  return `<div style="margin-top:6px;opacity:.72;font-size:11.5px;max-width:260px;white-space:normal">${esc(s)}</div>`;
}

/** Median of finite numbers (undefined when empty). */
export function median(values: readonly number[]): number | undefined {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function mean(values: readonly number[]): number | undefined {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}

export function sd(values: readonly number[]): number | undefined {
  const v = values.filter((x) => Number.isFinite(x));
  const m = mean(v);
  if (m === undefined || v.length < 2) return undefined;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/** Round up to a "nice" axis maximum (5 / 10 / 20 steps). */
export function niceMax(v: number, cap = 100): number {
  if (!Number.isFinite(v) || v <= 0) return 10;
  const step = v <= 10 ? 2 : v <= 30 ? 5 : 10;
  return Math.min(cap, Math.ceil((v * 1.08) / step) * step);
}

/** Map of source id → localized title (with publisher fallback) for an envelope. */
export function sourceTitles(
  env: Envelope<unknown> | null | undefined,
  locale: Locale,
): Map<string, { title: string; publisher: string; url?: string; year: number }> {
  const m = new Map<string, { title: string; publisher: string; url?: string; year: number }>();
  for (const s of env?.sources ?? [])
    m.set(s.id, { title: localized(s.title, locale), publisher: s.publisher, url: s.url, year: s.year });
  return m;
}

/** Combine two source lines into one (deduped). */
export function joinSources(...lines: (string | undefined)[]): string | undefined {
  const l = [...new Set(lines.filter(Boolean))];
  return l.length ? l.join(' · ') : undefined;
}

/** Read extra embed params from the current hash (embed.html#/?chart=…&indicator=…). */
export function hashParam(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const h = window.location.hash;
  const i = h.indexOf('?');
  if (i < 0) return undefined;
  return new URLSearchParams(h.slice(i + 1)).get(key) ?? undefined;
}

/** Source line listing every source title of an envelope (keeps provisional/model sources visible). */
export function envSourceLine(
  env: Envelope<unknown> | null | undefined,
  locale: Locale,
  ids?: string[],
): string | undefined {
  const list = (env?.sources ?? []).filter((s) => !ids || ids.includes(s.id));
  if (!list.length) return undefined;
  return list.map((s) => localized(s.title, locale)).join('; ');
}

/** GLASS source line: WHO GLASS + Taiwan CDC report, then "+N national systems". */
export function glassSourceLine(
  env: Envelope<unknown> | null | undefined,
  locale: Locale,
  more: (n: number) => string,
): string | undefined {
  const src = env?.sources ?? [];
  if (!src.length) return undefined;
  const main = src.filter((s) => s.kind === 'glass' || s.id.startsWith('tw-cdc'));
  const rest = src.length - main.length;
  return [...main.map((s) => localized(s.title, locale)), rest > 0 ? more(rest) : '']
    .filter(Boolean)
    .join('; ');
}
