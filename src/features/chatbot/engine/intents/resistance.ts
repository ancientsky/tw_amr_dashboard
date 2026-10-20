/**
 * Resistance intents over resistance.json:
 *  - kind 'phenotype' → MDRO trend indicators (rows with `phenotype`, 2017–2024)
 *  - kind 'drug'      → drug-level rows (antibiogram tables + pathogen charts, no `phenotype`)
 * Modes: value · trend · compareYears · rankLevels · byLevel · bySetting · profile.
 */
import type { Level, OnsetSetting, ResistanceRecord } from '../../../../data/types';
import { CLASS_PREFERRED, type SpecimenLike } from '../entities';
import { OPEN_END } from '../parse';
import type { DataIntent, EngineAnswer, MiniChartSpec } from '../types';
import {
  LEVELS3,
  antibioticName,
  chipName,
  emptyAnswer,
  fmtPrecisionEn,
  joinList,
  link,
  pathogenName,
  phenotypeName,
  pct,
  precisionNote,
  pts,
  resistanceRows,
  sentence,
  signedPts,
  sourceNote,
  tc,
  extraParen,
  where,
  whereEn,
  worst,
  type ExecCtx,
} from './common';

interface Subject {
  /** row predicate (ignores stratum) */
  match: (r: ResistanceRecord) => boolean;
  name: string;
  nameEn: string;
  chip: string;
  phenotype?: string;
  pathogen?: string;
  antibiotic?: string;
}

type Stratum = { level: Level; setting: OnsetSetting; specimen: 'all' | SpecimenLike };

const byYear = (a: ResistanceRecord, b: ResistanceRecord) => a.year - b.year;

function seriesFor(rows: ResistanceRecord[], s: Stratum): ResistanceRecord[] {
  return rows.filter((r) => r.level === s.level && (r.setting ?? 'all') === s.setting && r.specimen === s.specimen && r.ward === 'all').sort(byYear);
}

function subjectFor(x: ExecCtx, intent: DataIntent, rows: ResistanceRecord[], stratum: Stratum): Subject | null {
  if (intent.kind === 'phenotype' && intent.phenotype) {
    const code = intent.phenotype;
    return {
      match: (r) => r.phenotype === code,
      name: phenotypeName(x, code),
      nameEn: phenotypeName(x, code, 'en'),
      chip: code,
      phenotype: code,
      pathogen: intent.pathogen,
      antibiotic: x.idx.phenotypeMeta[code]?.antibiotic,
    };
  }
  const p = intent.pathogen;
  if (!p) return null;
  const candidates = [
    ...(intent.antibiotics ?? []),
    ...(intent.drugClass ? (CLASS_PREFERRED[intent.drugClass] ?? []) : []),
  ];
  const drugRows = rows.filter((r) => !r.phenotype && r.pathogen === p);
  // prefer an antibiotic present in the requested stratum, then anywhere
  const inStratum = (a: string) => drugRows.some((r) => r.antibiotic === a && seriesFor([r], stratum).length > 0);
  const anywhere = (a: string) => drugRows.some((r) => r.antibiotic === a);
  const ab = candidates.find(inStratum) ?? candidates.find(anywhere);
  if (!ab) return null;
  return {
    match: (r) => !r.phenotype && r.pathogen === p && r.antibiotic === ab,
    name: tc(x.locale, 'ans.drugName', { pathogen: pathogenName(x, p), antibiotic: antibioticName(x, ab) }),
    nameEn: `${pathogenName(x, p, 'en')} resistance to ${antibioticName(x, ab, 'en')}`,
    chip: chipName(x, intent.phenotype, p, ab),
    phenotype: intent.phenotype,
    pathogen: p,
    antibiotic: ab,
  };
}

function lineChart(x: ExecCtx, title: string, lines: { name: string; rows: ResistanceRecord[] }[], note?: string): MiniChartSpec {
  const years = [...new Set(lines.flatMap((l) => l.rows.map((r) => r.year)))].sort((a, b) => a - b);
  return {
    kind: 'line',
    title,
    categories: years,
    series: lines.map((l) => ({ name: l.name, data: years.map((y) => l.rows.find((r) => r.year === y)?.resistant_pct ?? null) })),
    unit: 'pct',
    note,
  };
}

function explorerLink(x: ExecCtx, subj: Subject, s: Stratum, years: number[]) {
  return link(x, 'link.explorer', '/resistance', {
    phenotype: subj.phenotype,
    pathogen: subj.pathogen,
    antibiotic: subj.antibiotic,
    level: s.level !== 'all' ? s.level : null,
    setting: s.setting !== 'all' ? s.setting : null,
    specimen: s.specimen !== 'all' ? s.specimen : null,
    years: years.length ? `${Math.min(...years)}-${Math.max(...years)}` : null,
  });
}

function seriesFact(subj: Subject, s: Stratum, rows: ResistanceRecord[]): string {
  return `${subj.nameEn} — ${whereEn(s.level, s.setting, s.specimen)}: ${rows
    .map((r) => `${r.year} ${r.resistant_pct}%${r.isolates ? ` (n=${r.isolates})` : ''} [${fmtPrecisionEn(r.precision)}; report ${r.reportYear ?? '?'}]`)
    .join('; ')}`;
}

function followUps(x: ExecCtx, subj: Subject, mode: string, intent: DataIntent): string[] {
  const n = subj.chip;
  if (!n) return [];
  const out: string[] = [];
  if (mode !== 'rankLevels') out.push(tc(x.locale, 'chip.rankLevels', { name: n }));
  if (mode !== 'trend') out.push(tc(x.locale, 'chip.trend', { name: n }));
  if (mode !== 'bySetting' && intent.kind === 'phenotype') out.push(tc(x.locale, 'chip.bySetting', { name: n }));
  if (subj.phenotype || subj.pathogen === 'SAU' || subj.pathogen === 'ABA') out.push(tc(x.locale, 'chip.vsJapan', { name: n }));
  if (subj.phenotype) out.push(tc(x.locale, 'chip.what', { name: n }));
  return out.slice(0, 4);
}

/** Main entry for 'phenotype' and 'drug' intents. */
export function execResistance(x: ExecCtx, intent: DataIntent): EngineAnswer | null {
  const all = resistanceRows(x);
  if (!all.length) return null;
  if (intent.kind === 'drug' && intent.mode === 'profile') return execProfile(x, intent, all);

  let stratum: Stratum = { level: intent.level, setting: intent.setting, specimen: intent.specimen };
  const subj = subjectFor(x, intent, all, stratum);
  if (!subj) return null;
  const rows = all.filter(subj.match);
  if (!rows.length) return null;

  // relax the stratum until something matches
  const notes: string[] = [];
  const levelMode = intent.mode === 'rankLevels' || intent.mode === 'byLevel';
  const orig: Stratum = levelMode ? { ...stratum, level: 'all' } : stratum;
  const tries: Stratum[] = [
    orig,
    { ...orig, setting: 'all' },
    ...(levelMode ? [] : [{ ...orig, level: 'all' as Level }, { ...orig, setting: 'all' as OnsetSetting, level: 'all' as Level }]),
    { ...orig, specimen: 'all' },
    { level: levelMode ? 'all' : orig.level, setting: 'all', specimen: 'all' },
    { level: 'all', setting: 'all', specimen: 'all' },
  ];
  const ok = (s: Stratum) =>
    levelMode ? LEVELS3.some((lv) => seriesFor(rows, { ...s, level: lv }).length > 0) : seriesFor(rows, s).length > 0;
  const found = tries.find(ok);
  if (!found) return null;
  stratum = found;
  let series = seriesFor(rows, stratum);
  if (!series.length) series = seriesFor(rows, { ...stratum, level: LEVELS3.find((lv) => seriesFor(rows, { ...stratum, level: lv }).length) ?? 'all' });
  if (found !== orig) notes.push(tc(x.locale, 'ans.relaxed', { where: where(x, levelMode ? 'all' : stratum.level, stratum.setting, stratum.specimen) }));

  const available = series.map((r) => r.year);
  const latest = available[available.length - 1];
  const pick = (y: number) => series.find((r) => r.year === y);
  const target = (() => {
    const want = intent.years[0];
    if (want === undefined || intent.mode === 'trend') return latest;
    if (pick(want)) return want;
    notes.push(
      tc(x.locale, 'ans.notAvailableYear', {
        year: want,
        name: subj.name,
        range: available.length > 1 ? `${available[0]}–${latest}` : String(latest),
        used: latest,
      }),
    );
    return latest;
  })();

  const facts = [seriesFact(subj, stratum, series)];
  const w = where(x, stratum.level, stratum.setting, stratum.specimen);
  const wNoun = where(x, stratum.level, stratum.setting, stratum.specimen, 'noun');
  let text = '';
  let chart: MiniChartSpec | undefined;
  const shownRows: ResistanceRecord[] = [];

  switch (intent.mode) {
    case 'rankLevels':
    case 'byLevel': {
      const perLevel = LEVELS3
        .map((lv) => ({ lv, rows: seriesFor(rows, { ...stratum, level: lv }) }))
        .filter((v) => v.rows.length);
      if (!perLevel.length) return null;
      const yearRows = perLevel.map((v) => ({ lv: v.lv, r: v.rows.find((r) => r.year === target) })).filter((v): v is { lv: Exclude<Level, 'all'>; r: ResistanceRecord } => !!v.r);
      const national = seriesFor(rows, { ...stratum, level: 'all' });
      for (const v of perLevel) facts.push(seriesFact(subj, { ...stratum, level: v.lv }, v.rows));
      if (yearRows.length) {
        const sorted = [...yearRows].sort((a, b) => b.r.resistant_pct - a.r.resistant_pct);
        const [top, ...rest] = sorted;
        const extra = extraParen(x, stratum.setting, stratum.specimen);
        const nat = national.find((r) => r.year === target);
        text = tc(x.locale, 'ans.rankLevels', {
          year: target,
          name: subj.name,
          extra,
          top: tc(x.locale, `lvn.${top.lv}`),
          topValue: pct(x, top.r.resistant_pct),
          rest: joinList(
            x,
            rest.map((v) => tc(x.locale, 'ans.item', { label: tc(x.locale, `lvn.${v.lv}`), value: pct(x, v.r.resistant_pct) })),
          ),
        });
        if (nat) text = sentence(x, text, tc(x.locale, 'ans.nationalRef', { value: pct(x, nat.resistant_pct) }));
        shownRows.push(...yearRows.map((v) => v.r));
      }
      if (intent.mode === 'byLevel' && (series.length > 1 || intent.yearRange)) {
        chart = lineChart(
          x,
          tc(x.locale, 'ct.byLevel', { name: subj.chip || subj.name, extra: extraParen(x, stratum.setting, stratum.specimen) }),
          [
            ...(national.length ? [{ name: tc(x.locale, 'lvn.all'), rows: national }] : []),
            ...perLevel.map((v) => ({ name: tc(x.locale, `lvn.${v.lv}`), rows: v.rows })),
          ],
        );
      } else {
        const cats = [...(national.find((r) => r.year === target) ? ['all' as Level] : []), ...yearRows.map((v) => v.lv)];
        const values = cats.map((lv) => (lv === 'all' ? national.find((r) => r.year === target)!.resistant_pct : yearRows.find((v) => v.lv === lv)!.r.resistant_pct));
        const maxIdx = cats.reduce((best, lv, i) => (lv !== 'all' && (best < 0 || values[i] > values[best]) ? i : best), -1);
        chart = {
          kind: 'bar',
          title: tc(x.locale, 'ct.rank', { name: subj.chip || subj.name, year: target }),
          categories: cats.map((lv) => tc(x.locale, `lvn.${lv}`)),
          series: [{ name: subj.chip || subj.name, data: values }],
          unit: 'pct',
          highlight: maxIdx >= 0 ? maxIdx : undefined,
        };
      }
      break;
    }
    case 'bySetting': {
      const co = seriesFor(rows, { ...stratum, setting: 'co' });
      const ho = seriesFor(rows, { ...stratum, setting: 'ho' });
      const c = co.find((r) => r.year === target);
      const h = ho.find((r) => r.year === target);
      if (!c && !h) return null;
      const ratio = c && h && c.resistant_pct > 0 ? h.resistant_pct / c.resistant_pct : 0;
      text = tc(x.locale, 'ans.bySetting', {
        year: target,
        name: subj.name,
        where: where(x, stratum.level, 'all', stratum.specimen),
        ho: pct(x, h?.resistant_pct),
        co: pct(x, c?.resistant_pct),
        ratio: ratio >= 1.2 ? tc(x.locale, 'ans.ratio', { x: (Math.round(ratio * 10) / 10).toString() }) : '',
      });
      shownRows.push(...[c, h].filter((v): v is ResistanceRecord => !!v));
      facts.push(seriesFact(subj, { ...stratum, setting: 'co' }, co), seriesFact(subj, { ...stratum, setting: 'ho' }, ho));
      chart = lineChart(x, tc(x.locale, 'ct.bySetting', { name: subj.chip || subj.name, where: where(x, stratum.level, 'all', stratum.specimen, 'noun') }), [
        { name: tc(x.locale, 'stShort.ho'), rows: ho },
        { name: tc(x.locale, 'stShort.co'), rows: co },
      ]);
      stratum = { ...stratum, setting: 'all' };
      break;
    }
    case 'compareYears': {
      const [a, b] = [...intent.years].sort((m, n) => m - n);
      const ra = pick(a);
      const rb = pick(b);
      if (!ra || !rb) {
        const missing = [a, b].filter((y) => !pick(y));
        notes.push(tc(x.locale, 'ans.notAvailableYears', { years: missing.join(tc(x.locale, 'listSep')), range: `${available[0]}–${latest}` }));
        const r = pick(latest)!;
        text = tc(x.locale, 'ans.value', { year: latest, where: w, name: subj.name, value: pct(x, r.resistant_pct) });
        shownRows.push(r);
      } else {
        text = tc(x.locale, 'ans.compareYears', {
          name: subj.name,
          where: w,
          y0: a,
          v0: pct(x, ra.resistant_pct),
          y1: b,
          v1: pct(x, rb.resistant_pct),
          delta: signedPts(x, rb.resistant_pct - ra.resistant_pct),
        });
        shownRows.push(ra, rb);
      }
      chart = lineChart(x, tc(x.locale, 'ct.trend', { name: subj.chip || subj.name, where: wNoun }), [{ name: subj.chip || subj.name, rows: series }]);
      break;
    }
    case 'trend': {
      let rng = series;
      if (intent.yearRange) {
        const [lo, hiRaw] = intent.yearRange;
        const hi = hiRaw === OPEN_END ? latest : hiRaw;
        const f = series.filter((r) => r.year >= lo && r.year <= hi);
        if (f.length >= 2) rng = f;
        else notes.push(tc(x.locale, 'ans.rangeClamped', { range: `${available[0]}–${latest}` }));
      }
      const first = rng[0];
      const last = rng[rng.length - 1];
      const peak = rng.reduce((m, r) => (r.resistant_pct > m.resistant_pct ? r : m), first);
      text = tc(x.locale, 'ans.trend', {
        name: subj.name,
        where: w,
        y0: first.year,
        v0: pct(x, first.resistant_pct),
        y1: last.year,
        v1: pct(x, last.resistant_pct),
        delta: signedPts(x, last.resistant_pct - first.resistant_pct),
        peak: peak !== first && peak !== last && peak.resistant_pct > Math.max(first.resistant_pct, last.resistant_pct) ? tc(x.locale, 'ans.peak', { year: peak.year, value: pct(x, peak.resistant_pct) }) : '',
      });
      if (rng.length === 1) text = tc(x.locale, 'ans.value', { year: last.year, where: w, name: subj.name, value: pct(x, last.resistant_pct) });
      shownRows.push(...rng);
      const lines = [{ name: subj.chip || subj.name, rows: rng }];
      chart = lineChart(x, tc(x.locale, 'ct.trend', { name: subj.chip || subj.name, where: wNoun }), lines);
      break;
    }
    default: {
      const r = pick(target)!;
      const prev = [...series].reverse().find((v) => v.year < target);
      text = tc(x.locale, 'ans.value', { year: target, where: w, name: subj.name, value: pct(x, r.resistant_pct) });
      if (r.isolates) text = sentence(x, text, tc(x.locale, 'ans.isolatesTested', { n: r.isolates.toLocaleString(x.locale) }));
      if (prev) {
        const d = r.resistant_pct - prev.resistant_pct;
        text = sentence(
          x,
          text,
          Math.abs(d) < 0.05
            ? tc(x.locale, 'ans.deltaFlat', { prevYear: prev.year, prev: pct(x, prev.resistant_pct) })
            : tc(x.locale, d > 0 ? 'ans.deltaUp' : 'ans.deltaDown', { prevYear: prev.year, prev: pct(x, prev.resistant_pct), delta: pts(x, d) }),
        );
      }
      shownRows.push(r);
      const lines = [{ name: tc(x.locale, `lvn.${stratum.level}`), rows: series }];
      if (stratum.level !== 'all') {
        const nat = seriesFor(rows, { ...stratum, level: 'all' });
        if (nat.length) lines.push({ name: tc(x.locale, 'lvn.all'), rows: nat });
      }
      chart = lineChart(
        x,
        stratum.level === 'all' ? tc(x.locale, 'ct.trend', { name: subj.chip || subj.name, where: wNoun }) : tc(x.locale, 'ct.byLevel', { name: subj.chip || subj.name, extra: extraParen(x, stratum.setting, stratum.specimen) }),
        lines,
      );
      if (lines.length === 1) chart.series[0].name = subj.chip || subj.name;
      break;
    }
  }

  const prec = worst(shownRows.length ? shownRows : series);
  const report = Math.max(...(shownRows.length ? shownRows : series).map((r) => r.reportYear ?? 0)) || undefined;
  if (chart && prec === 'chart_estimate') chart.note = tc(x.locale, 'prec.chartShort');
  return emptyAnswer({
    kind: 'data',
    text: sentence(x, ...notes, text, precisionNote(x, prec), sourceNote(x, report)),
    chart,
    links: [explorerLink(x, subj, stratum, available)],
    chips: followUps(x, subj, intent.mode, intent),
    facts,
    intent,
    context: {
      phenotype: subj.phenotype,
      pathogen: subj.pathogen,
      antibiotics: subj.antibiotic ? [subj.antibiotic] : undefined,
      level: stratum.level,
      setting: stratum.setting,
      specimen: stratum.specimen,
    },
  });
}

/** Pathogen without a drug → antibiogram profile for the latest table year. */
function execProfile(x: ExecCtx, intent: DataIntent, all: ResistanceRecord[]): EngineAnswer | null {
  const p = intent.pathogen!;
  const level = intent.level;
  const rows = all.filter((r) => !r.phenotype && r.pathogen === p && r.level === level && r.specimen === 'all' && (r.setting ?? 'all') === 'all' && r.precision === 'table');
  const kp = x.idx.keyPhenotype[p];
  if (!rows.length) {
    if (kp) return execResistance(x, { ...intent, kind: 'phenotype', mode: 'value', phenotype: kp });
    return null;
  }
  const year = intent.years.find((y) => rows.some((r) => r.year === y)) ?? Math.max(...rows.map((r) => r.year));
  const yr = rows.filter((r) => r.year === year).sort((a, b) => b.resistant_pct - a.resistant_pct);
  const top = yr.slice(0, 3);
  const low = yr.slice(-2).reverse().filter((r) => !top.includes(r));
  const item = (r: ResistanceRecord) => tc(x.locale, 'ans.item', { label: antibioticName(x, r.antibiotic), value: pct(x, r.resistant_pct) });
  let text = tc(x.locale, 'ans.profile', {
    year,
    where: where(x, level),
    pathogen: pathogenName(x, p),
    top: joinList(x, top.map(item)),
    low: joinList(x, low.map(item)),
  });
  const facts = [
    `${pathogenName(x, p, 'en')} antibiogram ${year}, ${whereEn(level)} (non-susceptible %, exact table values): ${yr.map((r) => `${antibioticName(x, r.antibiotic, 'en')} ${r.resistant_pct}%${r.isolates ? ` (n=${r.isolates})` : ''}`).join('; ')}`,
  ];
  const chips: string[] = [];
  if (kp) {
    const kr = all.filter((r) => r.phenotype === kp && r.level === 'all' && r.setting === 'all' && r.specimen === 'all').sort(byYear);
    const last = kr[kr.length - 1];
    if (last) {
      text = sentence(x, text, tc(x.locale, 'ans.keyPheno', { pheno: kp, year: last.year, value: pct(x, last.resistant_pct) }));
      facts.push(`Key phenotype ${kp} national ${last.year}: ${last.resistant_pct}% [${fmtPrecisionEn(last.precision)}]`);
    }
    chips.push(tc(x.locale, 'chip.trend', { name: kp }), tc(x.locale, 'chip.rankLevels', { name: kp }));
  }
  chips.push(tc(x.locale, 'chip.isolates', { name: pathogenName(x, p) }));
  const shown = yr.slice(0, 10);
  return emptyAnswer({
    kind: 'data',
    text: sentence(x, text, precisionNote(x, 'table'), sourceNote(x, Math.max(...yr.map((r) => r.reportYear ?? 0)) || undefined)),
    chart: {
      kind: 'hbar',
      title: tc(x.locale, 'ct.profile', { name: pathogenName(x, p), year }),
      categories: shown.map((r) => antibioticName(x, r.antibiotic).replace(/[（(].*?[）)]/g, '').trim()),
      series: [{ name: pathogenName(x, p), data: shown.map((r) => r.resistant_pct) }],
      unit: 'pct',
    },
    links: [link(x, 'link.explorer', '/resistance', { pathogen: p, level: level !== 'all' ? level : null })],
    chips,
    facts,
    intent,
    context: { pathogen: p, phenotype: kp, level },
  });
}
