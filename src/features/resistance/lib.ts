/**
 * Pure helpers for the resistance explorer + overview (no React, no I/O).
 * Lives in the feature dir (shared helpers in src/data are owned elsewhere).
 */
import { dedupeResistance, isBetterRecord, type YearRange } from '../../data/select';
import type { Dim, IsolateRecord, IsolateScope, Level, OnsetSetting, Precision, ResistanceRecord, Specimen } from '../../data/types';

/** Records may carry a confidence interval (pathogen bar-chart rows). */
export type RRec = ResistanceRecord & { ci_low?: number | null; ci_high?: number | null };

/** The nine THAS section-4 MDRO indicators, in report order. */
export const MDROS = ['CRAB', 'CRE', 'CR-ECO', 'CRKP', 'CRPA', 'MRSA', 'VRE', 'VR-EFA', 'VR-EFM'] as const;

/** Defining pathogen × antibiotic pair of each MDRO phenotype (mirrors dims.phenotypes[].meta). */
export const PHENOTYPE_PAIR: Record<string, { pathogen: string; antibiotic: string }> = {
  CRAB: { pathogen: 'ABA', antibiotic: 'MEM' },
  CRE: { pathogen: 'ENB', antibiotic: 'MEM' },
  'CR-ECO': { pathogen: 'ECO', antibiotic: 'MEM' },
  CRKP: { pathogen: 'KPN', antibiotic: 'MEM' },
  CRPA: { pathogen: 'PAE', antibiotic: 'MEM' },
  MRSA: { pathogen: 'SAU', antibiotic: 'OXA' },
  VRE: { pathogen: 'ENC', antibiotic: 'VAN' },
  'VR-EFA': { pathogen: 'EFA', antibiotic: 'VAN' },
  'VR-EFM': { pathogen: 'EFM', antibiotic: 'VAN' },
};
export type Mdro = (typeof MDROS)[number];
export const GRAM_NEG_MDROS: readonly string[] = ['CRAB', 'CRE', 'CR-ECO', 'CRKP', 'CRPA'];
export const GRAM_POS_MDROS: readonly string[] = ['MRSA', 'VRE', 'VR-EFA', 'VR-EFM'];

export const LEVEL_KEYS: readonly Level[] = ['all', 'medical_center', 'regional', 'district'];
export const SETTING_KEYS: readonly OnsetSetting[] = ['all', 'co', 'ho'];
export const SPECIMEN_KEYS: readonly Specimen[] = ['all', 'blood', 'urine', 'sputum', 'pus', 'stool'];
/** Fixed categorical slots per specimen (skips the ochre slot, too close to amber when all specimens show). */
export const SPECIMEN_SLOT: Record<Specimen, number> = { all: 0, blood: 1, urine: 2, sputum: 3, pus: 5, stool: 6 };

/* ---------------- row kinds ---------------- */

export const isTrendRow = (r: ResistanceRecord): boolean => r.phenotype !== undefined && r.phenotype !== null && r.phenotype !== '';
/** Printed antibiogram tables (敏感性圖譜): exact, % non-susceptible = 100 − %S. */
export const isAntibiogramRow = (r: ResistanceRecord): boolean => !isTrendRow(r) && r.precision === 'table';
/** Pathogen bar-chart rows (by setting / specimen, optional CI). */
export const isBarRow = (r: ResistanceRecord): boolean => !isTrendRow(r) && r.precision !== 'table';

/* ---------------- points ---------------- */

export interface Point {
  year: number;
  value: number;
  precision: Precision;
  isolates: number | null;
  ci?: [number, number];
  reportYear?: number;
}

export function toPoint(r: RRec): Point {
  const p: Point = { year: r.year, value: r.resistant_pct, precision: r.precision, isolates: r.isolates ?? null, reportYear: r.reportYear };
  if (typeof r.ci_low === 'number' && typeof r.ci_high === 'number') p.ci = [r.ci_low, r.ci_high];
  return p;
}

export const isEstimate = (p: { precision?: Precision } | null | undefined): boolean => p?.precision === 'chart_estimate';

/* ---------------- MDRO trend index ---------------- */

export type TrendIndex = Map<string, Point[]>;
export const trendKey = (phenotype: string, level: Level = 'all', setting: OnsetSetting = 'all'): string => `${phenotype}|${level}|${setting}`;

/** phenotype|level|setting → points (deduped, ascending year). Specimen/ward 'all' only. */
export function buildTrendIndex(records: readonly ResistanceRecord[]): TrendIndex {
  const groups = new Map<string, RRec[]>();
  for (const r of records) {
    if (!isTrendRow(r) || r.specimen !== 'all' || r.ward !== 'all') continue;
    const k = trendKey(r.phenotype!, r.level, r.setting ?? 'all');
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(r);
  }
  const out: TrendIndex = new Map();
  for (const [k, g] of groups) out.set(k, dedupeResistance(g).sort((a, b) => a.year - b.year).map(toPoint));
  return out;
}

export function trendPoints(idx: TrendIndex, phenotype: string, level: Level = 'all', setting: OnsetSetting = 'all'): Point[] {
  return idx.get(trendKey(phenotype, level, setting)) ?? [];
}

export function inRange(points: readonly Point[], years?: YearRange): Point[] {
  return years ? points.filter((p) => p.year >= years[0] && p.year <= years[1]) : [...points];
}

/** Align points on a year axis (null = no value). */
export function alignPoints(points: readonly Point[], years: readonly number[]): (Point | null)[] {
  const m = new Map(points.map((p) => [p.year, p]));
  return years.map((y) => m.get(y) ?? null);
}

export function yearSpan(a: number, b: number): number[] {
  const out: number[] = [];
  for (let y = Math.min(a, b); y <= Math.max(a, b); y++) out.push(y);
  return out;
}

export interface Summary {
  first: Point;
  last: Point;
  peak: Point;
  trough: Point;
  /** last − first (pp) */
  change: number;
  /** last − peak (pp, ≤ 0) */
  fromPeak: number;
  /** last − previous point (pp) */
  delta?: number;
  prev?: Point;
}

/** First / peak / trough / latest / changes for one series. */
export function summarize(points: readonly Point[]): Summary | undefined {
  if (!points.length) return undefined;
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let peak = first;
  let trough = first;
  for (const p of sorted) {
    if (p.value > peak.value) peak = p;
    if (p.value < trough.value) trough = p;
  }
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
  return {
    first,
    last,
    peak,
    trough,
    change: round1(last.value - first.value),
    fromPeak: round1(last.value - peak.value),
    prev,
    delta: prev ? round1(last.value - prev.value) : undefined,
  };
}

/** Index a series to its first value in range (= 100). */
export function indexSeries(values: readonly (number | null)[]): (number | null)[] {
  const base = values.find((v): v is number => v !== null && v > 0);
  if (base === undefined) return values.map(() => null);
  return values.map((v) => (v === null ? null : round1((v / base) * 100)));
}

/* ---------------- CO vs HO ---------------- */

export interface GapRow {
  phenotype: string;
  year: number;
  co: Point;
  ho: Point;
  all?: Point;
  /** HO − CO (pp) */
  gap: number;
  /** HO / CO */
  ratio: number;
}

/** Community- vs hospital-onset % for each MDRO in one year (default: latest year with both). Sorted by gap desc. */
export function coHoGaps(idx: TrendIndex, level: Level = 'all', year?: number, phenotypes: readonly string[] = MDROS): GapRow[] {
  const rows: GapRow[] = [];
  for (const ph of phenotypes) {
    const co = trendPoints(idx, ph, level, 'co');
    const ho = trendPoints(idx, ph, level, 'ho');
    const all = trendPoints(idx, ph, level, 'all');
    const common = co.map((p) => p.year).filter((y) => ho.some((h) => h.year === y));
    const y = year !== undefined ? (common.includes(year) ? year : undefined) : common[common.length - 1];
    if (y === undefined) continue;
    const c = co.find((p) => p.year === y)!;
    const h = ho.find((p) => p.year === y)!;
    rows.push({ phenotype: ph, year: y, co: c, ho: h, all: all.find((p) => p.year === y), gap: round1(h.value - c.value), ratio: c.value > 0 ? round2(h.value / c.value) : Infinity });
  }
  return rows.sort((a, b) => b.gap - a.gap);
}

/* ---------------- antibiogram ---------------- */

export type AntibiogramIndex = Map<string, RRec>;
export const abKey = (year: number, level: Level, pathogen: string, antibiotic: string): string => `${year}|${level}|${pathogen}|${antibiotic}`;

export function buildAntibiogramIndex(records: readonly ResistanceRecord[]): AntibiogramIndex {
  const out: AntibiogramIndex = new Map();
  for (const r of records) {
    if (!isAntibiogramRow(r) || r.setting !== 'all' || r.specimen !== 'all') continue;
    const k = abKey(r.year, r.level, r.pathogen, r.antibiotic);
    const cur = out.get(k);
    if (!cur || isBetterRecord(r, cur)) out.set(k, r);
  }
  return out;
}

export function antibiogramYears(idx: AntibiogramIndex): number[] {
  return [...new Set([...idx.values()].map((r) => r.year))].sort((a, b) => a - b);
}

export interface AbMatrix {
  year: number;
  level: Level;
  pathogens: string[];
  antibiotics: string[];
  get(pathogen: string, antibiotic: string): RRec | undefined;
}

/** Pathogen × antibiotic matrix for one year/level (only rows/cols with data, dim order). */
export function antibiogramMatrix(
  idx: AntibiogramIndex,
  year: number,
  level: Level,
  dims?: Record<string, Dim[]>,
  opts: { pathogens?: readonly string[]; antibiotics?: readonly string[] } = {},
): AbMatrix {
  const ps = new Set<string>();
  const as = new Set<string>();
  for (const r of idx.values()) {
    if (r.year !== year || r.level !== level) continue;
    if (opts.pathogens && !opts.pathogens.includes(r.pathogen)) continue;
    if (opts.antibiotics && !opts.antibiotics.includes(r.antibiotic)) continue;
    ps.add(r.pathogen);
    as.add(r.antibiotic);
  }
  const pathogens = opts.pathogens ? opts.pathogens.filter((p) => ps.has(p)) : orderBy([...ps], dims?.pathogens);
  const antibiotics = opts.antibiotics ? opts.antibiotics.filter((a) => as.has(a)) : orderAntibiotics([...as], dims);
  return { year, level, pathogens, antibiotics, get: (p, a) => idx.get(abKey(year, level, p, a)) };
}

export function orderBy(codes: string[], dims?: Dim[]): string[] {
  if (!dims?.length) return [...codes].sort();
  const o = new Map(dims.map((d, i) => [d.code, d.order ?? i]));
  return [...codes].sort((a, b) => (o.get(a) ?? 1e9) - (o.get(b) ?? 1e9) || a.localeCompare(b));
}

/** Antibiotics ordered by class order, then antibiotic order. */
export function orderAntibiotics(codes: string[], dims?: Record<string, Dim[]>): string[] {
  const abx = new Map((dims?.antibiotics ?? []).map((d) => [d.code, d]));
  const cls = new Map((dims?.antibioticClasses ?? []).map((d, i) => [d.code, d.order ?? i]));
  const key = (c: string) => {
    const d = abx.get(c);
    return [cls.get(d?.group ?? '') ?? 1e6, d?.order ?? 1e6] as const;
  };
  return [...codes].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || a.localeCompare(b);
  });
}

export function classOf(dims: Record<string, Dim[]> | undefined, antibiotic: string): string {
  return dims?.antibiotics?.find((d) => d.code === antibiotic)?.group ?? 'other';
}

/** Consecutive runs of the same class over an ordered antibiotic list (for grouped headers). */
export function classRuns(antibiotics: readonly string[], dims?: Record<string, Dim[]>): { cls: string; start: number; span: number }[] {
  const runs: { cls: string; start: number; span: number }[] = [];
  antibiotics.forEach((a, i) => {
    const c = classOf(dims, a);
    const last = runs[runs.length - 1];
    if (last && last.cls === c) last.span++;
    else runs.push({ cls: c, start: i, span: 1 });
  });
  return runs;
}

export function mean(values: readonly (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/* ---------------- pathogen strata (bar charts) ---------------- */

export interface PathogenStrata {
  year: number | undefined;
  years: number[];
  antibiotics: string[];
  /** setting → antibiotic → point (level all, specimen all) */
  bySetting: Map<OnsetSetting, Map<string, Point>>;
  /** specimen → antibiotic → point (level all, setting all) */
  bySpecimen: Map<Specimen, Map<string, Point>>;
}

/**
 * Pathogen-level % resistant by onset setting and by specimen for one year.
 * 'all' values come from the antibiogram table where present (exact), else the bar chart.
 * The antibiotic list is the set the report charts for this pathogen (bar rows), falling back
 * to all antibiogram agents when the pathogen has no bar chart.
 */
export function pathogenStrata(records: readonly ResistanceRecord[], pathogen: string, year?: number, dims?: Record<string, Dim[]>): PathogenStrata {
  const own = records.filter((r) => r.pathogen === pathogen && !isTrendRow(r) && r.level === 'all' && r.ward === 'all');
  const bars = own.filter(isBarRow);
  const years = [...new Set((bars.length ? bars : own).map((r) => r.year))].sort((a, b) => a - b);
  const y = year !== undefined && years.includes(year) ? year : years[years.length - 1];
  const rows = dedupeResistance(own.filter((r) => r.year === y));
  const barAbx = new Set(bars.filter((r) => r.year === y).map((r) => r.antibiotic));
  const antibiotics = orderAntibiotics([...new Set(rows.map((r) => r.antibiotic))].filter((a) => !barAbx.size || barAbx.has(a)), dims);
  const bySetting = new Map<OnsetSetting, Map<string, Point>>();
  const bySpecimen = new Map<Specimen, Map<string, Point>>();
  const put = <K>(m: Map<K, Map<string, Point>>, k: K, r: RRec) => {
    let g = m.get(k);
    if (!g) m.set(k, (g = new Map()));
    g.set(r.antibiotic, toPoint(r));
  };
  for (const r of rows) {
    if (!antibiotics.includes(r.antibiotic)) continue;
    const setting = r.setting ?? 'all';
    if (r.specimen === 'all') put(bySetting, setting, r);
    if (setting === 'all') put(bySpecimen, r.specimen, r);
  }
  return { year: y, years, antibiotics, bySetting, bySpecimen };
}

/* ---------------- isolates ---------------- */

/** isolates.json organism codes that differ from resistance pathogen codes. */
export const ISOLATE_TO_PATHOGEN: Record<string, string> = { ENT: 'ECL', PRO: 'PMI', SER: 'SMR' };
export const PATHOGEN_TO_ISOLATE: Record<string, string> = Object.fromEntries(Object.entries(ISOLATE_TO_PATHOGEN).map(([a, b]) => [b, a]));

/** Totals only (never MDRO I+R / S subsets). Level missing = 'all'. */
export function isolateTotals(records: readonly IsolateRecord[], f: { scope?: IsolateScope; level?: Level; organism?: string; year?: number } = {}): IsolateRecord[] {
  const scope = f.scope ?? 'all';
  const level = f.level ?? 'all';
  const best = new Map<string, IsolateRecord>();
  for (const r of records) {
    if (r.subset || r.scope !== scope || (r.level ?? 'all') !== level) continue;
    if (f.organism && r.organism !== f.organism) continue;
    if (f.year !== undefined && r.year !== f.year) continue;
    const k = `${r.organism}|${r.year}`;
    const cur = best.get(k);
    if (!cur || isBetterRecord(r, cur)) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => a.year - b.year);
}

/* ---------------- compare items ---------------- */

export type CompareItem = { kind: 'pheno'; id: string; phenotype: string } | { kind: 'pair'; id: string; pathogen: string; antibiotic: string };

/** "CRAB" → phenotype; "KPN.MEM" → pathogen × antibiotic pair. */
export function parseItem(s: string): CompareItem | undefined {
  const v = s.trim();
  if (!v) return undefined;
  if ((MDROS as readonly string[]).includes(v)) return { kind: 'pheno', id: v, phenotype: v };
  const m = /^([A-Z]{2,4})\.([A-Z]{2,4})$/.exec(v.toUpperCase());
  return m ? { kind: 'pair', id: `${m[1]}.${m[2]}`, pathogen: m[1], antibiotic: m[2] } : undefined;
}

export function parseList(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ---------------- misc ---------------- */

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Nice upper bound for a % axis (multiple of 10, ≤ 100). */
export function niceMax(max: number, pad = 4): number {
  return Math.min(100, Math.max(10, Math.ceil((max + pad) / 10) * 10));
}
