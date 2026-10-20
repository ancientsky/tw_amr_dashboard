/**
 * Data-derived headline sentences for the overview (pure; formatted by the component).
 * Every number comes from the datasets — nothing here is hard-coded.
 */
import type { IsolateRecord, Level } from '../../data/types';
import { coHoGaps, isolateTotals, LEVEL_KEYS, MDROS, summarize, trendPoints, type Point, type TrendIndex } from '../resistance/lib';

export type HVar = { t: 'pct'; v: number } | { t: 'pp'; v: number } | { t: 'n'; v: number } | { t: 'rel'; v: number } | { t: 'raw'; v: string | number } | { t: 'level'; v: Level };

export interface HeadlineSpec {
  id: string;
  /** i18n key under overview.headlines.* */
  key: string;
  vars: Record<string, HVar>;
  /** key figure for the share card */
  key_value: HVar;
  /** hash-query params for the deep link into the explorer */
  link: { path: string; params: Record<string, string> };
  /** precision flags of the inputs */
  estimate: boolean;
}

export function computeHeadlines(trend: TrendIndex, isolates: readonly IsolateRecord[] = []): HeadlineSpec[] {
  const out: HeadlineSpec[] = [];
  const used = new Set<string>();

  // 1. largest community- vs hospital-onset gap (national)
  const gaps = coHoGaps(trend, 'all');
  const g = gaps[0];
  if (g) {
    used.add(`coho:${g.phenotype}`);
    out.push({
      id: 'coho',
      key: 'coho',
      vars: { phenotype: { t: 'raw', v: g.phenotype }, ho: { t: 'pct', v: g.ho.value }, co: { t: 'pct', v: g.co.value }, year: { t: 'raw', v: g.year }, ratio: { t: 'raw', v: g.ratio.toFixed(1) } },
      key_value: { t: 'pct', v: g.ho.value },
      link: { path: '/resistance', params: { phenotype: g.phenotype, overlay: '1' } },
      estimate: g.co.precision === 'chart_estimate' || g.ho.precision === 'chart_estimate',
    });
  }

  // 2. peak-and-fall: biggest drop from an interior peak
  const sums = MDROS.map((ph) => ({ ph, sm: summarize(trendPoints(trend, ph, 'all', 'all')) })).filter((x) => x.sm);
  const falls = sums.filter((x) => x.sm!.peak.year !== x.sm!.last.year && x.sm!.peak.year !== x.sm!.first.year).sort((a, b) => a.sm!.fromPeak - b.sm!.fromPeak);
  const f = falls[0];
  if (f && f.sm!.fromPeak <= -1) {
    used.add(f.ph);
    const sm = f.sm!;
    out.push({
      id: 'peak',
      key: 'peak',
      vars: { phenotype: { t: 'raw', v: f.ph }, peak: { t: 'pct', v: sm.peak.value }, peakYear: { t: 'raw', v: sm.peak.year }, latest: { t: 'pct', v: sm.last.value }, year: { t: 'raw', v: sm.last.year } },
      key_value: { t: 'pp', v: sm.fromPeak },
      link: { path: '/resistance', params: { phenotype: f.ph } },
      estimate: sm.peak.precision === 'chart_estimate' || sm.last.precision === 'chart_estimate',
    });
  }

  // 3. steepest long-run rise
  const rises = sums.filter((x) => !used.has(x.ph) && x.sm!.change > 0).sort((a, b) => b.sm!.change / Math.max(1, b.sm!.first.value) - a.sm!.change / Math.max(1, a.sm!.first.value));
  const r = rises[0];
  if (r) {
    used.add(r.ph);
    const sm = r.sm!;
    out.push({
      id: 'rise',
      key: 'rise',
      vars: {
        phenotype: { t: 'raw', v: r.ph },
        first: { t: 'pct', v: sm.first.value },
        firstYear: { t: 'raw', v: sm.first.year },
        latest: { t: 'pct', v: sm.last.value },
        year: { t: 'raw', v: sm.last.year },
        change: { t: 'pp', v: sm.change },
        rel: { t: 'rel', v: sm.first.value > 0 ? (sm.change / sm.first.value) * 100 : 0 },
      },
      key_value: { t: 'pp', v: sm.change },
      link: { path: '/resistance', params: { phenotype: r.ph } },
      estimate: sm.first.precision === 'chart_estimate' || sm.last.precision === 'chart_estimate',
    });
  }

  // 4. widest gap between hospital levels (latest year)
  let best: { ph: string; year: number; hi: { l: Level; v: number }; lo: { l: Level; v: number }; est: boolean } | undefined;
  for (const ph of MDROS) {
    const vals: { l: Level; p: Point }[] = [];
    for (const l of LEVEL_KEYS) {
      const p = l === 'all' ? undefined : trendPoints(trend, ph, l, 'all').at(-1);
      if (p) vals.push({ l, p });
    }
    if (vals.length < 2) continue;
    const year = Math.max(...vals.map((x) => x.p.year));
    const cur = vals.filter((x) => x.p.year === year).sort((a, b) => b.p.value - a.p.value);
    if (cur.length < 2) continue;
    const spread = cur[0].p.value - cur[cur.length - 1].p.value;
    if (!best || spread > best.hi.v - best.lo.v) {
      best = { ph, year, hi: { l: cur[0].l, v: cur[0].p.value }, lo: { l: cur[cur.length - 1].l, v: cur[cur.length - 1].p.value }, est: cur.some((x) => x.p.precision === 'chart_estimate') };
    }
  }
  if (best) {
    out.push({
      id: 'levels',
      key: 'levels',
      vars: { phenotype: { t: 'raw', v: best.ph }, high: { t: 'level', v: best.hi.l }, highV: { t: 'pct', v: best.hi.v }, low: { t: 'level', v: best.lo.l }, lowV: { t: 'pct', v: best.lo.v }, year: { t: 'raw', v: best.year } },
      key_value: { t: 'pct', v: best.hi.v },
      link: { path: '/resistance', params: { phenotype: best.ph } },
      estimate: best.est,
    });
  }

  // 5. isolate volume
  const tot = isolateTotals(isolates, { scope: 'all', organism: 'TOTAL' });
  if (tot.length >= 2) {
    const a = tot[0];
    const b = tot[tot.length - 1];
    out.push({
      id: 'isolates',
      key: 'isolates',
      vars: { from: { t: 'n', v: a.isolates }, fromYear: { t: 'raw', v: a.year }, to: { t: 'n', v: b.isolates }, year: { t: 'raw', v: b.year }, rel: { t: 'rel', v: ((b.isolates - a.isolates) / a.isolates) * 100 } },
      key_value: { t: 'n', v: b.isolates },
      link: { path: '/resistance', params: { view: 'pathogen' } },
      estimate: false,
    });
  }

  // 6. highest vs lowest MDRO nationally (latest year)
  const latest = sums.map((x) => ({ ph: x.ph, p: x.sm!.last })).sort((a, b) => b.p.value - a.p.value);
  if (latest.length >= 2) {
    const hi = latest[0];
    const lo = latest[latest.length - 1];
    out.push({
      id: 'range',
      key: 'range',
      vars: { high: { t: 'raw', v: hi.ph }, highV: { t: 'pct', v: hi.p.value }, low: { t: 'raw', v: lo.ph }, lowV: { t: 'pct', v: lo.p.value }, year: { t: 'raw', v: hi.p.year } },
      key_value: { t: 'pct', v: hi.p.value },
      link: { path: '/resistance', params: { view: 'compare', items: `${hi.ph},${lo.ph}` } },
      estimate: hi.p.precision === 'chart_estimate' || lo.p.precision === 'chart_estimate',
    });
  }
  return out;
}
