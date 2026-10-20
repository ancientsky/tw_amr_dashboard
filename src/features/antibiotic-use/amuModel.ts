import { MUTED, mix } from '../../components/chart/palette';
import type { AmuRecord, Dim, Envelope, Level } from '../../data/types';
import type { ThemeName } from '../../styles/tokens';

export const AWARE_ORDER = ['Access', 'Watch', 'Reserve', 'Unclassified'] as const;
export type AwareKey = (typeof AWARE_ORDER)[number];

/**
 * AWaRe colour families (semantic: green / amber / red), validated with the dataviz
 * palette validator: light CVD ΔE 8.3 PASS; dark worst ΔE 7.0 (6–8 band → always paired
 * with text labels / legends, never colour alone).
 */
export const AWARE_COLORS: Record<ThemeName, Record<AwareKey, string>> = {
  light: { Access: '#16946a', Watch: '#b97a0a', Reserve: '#c43a4d', Unclassified: MUTED.light },
  dark: { Access: '#139466', Watch: '#c08410', Reserve: '#e04a5c', Unclassified: '#5d7268' },
};

export const WHO_ACCESS_TARGET = 70;
export const CARB = 'CARB';
export const FQ = 'FQ';
export const TOTAL = 'TOTAL';

export function awareOf(classes: Dim[] | undefined, code: string): AwareKey {
  const a = classes?.find((c) => c.code === code)?.meta?.aware as string | undefined;
  return (AWARE_ORDER as readonly string[]).includes(a ?? '') ? (a as AwareKey) : 'Unclassified';
}

/** Non-total class codes in AWaRe → dim order. */
export function classOrder(classes: Dim[] | undefined): string[] {
  const list = (classes ?? []).filter((c) => c.code !== TOTAL && !c.meta?.isTotal);
  return list
    .slice()
    .sort((a, b) => AWARE_ORDER.indexOf(awareOf(classes, a.code)) - AWARE_ORDER.indexOf(awareOf(classes, b.code)) || (a.order ?? 0) - (b.order ?? 0))
    .map((c) => c.code);
}

/** Shade of the AWaRe family colour for the i-th class (of n) in that family. */
export function classColor(classes: Dim[] | undefined, code: string, theme: ThemeName): string {
  const aware = awareOf(classes, code);
  const base = AWARE_COLORS[theme][aware];
  const fam = classOrder(classes).filter((c) => awareOf(classes, c) === aware);
  const i = Math.max(0, fam.indexOf(code));
  const n = fam.length;
  if (n <= 1) return base;
  const tt = -0.32 + (i / (n - 1)) * 0.82; // dark → light
  return tt < 0 ? mix(base, theme === 'dark' ? '#03100a' : '#0b1a14', -tt) : mix(base, '#ffffff', tt * (theme === 'dark' ? 0.75 : 0.9));
}

export function amuRows(records: readonly AmuRecord[], level: Level, metric = 'DID'): AmuRecord[] {
  return records.filter((r) => r.level === level && r.metric === metric && (r.setting ?? 'inpatient') === 'inpatient');
}

export interface AwareSplit {
  year: number;
  total: number;
  Access: number;
  Watch: number;
  Reserve: number;
  Unclassified: number;
}

/** DID by AWaRe group per year (TOTAL excluded from class sums; `total` = sum of classes). */
export function awareByYear(records: readonly AmuRecord[], classes: Dim[] | undefined, level: Level): AwareSplit[] {
  const by = new Map<number, AwareSplit>();
  for (const r of amuRows(records, level)) {
    if (r.className === TOTAL) continue;
    let s = by.get(r.year);
    if (!s) {
      s = { year: r.year, total: 0, Access: 0, Watch: 0, Reserve: 0, Unclassified: 0 };
      by.set(r.year, s);
    }
    const a = awareOf(classes, r.className);
    s[a] += r.value;
    s.total += r.value;
  }
  return [...by.values()].sort((a, b) => a.year - b.year);
}

export const share = (s: AwareSplit, k: AwareKey): number => (s.total > 0 ? (s[k] / s.total) * 100 : 0);

/** Value of one class (or TOTAL) for a level/year. */
export function classValue(records: readonly AmuRecord[], level: Level, cls: string, year: number): number | undefined {
  return records.find((r) => r.level === level && r.className === cls && r.year === year && r.metric === 'DID')?.value;
}

/** TOTAL J01 DID per year (falls back to the class sum when TOTAL is missing). */
export function totalByYear(records: readonly AmuRecord[], classes: Dim[] | undefined, level: Level): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of amuRows(records, level)) if (r.className === TOTAL) m.set(r.year, r.value);
  if (!m.size) for (const s of awareByYear(records, classes, level)) m.set(s.year, s.total);
  return m;
}

export function levelsOf(env: Envelope<AmuRecord> | null | undefined): Level[] {
  const present = new Set((env?.records ?? []).map((r) => r.level));
  return (['all', 'medical_center', 'regional', 'district'] as Level[]).filter((l) => present.has(l));
}
