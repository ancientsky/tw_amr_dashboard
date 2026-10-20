import type { Envelope, Level, Locale, OnsetSetting, ResistanceRecord, Ward } from '../../data/types';
import { LEVELS, ONSET_SETTINGS, WARDS } from '../../data/types';
import { localized } from '../../data/format';
import { parseYearRange, type YearRange } from '../../data/select';

/** Params shared by the shipped chart components (embed + pages). */
export interface ChartParams {
  pathogen?: string;
  antibiotic?: string;
  level?: Level;
  ward?: Ward;
  setting?: OnsetSetting;
  years?: YearRange;
  compact?: boolean;
  /** absolute link back to the full site for this view */
  link?: string;
  /** use bundled fixture when public/data is unavailable (embed) */
  fixtureFallback?: boolean;
}

export function parseChartParams(q: URLSearchParams): ChartParams {
  const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined =>
    v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
  return {
    pathogen: q.get('pathogen')?.toUpperCase() || undefined,
    antibiotic: q.get('antibiotic')?.toUpperCase() || undefined,
    level: pick(q.get('level'), LEVELS),
    ward: pick(q.get('ward'), WARDS),
    setting: pick(q.get('setting'), ONSET_SETTINGS),
    years: parseYearRange(q.get('years')),
    compact: q.get('compact') === '1' || q.get('compact') === 'true',
  };
}

/** "Taiwan CDC — 臺灣抗生素抗藥性監視年報 (2022–2024)" style source line from an envelope. */
export function sourceLine(env: Envelope<unknown> | null | undefined, locale: Locale): string | undefined {
  if (!env?.sources?.length) return undefined;
  const real = env.sources.filter((s) => s.kind !== 'curated' || env.sources.length === 1);
  const list = (real.length ? real : env.sources).slice(0, 2);
  const years = env.sources.map((s) => s.year).filter(Boolean);
  const yr = years.length ? (Math.min(...years) === Math.max(...years) ? `${years[0]}` : `${Math.min(...years)}–${Math.max(...years)}`) : '';
  const strip = (x: string) => x.replace(/[\s,，、(（]*(?:\d{4})[)）年]?\s*$/u, '').trim();
  const titles = [...new Set(list.map((s) => strip(localized(s.title, locale))))].join('; ');
  const pub = list[0]?.publisher;
  return [pub, titles].filter(Boolean).join(' · ') + (yr ? ` (${yr})` : '');
}

/** Phenotype code/name for a pathogen×antibiotic pair from records or dims. */
export function phenotypeFor(env: Envelope<ResistanceRecord>, pathogen: string, antibiotic: string): string | undefined {
  const fromRec = env.records.find((r) => r.pathogen === pathogen && r.antibiotic === antibiotic && r.phenotype)?.phenotype;
  if (fromRec) return fromRec;
  const d = env.dims?.phenotypes?.find((p) => p.meta?.pathogen === pathogen && p.meta?.antibiotic === antibiotic);
  return d?.code;
}
