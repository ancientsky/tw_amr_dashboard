/** Helpers shared by the data intents: names, strata wording, formatting, links, facts. */
import { toSearch, type QueryPatch } from '../../../../app/url';
import { fmtNumber, fmtPct, localized } from '../../../../data/format';
import { dedupeResistance } from '../../../../data/select';
import type { Dim, Level, Locale, OnsetSetting, Precision, ResistanceRecord } from '../../../../data/types';
import { translate } from '../../../../i18n';
import type { AliasIndex, SpecimenLike } from '../entities';
import type { AnswerLink, EngineAnswer, EngineData } from '../types';

export interface ExecCtx {
  locale: Locale;
  data: EngineData;
  idx: AliasIndex;
}

/** chat.* translator */
export function tc(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  return translate(locale, `chat.${key}`, vars);
}

export const LEVELS3: Exclude<Level, 'all'>[] = ['medical_center', 'regional', 'district'];

const dimsOf = (x: ExecCtx, key: string): Dim[] | undefined => x.data.resistance?.dims?.[key];

export function dimLabel(dims: Dim[] | undefined, code: string, locale: Locale): string {
  const d = dims?.find((v) => v.code === code);
  return d ? localized(d.name, locale) || code : code;
}

export function phenotypeName(x: ExecCtx, code: string, locale: Locale = x.locale): string {
  return dimLabel(dimsOf(x, 'phenotypes'), code, locale);
}

/** Pathogen display name; English uses the short binomial ("K. pneumoniae"). */
export function pathogenName(x: ExecCtx, code: string, locale: Locale = x.locale): string {
  const d = dimsOf(x, 'pathogens')?.find((v) => v.code === code);
  if (!d) return code;
  if (locale === 'en') return (d.meta?.short as string | undefined) ?? d.name.en;
  return localized(d.name, locale);
}

export function antibioticName(x: ExecCtx, code: string, locale: Locale = x.locale): string {
  return dimLabel(dimsOf(x, 'antibiotics'), code, locale);
}

/** A name the parser will re-recognise (used inside follow-up chips). */
export function chipName(x: ExecCtx, phenotype?: string, pathogen?: string, antibiotic?: string): string {
  if (phenotype) return phenotype;
  if (pathogen && antibiotic) return `${pathogenName(x, pathogen)} ${antibioticName(x, antibiotic, 'en').replace(/\s*\(.*\)$/, '').toLowerCase()}`;
  if (pathogen) return pathogenName(x, pathogen);
  return '';
}

export function pct(x: ExecCtx, v: number | null | undefined): string {
  return fmtPct(v ?? null, x.locale);
}

export function count(x: ExecCtx, v: number | null | undefined): string {
  return fmtNumber(v ?? null, x.locale);
}

/** Absolute percentage-point difference, one decimal. */
export function pts(x: ExecCtx, d: number): string {
  return fmtNumber(Math.abs(Math.round(d * 10) / 10), x.locale, { digits: 1 });
}

export function signedPts(x: ExecCtx, d: number): string {
  const r = Math.round(d * 10) / 10;
  const s = fmtNumber(Math.abs(r), x.locale, { digits: 1 });
  return r > 0 ? `+${s}` : r < 0 ? `−${s}` : `±${s}`;
}

export function signedPct(x: ExecCtx, ratio: number): string {
  const r = Math.round(ratio * 1000) / 10;
  const s = fmtNumber(Math.abs(r), x.locale, { digits: 1 });
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${s}%`;
}

/** Stratum wording. style 'adv' = sentence form ("in medical centres"), 'noun' = label form ("Medical centres"). */
export function where(
  x: ExecCtx,
  level: Level,
  setting: OnsetSetting | 'all' = 'all',
  specimen: 'all' | SpecimenLike = 'all',
  style: 'adv' | 'noun' = 'adv',
): string {
  const lv = tc(x.locale, `${style === 'adv' ? 'lv' : 'lvn'}.${level}`);
  const extra: string[] = [];
  if (setting !== 'all') extra.push(tc(x.locale, `st.${setting}`));
  if (specimen !== 'all') extra.push(tc(x.locale, `sp.${specimen}`));
  return extra.length ? `${lv}${tc(x.locale, 'paren', { x: extra.join(tc(x.locale, 'sep')) })}` : lv;
}

/** "（醫療相關感染，血液檢體）" — setting/specimen qualifiers only ('' when both are 'all'). */
export function extraParen(x: ExecCtx, setting: OnsetSetting | 'all' = 'all', specimen: 'all' | SpecimenLike = 'all'): string {
  const extra: string[] = [];
  if (setting !== 'all') extra.push(tc(x.locale, `st.${setting}`));
  if (specimen !== 'all') extra.push(tc(x.locale, `sp.${specimen}`));
  return extra.length ? tc(x.locale, 'paren', { x: extra.join(tc(x.locale, 'sep')) }) : '';
}

/** English stratum label for model-facing facts. */
export function whereEn(level: Level, setting: OnsetSetting | 'all' = 'all', specimen: 'all' | SpecimenLike = 'all'): string {
  const lv = { all: 'national (all hospital levels)', medical_center: 'medical centres', regional: 'regional hospitals', district: 'district hospitals' }[level];
  const st = { all: 'CO+HO', co: 'community-onset', ho: 'hospital-onset' }[setting];
  return `${lv}; ${st}; ${specimen === 'all' ? 'all specimens' : `${specimen} specimens`}`;
}

export function precisionNote(x: ExecCtx, p: Precision | undefined): string {
  return p ? tc(x.locale, `prec.${p}`) : '';
}

export function sourceNote(x: ExecCtx, reportYear?: number): string {
  return reportYear ? tc(x.locale, 'ans.source', { report: reportYear }) : '';
}

export function hashLink(route: string, params: QueryPatch): string {
  return `#${route}${toSearch(params)}`;
}

export function link(x: ExecCtx, labelKey: string, route: string, params: QueryPatch): AnswerLink {
  return { label: tc(x.locale, labelKey), href: hashLink(route, params) };
}

const PRECISION_RANK: Record<Precision, number> = { table: 0, text: 1, chart_estimate: 2 };
export function worst(recs: { precision?: Precision }[]): Precision | undefined {
  let w: Precision | undefined;
  for (const r of recs) if (r.precision && (!w || PRECISION_RANK[r.precision] > PRECISION_RANK[w])) w = r.precision;
  return w;
}

const dedupCache = new WeakMap<object, ResistanceRecord[]>();
/** Resistance records with overlapping report editions removed (memoised per envelope). */
export function resistanceRows(x: ExecCtx): ResistanceRecord[] {
  const env = x.data.resistance;
  if (!env) return [];
  let rows = dedupCache.get(env);
  if (!rows) {
    // Dedupe each row kind separately: MDRO trend rows (with `phenotype`) share the
    // stratum key with drug-level rows (e.g. KPN×MEM) and must never displace each other.
    rows = [...dedupeResistance(env.records.filter((r) => r.phenotype)), ...dedupeResistance(env.records.filter((r) => !r.phenotype))];
    dedupCache.set(env, rows);
  }
  return rows;
}

export function joinList(x: ExecCtx, items: string[]): string {
  return items.join(tc(x.locale, 'listSep'));
}

export function emptyAnswer(partial: Partial<EngineAnswer> & Pick<EngineAnswer, 'kind' | 'text'>): EngineAnswer {
  return { links: [], chips: [], facts: [], passages: [], confidence: 1, ...partial };
}

export function fmtPrecisionEn(p?: Precision): string {
  return p === 'chart_estimate' ? 'read from a chart, ≈ ±1–2 points' : p === 'text' ? 'stated in report text' : p === 'table' ? 'exact antibiogram table value (non-susceptible = 100 − %S)' : 'unknown precision';
}

/** Join sentences: a space in English, nothing between CJK sentences. */
export function sentence(x: ExecCtx, ...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(x.locale === 'en' ? ' ' : '');
}
