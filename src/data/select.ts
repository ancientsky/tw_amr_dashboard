/**
 * Pure selector helpers over canonical records (no React, no I/O).
 * Unit-tested in select.test.ts against src/data/fixtures.
 */
import type {
  Dim,
  IsolateRecord,
  IsolateScope,
  Level,
  OnsetSetting,
  Precision,
  ResistanceRecord,
  Specimen,
  Ward,
} from './types';

export type YearRange = readonly [number, number];

/* ---------------- years ---------------- */

/** Parse `"2014-2024"` / `"2020"` → [from, to]; returns undefined for garbage. */
export function parseYearRange(input: string | null | undefined): YearRange | undefined {
  if (!input) return undefined;
  const m = /^\s*(\d{4})\s*(?:[-–:]\s*(\d{4}))?\s*$/.exec(input);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return a <= b ? [a, b] : [b, a];
}

export function formatYearRange(r: YearRange): string {
  return r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
}

/** Distinct years present, ascending. */
export function yearsOf<T extends { year: number }>(records: readonly T[]): number[] {
  return [...new Set(records.map((r) => r.year))].sort((a, b) => a - b);
}

/** [min, max] year across records (undefined when empty). */
export function extentYears<T extends { year: number }>(records: readonly T[]): YearRange | undefined {
  if (!records.length) return undefined;
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of records) {
    if (r.year < lo) lo = r.year;
    if (r.year > hi) hi = r.year;
  }
  return [lo, hi];
}

export function clampYearRange(r: YearRange, bounds: YearRange): YearRange {
  const a = Math.min(Math.max(r[0], bounds[0]), bounds[1]);
  const b = Math.min(Math.max(r[1], bounds[0]), bounds[1]);
  return a <= b ? [a, b] : [b, a];
}

export function inYearRange(year: number, r?: YearRange): boolean {
  return !r || (year >= r[0] && year <= r[1]);
}

/* ---------------- generic filtering ---------------- */

export interface ResistanceFilter {
  years?: YearRange;
  year?: number;
  level?: Level;
  ward?: Ward;
  /** THAS onset setting (community-onset 'co' / hospital-onset 'ho') */
  setting?: OnsetSetting;
  specimen?: Specimen;
  /** keep only these precision levels */
  precision?: Precision | readonly Precision[];
  pathogen?: string | readonly string[];
  antibiotic?: string | readonly string[];
  phenotype?: string | readonly string[];
}

const matches = (v: string | undefined, f: string | readonly string[] | undefined): boolean => {
  if (f === undefined) return true;
  if (typeof f === 'string') return v === f;
  return f.length === 0 || (v !== undefined && f.includes(v));
};

/**
 * Filter resistance records. Omitted keys are not constrained — note this means
 * `level`, `ward`, `setting`, `specimen` are NOT defaulted to 'all'; pass them explicitly
 * (or use `sliceResistance`) to avoid mixing strata.
 */
export function filterResistance(
  records: readonly ResistanceRecord[],
  f: ResistanceFilter,
): ResistanceRecord[] {
  return records.filter(
    (r) =>
      (f.year === undefined || r.year === f.year) &&
      inYearRange(r.year, f.years) &&
      (f.level === undefined || r.level === f.level) &&
      (f.ward === undefined || r.ward === f.ward) &&
      (f.setting === undefined || (r.setting ?? 'all') === f.setting) &&
      matches(r.precision, f.precision) &&
      (f.specimen === undefined || r.specimen === f.specimen) &&
      matches(r.pathogen, f.pathogen) &&
      matches(r.antibiotic, f.antibiotic) &&
      matches(r.phenotype, f.phenotype),
  );
}

/** Like filterResistance but defaults level/ward/setting/specimen to 'all' (one stratum). */
export function sliceResistance(
  records: readonly ResistanceRecord[],
  f: ResistanceFilter,
): ResistanceRecord[] {
  return filterResistance(records, { level: 'all', ward: 'all', setting: 'all', specimen: 'all', ...f });
}

const PRECISION_RANK: Record<Precision, number> = { table: 0, text: 1, chart_estimate: 2 };

/* ---------------- de-duplication across report editions ---------------- */

type Rankable = { year: number; precision?: Precision; reportYear?: number };

/**
 * True when `a` should win over `b` for the same stratum-year. The same data year can
 * appear in several report editions (e.g. a chart estimate in the 2022 report and a
 * table in the 2023 report). Rule: better precision wins (table > text > chart_estimate),
 * then the newer reportYear.
 */
export function isBetterRecord(a: Rankable, b: Rankable): boolean {
  const pa = a.precision ? PRECISION_RANK[a.precision] : 1;
  const pb = b.precision ? PRECISION_RANK[b.precision] : 1;
  if (pa !== pb) return pa < pb;
  return (a.reportYear ?? 0) > (b.reportYear ?? 0);
}

/** Keep one record per `keyOf(record)` (default: year) using isBetterRecord. Order preserved by first key occurrence. */
export function dedupeRecords<T extends Rankable>(records: readonly T[], keyOf: (r: T) => string = (r) => String(r.year)): T[] {
  const best = new Map<string, T>();
  for (const r of records) {
    const k = keyOf(r);
    const cur = best.get(k);
    if (!cur || isBetterRecord(r, cur)) best.set(k, r);
  }
  return [...best.values()];
}

/** Stratum key for resistance records (everything except year/value/provenance). */
export const resistanceKey = (r: ResistanceRecord): string =>
  `${r.pathogen}|${r.antibiotic}|${r.level}|${r.ward}|${r.setting ?? 'all'}|${r.specimen}|${r.year}`;

/** Remove duplicate stratum-years from overlapping report editions. */
export function dedupeResistance(records: readonly ResistanceRecord[]): ResistanceRecord[] {
  return dedupeRecords(records, resistanceKey);
}

/* ---------------- precision ---------------- */


/** The least exact precision among records (table < text < chart_estimate). */
export function worstPrecision(records: readonly { precision?: Precision }[]): Precision | undefined {
  let worst: Precision | undefined;
  for (const r of records) {
    const p = r.precision;
    if (p && (worst === undefined || PRECISION_RANK[p] > PRECISION_RANK[worst])) worst = p;
  }
  return worst;
}

export interface PrecisionBadge {
  precision: Precision;
  /** i18n key: precision.table | precision.text | precision.chart_estimate */
  labelKey: string;
  /** i18n key for the longer tooltip */
  hintKey: string;
  tone: 'neutral' | 'info' | 'warn';
}

/**
 * Badge descriptor for a value's precision. Pass a single precision or a set of
 * records (the least exact wins). Render with `<Badge tone={b.tone}>{t(b.labelKey)}</Badge>`.
 * Returns undefined when nothing to show.
 */
export function precisionBadge(
  input: Precision | readonly { precision?: Precision }[] | undefined,
): PrecisionBadge | undefined {
  const p = typeof input === 'string' ? input : input ? worstPrecision(input) : undefined;
  if (!p) return undefined;
  return {
    precision: p,
    labelKey: `precision.${p}`,
    hintKey: `precision.${p}Hint`,
    tone: p === 'chart_estimate' ? 'warn' : p === 'text' ? 'info' : 'neutral',
  };
}

/** Generic year-range filter for any dataset. */
export function filterYears<T extends { year: number }>(records: readonly T[], r?: YearRange): T[] {
  return r ? records.filter((x) => inYearRange(x.year, r)) : [...records];
}

/* ---------------- latest-year lookups ---------------- */

export function latestYear<T extends { year: number }>(
  records: readonly T[],
  pred: (r: T) => boolean = () => true,
): number | undefined {
  let best: number | undefined;
  for (const r of records) if (pred(r) && (best === undefined || r.year > best)) best = r.year;
  return best;
}

export interface LatestValue {
  year: number;
  value: number;
  /** value from the previous available year (for deltas) */
  prevYear?: number;
  prevValue?: number;
  /** value − prevValue (percentage points for pct metrics) */
  delta?: number;
}

/**
 * Latest value + previous-year comparison for one series.
 * `pick` maps a record to its numeric value (default `resistant_pct`).
 */
export function latestValue<T extends { year: number }>(
  records: readonly T[],
  pred: (r: T) => boolean,
  pick: (r: T) => number = (r) => (r as unknown as { resistant_pct: number }).resistant_pct,
): LatestValue | undefined {
  const rows = dedupeRecords(records.filter(pred) as unknown as Rankable[]).sort((a, b) => b.year - a.year) as unknown as T[];
  if (!rows.length) return undefined;
  const [cur, prev] = rows;
  const out: LatestValue = { year: cur.year, value: pick(cur) };
  if (prev && prev.year !== cur.year) {
    out.prevYear = prev.year;
    out.prevValue = pick(prev);
    out.delta = round(out.value - out.prevValue, 2);
  }
  return out;
}

/* ---------------- pivot pathogen × antibiotic ---------------- */

export interface PivotCell {
  pathogen: string;
  antibiotic: string;
  value: number;
  isolates: number | null;
  precision?: Precision;
}

export interface Pivot {
  year: number | undefined;
  pathogens: string[];
  antibiotics: string[];
  cells: PivotCell[];
  /** matrix[pathogenIdx][antibioticIdx] (null = not tested / not reported) */
  matrix: (number | null)[][];
}

/**
 * Pathogen × antibiotic matrix for one stratum. When `year` is omitted the latest
 * year in the filtered records is used. Rows/cols follow dim `order` when dims given.
 */
export function pivotPathogenAntibiotic(
  records: readonly ResistanceRecord[],
  opts: {
    year?: number;
    level?: Level;
    ward?: Ward;
    setting?: OnsetSetting;
    specimen?: Specimen;
    dims?: Record<string, Dim[]>;
    /** restrict rows / columns (and their order when dims are absent) */
    pathogens?: readonly string[];
    antibiotics?: readonly string[];
  } = {},
): Pivot {
  const stratum = sliceResistance(records, {
    level: opts.level ?? 'all',
    ward: opts.ward ?? 'all',
    setting: opts.setting ?? 'all',
    specimen: opts.specimen ?? 'all',
  });
  const scoped = stratum.filter(
    (r) => (!opts.pathogens || opts.pathogens.includes(r.pathogen)) && (!opts.antibiotics || opts.antibiotics.includes(r.antibiotic)),
  );
  const year = opts.year ?? latestYear(scoped);
  const rows = dedupeResistance(scoped.filter((r) => r.year === year));
  const pathogens = sortByDimOrder(
    [...new Set(rows.map((r) => r.pathogen))],
    opts.dims?.pathogens,
  );
  const antibiotics = sortByDimOrder(
    [...new Set(rows.map((r) => r.antibiotic))],
    opts.dims?.antibiotics,
  );
  const cells: PivotCell[] = rows.map((r) => ({
    pathogen: r.pathogen,
    antibiotic: r.antibiotic,
    value: r.resistant_pct,
    isolates: r.isolates,
    precision: r.precision,
  }));
  const pi = new Map(pathogens.map((p, i) => [p, i]));
  const ai = new Map(antibiotics.map((a, i) => [a, i]));
  const matrix = pathogens.map(() => antibiotics.map(() => null as number | null));
  for (const c of cells) matrix[pi.get(c.pathogen)!][ai.get(c.antibiotic)!] = c.value;
  return { year, pathogens, antibiotics, cells, matrix };
}

/* ---------------- series builders ---------------- */

export interface Series {
  key: string;
  data: (number | null)[];
}

export interface SeriesSet {
  years: number[];
  series: Series[];
}

/**
 * Generic long → wide: one series per `keyOf(record)`, aligned on a shared year axis.
 * Missing years are `null` (ECharts renders gaps). Duplicate (key, year) → best precision /
 * newest reportYear wins (see isBetterRecord).
 */
export function buildSeries<T extends { year: number }>(
  records: readonly T[],
  keyOf: (r: T) => string,
  valueOf: (r: T) => number | null,
  opts: { years?: number[]; keyOrder?: string[] } = {},
): SeriesSet {
  const years = opts.years ?? yearsOf(records);
  const yi = new Map(years.map((y, i) => [y, i]));
  const map = new Map<string, (number | null)[]>();
  const winners = new Map<string, T>();
  for (const r of records) {
    const i = yi.get(r.year);
    if (i === undefined) continue;
    const k = keyOf(r);
    let arr = map.get(k);
    if (!arr) {
      arr = years.map(() => null);
      map.set(k, arr);
    }
    const prev = winners.get(`${k}|${i}`);
    if (prev && !isBetterRecord(r as unknown as Rankable, prev as unknown as Rankable)) continue;
    winners.set(`${k}|${i}`, r);
    arr[i] = valueOf(r);
  }
  let keys = [...map.keys()];
  if (opts.keyOrder) {
    const order = new Map(opts.keyOrder.map((k, i) => [k, i]));
    keys = keys.sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || a.localeCompare(b));
  }
  return { years, series: keys.map((key) => ({ key, data: map.get(key)! })) };
}

export type ResistanceGroupBy = 'ward' | 'level' | 'setting' | 'specimen' | 'pathogen' | 'antibiotic' | 'phenotype' | 'combo';

/**
 * Trend lines for resistant_pct. Example: one pathogen×antibiotic split by ward:
 * `resistanceTrend(recs, { pathogen:'KPN', antibiotic:'MEM', level:'all', specimen:'all' }, 'ward')`.
 * 'combo' keys are `${pathogen}|${antibiotic}`.
 */
export function resistanceTrend(
  records: readonly ResistanceRecord[],
  filter: ResistanceFilter,
  groupBy: ResistanceGroupBy,
  opts: { keyOrder?: string[]; years?: number[] } = {},
): SeriesSet {
  const rows = filterResistance(records, filter);
  const keyOf = (r: ResistanceRecord): string =>
    groupBy === 'combo' ? `${r.pathogen}|${r.antibiotic}` : String(r[groupBy] ?? '');
  const years = opts.years ?? (filter.years ? rangeYears(filter.years, yearsOf(rows)) : undefined);
  return buildSeries(rows, keyOf, (r) => r.resistant_pct, { keyOrder: opts.keyOrder, years });
}

function rangeYears(r: YearRange, present: number[]): number[] {
  const lo = Math.min(r[0], present[0] ?? r[0]);
  const hi = Math.max(r[1], present[present.length - 1] ?? r[1]);
  const out: number[] = [];
  for (let y = Math.max(lo, r[0]); y <= Math.min(hi, r[1]); y++) out.push(y);
  return out;
}

/** Wide rows for tables/CSV from a SeriesSet: [{ year, <key>: value, … }]. */
export function seriesToRows(set: SeriesSet, label: (key: string) => string = (k) => k): Record<string, string | number | null>[] {
  return set.years.map((year, i) => {
    const row: Record<string, string | number | null> = { year };
    for (const s of set.series) row[label(s.key)] = s.data[i];
    return row;
  });
}

/* ---------------- isolates ---------------- */

/** Isolate counts filtered to one scope/level (level defaults to 'all'; missing level counts as 'all'). */
export function filterIsolates(
  records: readonly IsolateRecord[],
  f: { scope?: IsolateScope; level?: Level; years?: YearRange; organism?: string | readonly string[] } = {},
): IsolateRecord[] {
  const scope = f.scope ?? 'all';
  const level = f.level ?? 'all';
  return records.filter(
    (r) =>
      r.scope === scope &&
      (r.level ?? 'all') === level &&
      inYearRange(r.year, f.years) &&
      matches(r.organism, f.organism),
  );
}

/** Top-N organisms by isolate count for a year (defaults to latest). */
export function topIsolates(
  records: readonly IsolateRecord[],
  opts: { year?: number; scope?: IsolateScope; level?: Level; n?: number } = {},
): IsolateRecord[] {
  const rows = filterIsolates(records, { scope: opts.scope, level: opts.level });
  const year = opts.year ?? latestYear(rows);
  return rows
    .filter((r) => r.year === year)
    .sort((a, b) => b.isolates - a.isolates)
    .slice(0, opts.n ?? 10);
}

/** One series per organism over years. */
export function isolateTrend(
  records: readonly IsolateRecord[],
  f: { scope?: IsolateScope; level?: Level; years?: YearRange; organism?: string | readonly string[] } = {},
  opts: { keyOrder?: string[] } = {},
): SeriesSet {
  return buildSeries(filterIsolates(records, f), (r) => r.organism, (r) => r.isolates, opts);
}

/* ---------------- dims ---------------- */

export function sortByDimOrder(codes: string[], dims?: Dim[]): string[] {
  if (!dims?.length) return [...codes].sort();
  const order = new Map(dims.map((d, i) => [d.code, d.order ?? i]));
  return [...codes].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || a.localeCompare(b));
}

export function findDim(dims: Dim[] | undefined, code: string): Dim | undefined {
  return dims?.find((d) => d.code === code);
}

/** Distinct values of a field (useful for building filter options from data). */
export function distinct<T, K extends keyof T>(records: readonly T[], key: K): T[K][] {
  return [...new Set(records.map((r) => r[key]))];
}

/** Pathogen → antibiotic codes actually present (for dependent selects). */
export function antibioticsFor(records: readonly ResistanceRecord[], pathogen: string): string[] {
  return [...new Set(records.filter((r) => r.pathogen === pathogen).map((r) => r.antibiotic))];
}

export function round(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
