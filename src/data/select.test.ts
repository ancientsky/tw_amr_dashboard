import { describe, expect, it } from 'vitest';
import resistanceFixture from './fixtures/resistance.json';
import isolatesFixture from './fixtures/isolates.json';
import type { Envelope, IsolateRecord, ResistanceRecord } from './types';
import {
  buildSeries,
  clampYearRange,
  extentYears,
  filterIsolates,
  filterResistance,
  formatYearRange,
  isolateTrend,
  latestValue,
  latestYear,
  parseYearRange,
  pivotPathogenAntibiotic,
  precisionBadge,
  resistanceTrend,
  seriesToRows,
  sliceResistance,
  sortByDimOrder,
  topIsolates,
  worstPrecision,
  yearsOf,
} from './select';

const env = resistanceFixture as unknown as Envelope<ResistanceRecord>;
const recs = env.records;
const iso = (isolatesFixture as unknown as Envelope<IsolateRecord>).records;

describe('year helpers', () => {
  it('parses ranges', () => {
    expect(parseYearRange('2014-2024')).toEqual([2014, 2024]);
    expect(parseYearRange('2024-2014')).toEqual([2014, 2024]);
    expect(parseYearRange('2020')).toEqual([2020, 2020]);
    expect(parseYearRange('abc')).toBeUndefined();
    expect(parseYearRange(null)).toBeUndefined();
    expect(formatYearRange([2018, 2024])).toBe('2018-2024');
    expect(formatYearRange([2020, 2020])).toBe('2020');
  });
  it('computes extents and clamps', () => {
    expect(extentYears(recs)).toEqual([2017, 2024]);
    expect(yearsOf(recs)[0]).toBe(2017);
    expect(clampYearRange([2000, 2030], [2017, 2024])).toEqual([2017, 2024]);
    expect(extentYears([])).toBeUndefined();
  });
});

describe('filterResistance / sliceResistance', () => {
  it('filters by year range, level, ward, specimen', () => {
    const rows = filterResistance(recs, {
      pathogen: 'KPN',
      antibiotic: 'MEM',
      level: 'all',
      ward: 'icu',
      setting: 'all',
      specimen: 'all',
      years: [2020, 2022],
    });
    expect(rows.map((r) => r.year)).toEqual([2020, 2021, 2022]);
    expect(rows.every((r) => r.ward === 'icu' && r.level === 'all')).toBe(true);
  });
  it('accepts arrays and empty arrays for codes', () => {
    const both = sliceResistance(recs, { pathogen: ['KPN', 'ABA'], antibiotic: 'MEM', year: 2024 });
    expect(new Set(both.map((r) => r.pathogen))).toEqual(new Set(['KPN', 'ABA']));
    const any = sliceResistance(recs, { pathogen: [], antibiotic: 'MEM', year: 2024 });
    expect(any.length).toBeGreaterThan(both.length);
  });
  it('slice defaults to the all/all/all/all stratum', () => {
    const rows = sliceResistance(recs, { pathogen: 'SAU', antibiotic: 'OXA' });
    expect(rows.every((r) => r.level === 'all' && r.ward === 'all' && r.specimen === 'all' && r.setting === 'all')).toBe(
      true,
    );
    expect(rows).toHaveLength(8);
  });
  it('filters by onset setting and precision', () => {
    const ho = sliceResistance(recs, { pathogen: 'KPN', antibiotic: 'MEM', setting: 'ho' });
    const co = sliceResistance(recs, { pathogen: 'KPN', antibiotic: 'MEM', setting: 'co' });
    expect(ho).toHaveLength(8);
    expect(ho.at(-1)!.resistant_pct).toBeGreaterThan(co.at(-1)!.resistant_pct);
    const exact = sliceResistance(recs, { pathogen: 'KPN', antibiotic: 'MEM', precision: 'table' });
    expect(exact.every((r) => r.precision === 'table')).toBe(true);
    expect(exact.length).toBeLessThan(8);
    const blood = filterResistance(recs, { specimen: 'blood' });
    expect(blood.length).toBeGreaterThan(0);
  });
});

describe('precision helpers', () => {
  it('finds the least exact precision', () => {
    expect(worstPrecision([{ precision: 'table' }, { precision: 'text' }])).toBe('text');
    expect(worstPrecision([{ precision: 'table' }, { precision: 'chart_estimate' }, { precision: 'text' }])).toBe(
      'chart_estimate',
    );
    expect(worstPrecision([])).toBeUndefined();
  });
  it('builds badge descriptors', () => {
    expect(precisionBadge('chart_estimate')).toEqual({
      precision: 'chart_estimate',
      labelKey: 'precision.chart_estimate',
      hintKey: 'precision.chart_estimateHint',
      tone: 'warn',
    });
    expect(precisionBadge('table')?.tone).toBe('neutral');
    const series = sliceResistance(recs, { pathogen: 'ABA', antibiotic: 'MEM' });
    expect(precisionBadge(series)?.precision).toBe('chart_estimate');
    expect(precisionBadge(undefined)).toBeUndefined();
  });
});

describe('latest lookups', () => {
  it('finds latest year with predicate', () => {
    expect(latestYear(recs)).toBe(2024);
    expect(latestYear(recs, (r) => r.specimen === 'blood')).toBe(2024);
    expect(latestYear([])).toBeUndefined();
  });
  it('returns value with delta vs previous year', () => {
    const lv = latestValue(
      sliceResistance(recs, { pathogen: 'KPN', antibiotic: 'MEM', ward: 'icu' }),
      () => true,
    )!;
    expect(lv.year).toBe(2024);
    expect(lv.prevYear).toBe(2023);
    expect(lv.delta).toBeCloseTo(lv.value - lv.prevValue!, 5);
    expect(latestValue(recs, () => false)).toBeUndefined();
  });
});

describe('pivotPathogenAntibiotic', () => {
  it('builds a dim-ordered matrix for the latest year', () => {
    const pv = pivotPathogenAntibiotic(recs, { dims: env.dims });
    expect(pv.year).toBe(2024);
    expect(pv.pathogens[0]).toBe('SAU');
    expect(pv.pathogens).toContain('ABA');
    expect(pv.antibiotics.indexOf('OXA')).toBeLessThan(pv.antibiotics.indexOf('MEM'));
    const r = pv.pathogens.indexOf('ABA');
    const c = pv.antibiotics.indexOf('MEM');
    expect(pv.matrix[r][c]).toBeGreaterThan(60);
    // SAU was never tested against colistin → null
    expect(pv.matrix[pv.pathogens.indexOf('SAU')][pv.antibiotics.indexOf('COL')]).toBeNull();
    expect(pv.cells.length).toBe(pv.matrix.flat().filter((v) => v !== null).length);
  });
  it('honours explicit year', () => {
    expect(pivotPathogenAntibiotic(recs, { year: 2019 }).year).toBe(2019);
  });
});

describe('series builders', () => {
  it('splits a combo by ward over a year range with aligned axis', () => {
    const set = resistanceTrend(
      recs,
      { pathogen: 'KPN', antibiotic: 'MEM', level: 'all', setting: 'all', specimen: 'all', years: [2018, 2024] },
      'ward',
      { keyOrder: ['all', 'icu', 'non_icu'] },
    );
    expect(set.years).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    expect(set.series.map((s) => s.key)).toEqual(['all', 'icu', 'non_icu']);
    const icu = set.series[1].data;
    expect(icu[icu.length - 1]!).toBeGreaterThan(icu[0]!); // CRKP ICU rising
  });
  it('fills gaps with null', () => {
    const set = buildSeries(
      [
        { year: 2020, k: 'a', v: 1 },
        { year: 2022, k: 'a', v: 3 },
        { year: 2021, k: 'b', v: 2 },
      ],
      (r) => r.k,
      (r) => r.v,
    );
    expect(set.years).toEqual([2020, 2021, 2022]);
    expect(set.series.find((s) => s.key === 'a')!.data).toEqual([1, null, 3]);
    expect(seriesToRows(set)[1]).toEqual({ year: 2021, a: null, b: 2 });
  });
  it('sorts by dim order', () => {
    expect(sortByDimOrder(['ABA', 'SAU', 'KPN'], env.dims?.pathogens)).toEqual(['SAU', 'KPN', 'ABA']);
    expect(sortByDimOrder(['b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('isolates', () => {
  it('filters by scope and ranks', () => {
    expect(filterIsolates(iso, { scope: 'blood' }).every((r) => r.scope === 'blood')).toBe(true);
    const top = topIsolates(iso, { n: 3 });
    expect(top).toHaveLength(3);
    expect(top[0].organism).toBe('ECO');
    expect(top[0].isolates).toBeGreaterThanOrEqual(top[1].isolates);
    const tr = isolateTrend(iso, { organism: ['ECO', 'KPN'] });
    expect(tr.series).toHaveLength(2);
    expect(tr.years).toHaveLength(8);
  });
});
