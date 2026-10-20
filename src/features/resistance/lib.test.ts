import { describe, expect, it } from 'vitest';
import isolates from '../../../public/data/isolates.json';
import resistance from '../../../public/data/resistance.json';
import type { IsolateRecord, ResistanceRecord } from '../../data/types';
import { computeHeadlines } from '../overview/headlines';
import {
  antibiogramMatrix,
  buildAntibiogramIndex,
  buildTrendIndex,
  classRuns,
  coHoGaps,
  indexSeries,
  isolateTotals,
  parseItem,
  pathogenStrata,
  summarize,
  trendPoints,
} from './lib';

const recs = resistance.records as unknown as ResistanceRecord[];
const iso = isolates.records as unknown as IsolateRecord[];
const trend = buildTrendIndex(recs);
const ab = buildAntibiogramIndex(recs);

describe('resistance lib (real data)', () => {
  it('builds one national MDRO series per phenotype, 2017–2024, deduped', () => {
    const crab = trendPoints(trend, 'CRAB');
    expect(crab.map((p) => p.year)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    expect(crab.at(-1)?.value).toBe(58.4);
    const sm = summarize(crab)!;
    expect(sm.peak.year).toBe(2022);
    expect(sm.fromPeak).toBeLessThan(0);
  });

  it('hospital-onset exceeds community-onset for every MDRO in the latest year', () => {
    const gaps = coHoGaps(trend);
    expect(gaps).toHaveLength(9);
    for (const g of gaps) expect(g.ho.value).toBeGreaterThan(g.co.value);
    const crkp = gaps.find((g) => g.phenotype === 'CRKP')!;
    expect(crkp.ho.value).toBe(29.5);
    expect(crkp.co.value).toBe(11.5);
    // sorted by gap
    expect(gaps[0].gap).toBeGreaterThanOrEqual(gaps[gaps.length - 1].gap);
  });

  it('antibiogram matrix uses table rows only and orders by class', () => {
    const m = antibiogramMatrix(ab, 2024, 'all', resistance.dims as never);
    expect(m.pathogens.length).toBeGreaterThan(20);
    const r = m.get('SAU', 'OXA')!;
    expect(r.precision).toBe('table');
    const runs = classRuns(m.antibiotics, resistance.dims as never);
    expect(runs.reduce((a, b) => a + b.span, 0)).toBe(m.antibiotics.length);
  });

  it('pathogen strata split by setting and specimen', () => {
    const ps = pathogenStrata(recs, 'KPN', undefined, resistance.dims as never);
    expect(ps.year).toBe(2024);
    expect(ps.bySetting.get('co')?.size).toBeGreaterThan(3);
    expect(ps.bySetting.get('ho')?.size).toBeGreaterThan(3);
    expect(ps.bySpecimen.get('blood')?.size).toBeGreaterThan(0);
  });

  it('isolate totals never include I+R / S subsets', () => {
    const tot = isolateTotals(iso, { scope: 'all', organism: 'TOTAL' });
    expect(tot.at(-1)?.isolates).toBe(755833);
    expect(isolateTotals(iso, { scope: 'ho', level: 'medical_center', organism: 'KPN', year: 2024 })).toHaveLength(1);
  });

  it('indexes and parses compare items', () => {
    expect(indexSeries([null, 50, 75, null])).toEqual([null, 100, 150, null]);
    expect(parseItem('CR-ECO')).toEqual({ kind: 'pheno', id: 'CR-ECO', phenotype: 'CR-ECO' });
    expect(parseItem('kpn.mem')).toMatchObject({ kind: 'pair', pathogen: 'KPN', antibiotic: 'MEM' });
    expect(parseItem('nope')).toBeUndefined();
  });

  it('computes 4–6 data-derived headlines', () => {
    const h = computeHeadlines(trend, iso);
    expect(h.length).toBeGreaterThanOrEqual(4);
    expect(h.length).toBeLessThanOrEqual(6);
    const peak = h.find((x) => x.id === 'peak');
    expect(peak?.vars.phenotype).toEqual({ t: 'raw', v: expect.any(String) });
    const isoH = h.find((x) => x.id === 'isolates')!;
    expect(isoH.vars.to).toEqual({ t: 'n', v: 755833 });
  });
});
