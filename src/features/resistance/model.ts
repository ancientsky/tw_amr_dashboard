import { useMemo } from 'react';
import { useDataset } from '../../data/load';
import { dimNamer, localized } from '../../data/format';
import type { Dim, Envelope, Locale, ResistanceRecord } from '../../data/types';
import { useT } from '../../i18n';
import { buildAntibiogramIndex, buildTrendIndex, type AntibiogramIndex, type TrendIndex } from './lib';

/* Indexes are built once per envelope object and shared by every chart on the page. */
const cache = new WeakMap<object, { trend: TrendIndex; ab: AntibiogramIndex }>();

export function indexesFor(env: Envelope<ResistanceRecord>): { trend: TrendIndex; ab: AntibiogramIndex } {
  let hit = cache.get(env);
  if (!hit) {
    hit = { trend: buildTrendIndex(env.records), ab: buildAntibiogramIndex(env.records) };
    cache.set(env, hit);
  }
  return hit;
}

export interface Names {
  /** localized pathogen name (long) */
  pathogen: (code: string) => string;
  /** short binomial for axes (en: "K. pneumoniae"; zh/ja: localized name) */
  pathogenShort: (code: string) => string;
  antibiotic: (code: string) => string;
  /** antibiotic: "Meropenem (MEM)" style */
  antibioticLong: (code: string) => string;
  phenotype: (code: string) => string;
  antibioticClass: (code: string) => string;
  level: (code: string) => string;
  setting: (code: string) => string;
  specimen: (code: string) => string;
}

export function makeNames(dims: Record<string, Dim[]> | undefined, locale: Locale, t: (k: string) => string): Names {
  const p = dimNamer(dims?.pathogens, locale);
  const short = new Map((dims?.pathogens ?? []).map((d) => [d.code, typeof d.meta?.short === 'string' ? (d.meta.short as string) : localized(d.name, locale)]));
  const a = dimNamer(dims?.antibiotics, locale);
  const ph = dimNamer(dims?.phenotypes, locale);
  const cls = dimNamer(dims?.antibioticClasses, locale);
  return {
    pathogen: p,
    pathogenShort: (c) => (locale === 'en' ? (short.get(c) ?? p(c)) : p(c)),
    antibiotic: a,
    antibioticLong: (c) => {
      const n = a(c);
      return n === c ? c : `${n} (${c})`;
    },
    phenotype: ph,
    antibioticClass: (c) => (c === 'other' ? t('resistance.common.otherClass') : cls(c)),
    level: (c) => t(`levels.${c}`),
    setting: (c) => t(`settings.${c}`),
    specimen: (c) => t(`specimens.${c}`),
  };
}

/** Resistance envelope + shared indexes + localized namers. */
export function useResistanceModel(fixtureFallback?: boolean) {
  const t = useT();
  const ds = useDataset('resistance', { fixtureFallback });
  const env = ds.data;
  const idx = useMemo(() => (env ? indexesFor(env) : null), [env]);
  const names = useMemo(() => makeNames(env?.dims, t.locale, t), [env, t]);
  return { ...ds, env, trend: idx?.trend ?? null, ab: idx?.ab ?? null, names };
}

/** "Taiwan CDC · Antimicrobial Resistance Surveillance Annual Report, Taiwan (2022–2024)". */
export function resistanceSource(env: Envelope<unknown> | null | undefined, locale: Locale): string | undefined {
  if (!env?.sources?.length) return undefined;
  const real = env.sources.filter((s) => s.kind === 'annual-report');
  const list = real.length ? real : env.sources;
  const years = list.map((s) => s.year).filter(Boolean);
  const strip = (x: string) => x.replace(/[\s,，、(（]*(?:\d{4})[)）年]?\s*$/u, '').trim();
  const title = strip(localized(list[0].title, locale));
  const yr = years.length ? (Math.min(...years) === Math.max(...years) ? `${years[0]}` : `${Math.min(...years)}–${Math.max(...years)}`) : '';
  const pub = list[0].publisher;
  const pubShort = locale === 'en' ? pub.replace(/^[^A-Za-z]+/, '') || pub : pub.replace(/\s*[A-Za-z][A-Za-z ]*$/, '') || pub;
  return `${pubShort} · ${title}${yr ? ` (${yr})` : ''}`;
}
