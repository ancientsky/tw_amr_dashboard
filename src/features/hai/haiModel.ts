import { CATEGORICAL, MUTED } from '../../components/chart/palette';
import type { Envelope, HaiPathogenRecord, HaiRecord, IcuType, Level } from '../../data/types';
import type { ThemeName } from '../../styles/tokens';

export const ICU_ORDER: IcuType[] = [
  'all',
  'medical',
  'surgical',
  'mixed',
  'cardiac',
  'neuro',
  'pediatric',
  'neonatal',
  'burn',
];
export const KPI_METRICS = ['hai_density', 'clabsi', 'cauti', 'vap'] as const;
export const TREND_METRICS = [
  'clabsi',
  'cauti',
  'vap',
  'hai_density',
  'bsi_density',
  'uti_density',
  'pneu_density',
] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];
export const UTIL_METRICS = ['central_line_util', 'urinary_cath_util', 'ventilator_util'] as const;
export const HEAT_METRICS = [
  'hai_density',
  'bsi_density',
  'uti_density',
  'pneu_density',
  'clabsi',
  'cauti',
  'vap',
  'central_line_util',
  'urinary_cath_util',
  'ventilator_util',
] as const;
export const SITES = ['bsi', 'uti', 'pneu', 'all'] as const;
export type Site = (typeof SITES)[number];

export const LEVELS_HAI: Level[] = ['all', 'medical_center', 'regional', 'district'];

export function icuTypesFor(records: readonly HaiRecord[], level: Level): IcuType[] {
  const present = new Set(records.filter((r) => r.level === level).map((r) => r.icu_type));
  return ICU_ORDER.filter((i) => present.has(i));
}

export function haiSeries(
  records: readonly HaiRecord[],
  level: Level,
  icu: IcuType,
  metric: string,
): HaiRecord[] {
  return records
    .filter((r) => r.level === level && r.icu_type === icu && r.metric === metric)
    .sort((a, b) => a.year - b.year);
}

/** Pathogen levels available in hai_pathogens (district has no pathogen ranking). */
export function pathogenLevel(env: Envelope<HaiPathogenRecord> | null | undefined, level: Level): Level {
  return env?.records.some((r) => r.level === level) ? level : 'all';
}

/**
 * Stable organism → colour: organisms ranked by mean share across the whole dataset;
 * the 8 most prominent get categorical slots, the rest the muted "other" colour.
 */
export function organismColors(
  env: Envelope<HaiPathogenRecord> | null | undefined,
  theme: ThemeName,
): (code: string) => string {
  const sum = new Map<string, number>();
  for (const r of env?.records ?? []) sum.set(r.pathogen, (sum.get(r.pathogen) ?? 0) + r.pct);
  const order = [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const idx = new Map(order.map((k, i) => [k, i]));
  return (code) => {
    const i = idx.get(code);
    return i !== undefined && i < 8 ? CATEGORICAL[theme][i] : MUTED[theme];
  };
}

export function organismShort(
  env: Envelope<HaiPathogenRecord> | null | undefined,
  code: string,
  fallback: string,
): string {
  const d = env?.dims?.pathogens?.find((p) => p.code === code);
  return (d?.meta?.short as string | undefined) ?? fallback;
}

export function unitKey(env: Envelope<HaiRecord> | null | undefined, metric: string): string {
  return (
    (env?.dims?.metrics?.find((m) => m.code === metric)?.meta?.unit as string | undefined) ??
    (metric.endsWith('_util') ? 'ratio' : 'per_1000_patient_days')
  );
}
