/**
 * Isolate-count intent over isolates.json (菌株數監測 tables). Only total rows are used
 * (`subset` absent) — MDRO I+R / S split counts are never added to totals.
 */
import { dedupeRecords } from '../../../../data/select';
import type { IsolateRecord, IsolateScope, Level } from '../../../../data/types';
import { OPEN_END } from '../parse';
import type { DataIntent, EngineAnswer } from '../types';
import { count, emptyAnswer, joinList, link, pathogenName, sentence, signedPct, tc, type ExecCtx } from './common';

/** resistance pathogen code → isolates organism code */
const ORGANISM_MAP: Record<string, string> = { ECL: 'ENT', PMI: 'PRO', SMR: 'SER', NTS: 'SAL' };

function organismName(x: ExecCtx, code: string, locale = x.locale): string {
  if (code === 'TOTAL') return tc(locale, 'ans.allOrganisms');
  const d = x.data.isolates?.dims?.organisms?.find((v) => v.code === code);
  if (x.data.resistance?.dims?.pathogens?.some((p) => p.code === code)) return pathogenName(x, code, locale);
  return d ? d.name[locale] || d.name.en : code;
}

function scopeWhere(x: ExecCtx, level: Level, scope: IsolateScope): string {
  const lv = tc(x.locale, `lv.${level}`);
  if (scope === 'all') return lv;
  const q = scope === 'co' || scope === 'ho' ? tc(x.locale, `st.${scope}`) : tc(x.locale, `sp.${scope}`);
  return `${lv}${tc(x.locale, 'paren', { x: q })}`;
}

export function execIsolates(x: ExecCtx, intent: DataIntent): EngineAnswer | null {
  const env = x.data.isolates;
  if (!env) return null;
  const base = intent.pathogen ?? (intent.phenotype ? x.idx.phenotypeMeta[intent.phenotype]?.pathogen : undefined);
  const organism = base ? (ORGANISM_MAP[base] ?? base) : 'TOTAL';
  let scope: IsolateScope = intent.specimen !== 'all' ? intent.specimen : intent.setting !== 'all' ? intent.setting : 'all';
  let level: Level = intent.level;
  const totals = env.records.filter((r) => !r.subset);
  const sel = (org: string | null, sc: IsolateScope, lv: Level) =>
    dedupeRecords(
      totals.filter((r) => (org === null || r.organism === org) && r.scope === sc && (r.level ?? 'all') === lv),
      (r) => `${r.organism}|${r.year}`,
    ).sort((a, b) => a.year - b.year);
  const notes: string[] = [];

  if (intent.mode === 'top') {
    let rows = sel(null, scope, level).filter((r) => r.organism !== 'TOTAL' && r.organism !== 'OTHER');
    if (!rows.length && (scope !== 'all' || level !== 'all')) {
      scope = 'all';
      level = 'all';
      rows = sel(null, scope, level).filter((r) => r.organism !== 'TOTAL' && r.organism !== 'OTHER');
    }
    if (!rows.length) return null;
    const years = [...new Set(rows.map((r) => r.year))];
    const year = intent.years.find((y) => years.includes(y)) ?? Math.max(...years);
    const top = rows
      .filter((r) => r.year === year)
      .sort((a, b) => b.isolates - a.isolates)
      .slice(0, 10);
    const w = scopeWhere(x, level, scope);
    return emptyAnswer({
      kind: 'data',
      text: sentence(
        x,
        tc(x.locale, 'ans.isoTop', {
          year,
          where: w,
          n: top.length,
          list: joinList(x, top.slice(0, 5).map((r) => tc(x.locale, 'ans.item', { label: organismName(x, r.organism), value: count(x, r.isolates) }))),
        }),
        tc(x.locale, 'ans.isoNote'),
      ),
      chart: {
        kind: 'hbar',
        title: tc(x.locale, 'ct.isoTop', { year }),
        categories: top.map((r) => organismName(x, r.organism)),
        series: [{ name: tc(x.locale, 'ct.isolates'), data: top.map((r) => r.isolates) }],
        unit: 'count',
      },
      links: [link(x, 'link.isolates', '/resistance', { view: 'isolates', scope: scope !== 'all' ? scope : null, level: level !== 'all' ? level : null })],
      chips: [tc(x.locale, 'chip.isoTotal')],
      facts: [`Top organisms by isolate count, ${year}, scope ${scope}, level ${level}: ${top.map((r) => `${organismName(x, r.organism, 'en')} ${r.isolates}`).join('; ')}`],
      intent,
    });
  }

  let rows = sel(organism, scope, level);
  if (!rows.length && level !== 'all') {
    level = 'all';
    rows = sel(organism, scope, level);
    if (rows.length) notes.push(tc(x.locale, 'ans.relaxed', { where: scopeWhere(x, level, scope) }));
  }
  if (!rows.length && scope !== 'all') {
    scope = 'all';
    rows = sel(organism, scope, level);
    if (rows.length) notes.push(tc(x.locale, 'ans.relaxed', { where: scopeWhere(x, level, scope) }));
  }
  if (!rows.length) return null;
  const name = organismName(x, organism);
  const w = scopeWhere(x, level, scope);
  const latest = rows[rows.length - 1];
  const pick = (y: number) => rows.find((r) => r.year === y);
  let text: string;
  let shown: IsolateRecord[] = rows;
  if (intent.mode === 'trend' || intent.years.length >= 2) {
    if (intent.yearRange) {
      const hi = intent.yearRange[1] === OPEN_END ? latest.year : intent.yearRange[1];
      const f = rows.filter((r) => r.year >= intent.yearRange![0] && r.year <= hi);
      if (f.length >= 2) shown = f;
    } else if (intent.years.length >= 2) {
      const f = intent.years.map(pick).filter((r): r is IsolateRecord => !!r);
      if (f.length >= 2) shown = rows.filter((r) => r.year >= Math.min(...f.map((v) => v.year)) && r.year <= Math.max(...f.map((v) => v.year)));
    }
    const a = shown[0];
    const b = shown[shown.length - 1];
    text = tc(x.locale, 'ans.isoTrend', { organism: name, where: w, y0: a.year, c0: count(x, a.isolates), y1: b.year, c1: count(x, b.isolates), pct: signedPct(x, a.isolates ? b.isolates / a.isolates - 1 : 0) });
  } else {
    const want = intent.years[0];
    let r = want !== undefined ? pick(want) : latest;
    if (!r) {
      notes.push(tc(x.locale, 'ans.notAvailableYear', { year: want!, name, range: `${rows[0].year}–${latest.year}`, used: latest.year }));
      r = latest;
    }
    const prev = [...rows].reverse().find((v) => v.year < r!.year);
    text = tc(x.locale, 'ans.isoValue', { year: r.year, where: w, organism: name, count: count(x, r.isolates), rank: r.rank ? tc(x.locale, 'ans.isoRank', { rank: r.rank }) : '' });
    if (prev) text = sentence(x, text, tc(x.locale, 'ans.isoDelta', { prevYear: prev.year, prev: count(x, prev.isolates), pct: signedPct(x, prev.isolates ? r.isolates / prev.isolates - 1 : 0) }));
  }
  return emptyAnswer({
    kind: 'data',
    text: sentence(x, ...notes, text, tc(x.locale, 'ans.isoNote')),
    chart: {
      kind: 'line',
      title: tc(x.locale, 'ct.isoTrend', { organism: name, where: scopeWhere(x, level, scope).replace(tc(x.locale, `lv.${level}`), tc(x.locale, `lvn.${level}`)) }),
      categories: shown.map((r) => r.year),
      series: [{ name, data: shown.map((r) => r.isolates) }],
      unit: 'count',
    },
    links: [link(x, 'link.isolates', '/resistance', { view: 'isolates', organism: organism !== 'TOTAL' ? organism : null, scope: scope !== 'all' ? scope : null, level: level !== 'all' ? level : null })],
    chips: organism === 'TOTAL' ? [tc(x.locale, 'chip.isoTop')] : [tc(x.locale, 'chip.profile', { name }), tc(x.locale, 'chip.isoTop')],
    facts: [`Isolate counts (totals), ${organismName(x, organism, 'en')}, scope ${scope}, level ${level}: ${rows.map((r) => `${r.year} ${r.isolates}`).join('; ')}`],
    intent,
    context: { pathogen: base, phenotype: intent.phenotype, level, specimen: intent.specimen },
  });
}
