/**
 * International comparison intent over glass.json (provisional curated GLASS values;
 * the TWN row is derived from the real Taiwan data — see meta.comparability.TWN).
 */
import { localized } from '../../../../data/format';
import type { GlassRecord } from '../../../../data/types';
import type { DataIntent, EngineAnswer, MiniChartSpec } from '../types';
import { emptyAnswer, joinList, link, pct, pts, sentence, tc, type ExecCtx } from './common';

interface Comparability {
  tier?: string;
  fallback?: boolean;
  specimen?: string;
  year?: number;
  precision?: string;
}

function indicatorName(x: ExecCtx, code: string, locale = x.locale): string {
  const d = x.data.glass?.dims?.indicators?.find((v) => v.code === code);
  return d ? localized(d.name, locale) : code;
}

function countryName(x: ExecCtx, iso3: string, locale = x.locale): string {
  const d = x.data.glass?.dims?.countries?.find((v) => v.code === iso3);
  return d ? localized(d.name, locale) : iso3;
}

/** Latest row per country for one indicator. */
function latestByCountry(rows: GlassRecord[], indicator: string): Map<string, GlassRecord> {
  const m = new Map<string, GlassRecord>();
  for (const r of rows) {
    if (r.indicator !== indicator) continue;
    const cur = m.get(r.iso3);
    if (!cur || r.year > cur.year) m.set(r.iso3, r);
  }
  return m;
}

function basis(x: ExecCtx, indicator: string): { text: string; en: string } {
  const comp = (x.data.glass as unknown as { meta?: { comparability?: { TWN?: Record<string, Comparability> } } })?.meta?.comparability?.TWN?.[indicator];
  if (!comp) return { text: tc(x.locale, 'basis.unknown'), en: 'derivation not documented' };
  if (comp.tier === 'blood' && !comp.fallback) return { text: tc(x.locale, 'basis.blood'), en: `Taiwan value from national blood isolates${comp.precision ? ` (${comp.precision})` : ''}` };
  return { text: tc(x.locale, 'basis.fallback'), en: `Taiwan value from the all-specimen MDRO indicator (fallback; ${comp.tier ?? 'n/a'})` };
}

export function execGlass(x: ExecCtx, intent: DataIntent): EngineAnswer | null {
  const env = x.data.glass;
  if (!env) return null;
  const rows = env.records;
  const countries = intent.countries ?? ['TWN'];
  const others = countries.filter((c) => c !== 'TWN');
  const caveat = (ind?: string) => tc(x.locale, 'ans.glassCaveat', { basis: ind ? basis(x, ind).text : tc(x.locale, 'basis.mixed') });

  // ---- no indicator: Taiwan vs one country across all indicators ----------------
  if (!intent.indicator) {
    if (!others.length) return null;
    const other = others[0];
    const inds = (env.dims?.indicators ?? []).map((d) => d.code);
    const pairs = inds
      .map((ind) => {
        const m = latestByCountry(rows, ind);
        return { ind, twn: m.get('TWN'), oth: m.get(other) };
      })
      .filter((p) => p.twn && p.oth) as { ind: string; twn: GlassRecord; oth: GlassRecord }[];
    if (!pairs.length) return emptyAnswer({ kind: 'data', text: tc(x.locale, 'ans.glassMissing', { country: countryName(x, other), indicator: '—' }) });
    const lines = pairs.map((p) =>
      tc(x.locale, 'ans.glassPairItem', {
        indicator: indicatorName(x, p.ind),
        twn: pct(x, p.twn.resistant_pct),
        country: countryName(x, other),
        other: pct(x, p.oth.resistant_pct),
      }),
    );
    const chart: MiniChartSpec = {
      kind: 'hbar',
      title: tc(x.locale, 'ct.glassPair', { country: countryName(x, other) }),
      categories: pairs.map((p) => p.ind.replace(/_BLOOD$/, '').replace(/_/g, ' ')),
      series: [
        { name: countryName(x, 'TWN'), data: pairs.map((p) => p.twn.resistant_pct) },
        { name: countryName(x, other), data: pairs.map((p) => p.oth.resistant_pct) },
      ],
      unit: 'pct',
      note: tc(x.locale, 'prec.glassShort'),
    };
    return emptyAnswer({
      kind: 'data',
      text: `${tc(x.locale, 'ans.glassPairIntro', { country: countryName(x, other), n: pairs.length })}\n${lines.map((l) => `- ${l}`).join('\n')}\n\n${caveat()}`,
      chart,
      links: [link(x, 'link.international', '/international', { countries: ['TWN', other].join(',') })],
      chips: [tc(x.locale, 'chip.vsCountry', { name: 'CRAB', country: countryName(x, other) }), tc(x.locale, 'chip.vsCountry', { name: 'MRSA', country: countryName(x, other) })],
      facts: pairs.map(
        (p) => `${indicatorName(x, p.ind, 'en')}: Taiwan ${p.twn.resistant_pct}% (${p.twn.year}; ${basis(x, p.ind).en}) vs ${countryName(x, other, 'en')} ${p.oth.resistant_pct}% (${p.oth.year}, source ${p.oth.source}; provisional curated estimate)`,
      ),
      intent,
      context: { indicator: undefined },
    });
  }

  const ind = intent.indicator;
  const m = latestByCountry(rows, ind);
  const twn = m.get('TWN');
  const indName = indicatorName(x, ind);
  const facts: string[] = [];
  if (twn) facts.push(`${indicatorName(x, ind, 'en')}: Taiwan ${twn.resistant_pct}% (${twn.year}; ${basis(x, ind).en})`);
  const chips = [tc(x.locale, 'chip.glassRank', { name: intent.phenotype ?? ind.replace(/_BLOOD$/, '') })];
  const linkTo = link(x, 'link.international', '/international', { indicator: ind, countries: countries.length > 1 ? countries.join(',') : null });

  if (intent.mode === 'compare' && others.length) {
    const present = others.filter((c) => m.has(c));
    const missing = others.filter((c) => !m.has(c));
    const notes = missing.map((c) => tc(x.locale, 'ans.glassMissing', { country: countryName(x, c), indicator: indName }));
    if (!twn || !present.length) {
      return emptyAnswer({ kind: 'data', text: sentence(x, ...notes, caveat(ind)), links: [linkTo], chips, facts, intent });
    }
    const list = present.map((c) => {
      const r = m.get(c)!;
      facts.push(`${countryName(x, c, 'en')} ${r.resistant_pct}% (${r.year}, source ${r.source}; provisional curated estimate)`);
      return tc(x.locale, 'ans.item', { label: tc(x.locale, 'ans.labelYear', { label: countryName(x, c), year: r.year }), value: pct(x, r.resistant_pct) });
    });
    const first = m.get(present[0])!;
    const d = twn.resistant_pct - first.resistant_pct;
    let text = tc(x.locale, 'ans.glassCompare', { indicator: indName, twn: pct(x, twn.resistant_pct), twnYear: twn.year, others: joinList(x, list) });
    if (Math.abs(d) >= 0.05)
      text = sentence(x, text, tc(x.locale, d > 0 ? 'ans.glassHigher' : 'ans.glassLower', { country: countryName(x, present[0]), delta: pts(x, d) }));
    const cats = ['TWN', ...present];
    return emptyAnswer({
      kind: 'data',
      text: sentence(x, ...notes, text, caveat(ind)),
      chart: {
        kind: 'bar',
        title: tc(x.locale, 'ct.glass', { indicator: indName }),
        categories: cats.map((c) => countryName(x, c)),
        series: [{ name: indName, data: cats.map((c) => m.get(c)!.resistant_pct) }],
        unit: 'pct',
        highlight: 0,
        note: tc(x.locale, 'prec.glassShort'),
      },
      links: [linkTo],
      chips,
      facts,
      intent,
      context: { indicator: ind, phenotype: intent.phenotype, pathogen: intent.pathogen },
    });
  }

  // ---- rank Taiwan among all countries --------------------------------------------
  const all = [...m.values()].sort((a, b) => b.resistant_pct - a.resistant_pct);
  if (!all.length) return null;
  const rank = twn ? all.findIndex((r) => r.iso3 === 'TWN') + 1 : 0;
  const top = all.slice(0, 10);
  if (twn && !top.includes(twn)) top.push(twn);
  for (const r of all) facts.push(`${countryName(x, r.iso3, 'en')} ${r.resistant_pct}% (${r.year})`);
  const text = twn
    ? tc(x.locale, 'ans.glassRank', {
        n: all.length,
        indicator: indName,
        twn: pct(x, twn.resistant_pct),
        rank,
        top: tc(x.locale, 'ans.item', { label: countryName(x, all[0].iso3), value: pct(x, all[0].resistant_pct) }),
      })
    : tc(x.locale, 'ans.glassMissing', { country: countryName(x, 'TWN'), indicator: indName });
  const twnIdx = top.findIndex((r) => r.iso3 === 'TWN');
  return emptyAnswer({
    kind: 'data',
    text: sentence(x, text, caveat(ind)),
    chart: {
      kind: 'hbar',
      title: tc(x.locale, 'ct.glass', { indicator: indName }),
      categories: top.map((r) => countryName(x, r.iso3)),
      series: [{ name: indName, data: top.map((r) => r.resistant_pct) }],
      unit: 'pct',
      highlight: twnIdx >= 0 ? twnIdx : undefined,
      note: tc(x.locale, 'prec.glassShort'),
    },
    links: [linkTo],
    chips: [tc(x.locale, 'chip.vsCountry', { name: intent.phenotype ?? ind.replace(/_BLOOD$/, ''), country: countryName(x, 'JPN') })],
    facts,
    intent,
    context: { indicator: ind, phenotype: intent.phenotype, pathogen: intent.pathogen },
  });
}
