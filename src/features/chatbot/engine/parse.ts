/**
 * Utterance → ParsedQuery (entities, years, cue words) → DataIntent.
 * Pure functions; unit-tested in parse.test.ts across zh-TW / en / ja.
 */
import type { Level, Locale, OnsetSetting } from '../../../data/types';
import { CLASS_PREFERRED, extractEntities, type AliasIndex, type SpecimenLike } from './entities';
import { detectLang, normalize } from './text';
import type { ChatContext, DataIntent, Mode, ParsedQuery } from './types';

/** Sentinel for open-ended ranges ("since 2019") — clamped to the data's latest year later. */
export const OPEN_END = 9999;

const CUES = {
  trend: /趨勢|趋势|走勢|變化|变化|歷年|历年|逐年|多年來|trend|over time|over the years|history|historical|since|推移|経年|動向|変遷|年次/,
  compare: /比較|比较|相比|對比|对比|比起|\bvs\b|versus|compare|compared|comparison|比べ|対比|跟.{0,16}比|和.{0,16}比|與.{0,16}比|と比/,
  rank: /最高|最低|最多|最少|最嚴重|哪[個个一]|哪裡|哪里|highest|lowest|\bworst\b|\bmost\b|\bleast\b|\brank|一番|最も|いちばん|どこ|どの/,
  levelWord: /層級|层级|各級|各级|醫院等級|\blevels?\b|hospital type|\btiers?\b|病院種別|病院の種別|病院規模|レベル別|階層/,
  count: /菌株數|菌株数|株數|株数|幾株|几株|多少株|分離株|分離數|件數|件数|isolates?\b|isolate counts?|number of isolates|how many (?:isolates|strains)|\bcounts?\b|検出数|分離数|通報數|通報量/,
  international: /國際|国际|各國|各国|世界|全球|國外|international|countries|\bglobal\b|\bworld|国際|海外|他国|\bglass\b/,
  latest: /最新|最近|latest|most recent|\brecent|current|直近/,
  top: /前十|前 ?10|前五|top ?\d*|最常見|最常见|most common|上位|多い菌/,
  resistanceWord: /抗藥|抗药|耐藥|耐药|抗性|resist|non.?susceptib|耐性|感受性|%|百分比|比率|比例|percent|proportion|\brates?\b|割合|率/,
  numberQ: /多少|幾成|几成|how much|how high|what percent|何%|何パーセント|どのくらい|どれくらい|いくつ|\brates?\b|比率|百分比|percent/,
  definitional: /什麼是|什么是|是什麼|是什么|是甚麼|甚麼是|what is|what are|what does|what's|meaning|定義|定义|意思|とは|って何|何ですか|說明|解釋|explain/,
};

const RANGE_CONNECTOR = /^\s*(?:年|年度)?\s*(?:-|~|〜|～|–|—|to|through|until|至|到|から|－)\s*$/;

export function parseYears(text: string): { years: number[]; range?: [number, number] } {
  const t = text.normalize('NFKC');
  const found: { y: number; i: number; end: number }[] = [];
  for (const m of t.matchAll(/(?<!\d)(20[0-4]\d)(?!\d)/g)) found.push({ y: Number(m[1]), i: m.index!, end: m.index! + m[0].length });
  // ROC (民國) years: "113 年", "民國113年", "ROC 113"
  for (const m of t.matchAll(/(?:民國|民国|roc\s*)(1[01]\d)(?!\d)|(?<!\d)(1[01]\d)\s*(?:年|年度)/gi)) {
    const v = Number(m[1] ?? m[2]);
    if (v >= 100 && v <= 119) found.push({ y: v + 1911, i: m.index!, end: m.index! + m[0].length });
  }
  found.sort((a, b) => a.i - b.i);
  const years: number[] = [];
  for (const f of found) if (!years.includes(f.y)) years.push(f.y);
  let range: [number, number] | undefined;
  if (found.length >= 2) {
    const [a, b] = found;
    const between = t.slice(a.end, b.i);
    if (RANGE_CONNECTOR.test(between) || /^\s*(?:年)?\s*(?:到|至|から)\s*$/.test(between)) range = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  } else if (found.length === 1) {
    const f = found[0];
    const after = t.slice(f.end, f.end + 8);
    const before = t.slice(Math.max(0, f.i - 8), f.i);
    if (/^\s*(?:年)?\s*(?:以來|以来|至今|迄今|以降|から|起|以后|以後)/.test(after) || /(?:since|from)\s*$/i.test(before)) range = [f.y, OPEN_END];
  }
  return { years, range };
}

export function parseQuery(raw: string, uiLocale: Locale, idx: AliasIndex): ParsedQuery {
  const norm = normalize(raw);
  const { years, range } = parseYears(raw);
  const c = (re: RegExp) => re.test(norm);
  return {
    raw,
    lang: detectLang(raw, uiLocale),
    entities: extractEntities(raw, idx),
    years,
    yearRange: range,
    cues: {
      trend: c(CUES.trend),
      compare: c(CUES.compare),
      rank: c(CUES.rank),
      levelWord: c(CUES.levelWord),
      count: c(CUES.count),
      international: c(CUES.international),
      latest: c(CUES.latest),
      top: c(CUES.top),
      resistanceWord: c(CUES.resistanceWord),
      question: c(CUES.numberQ),
    },
  };
}

export function isDefinitional(raw: string): boolean {
  return CUES.definitional.test(normalize(raw));
}

/** pathogen + class/drug → phenotype (e.g. KPN + carbapenems → CRKP, SAU + methicillin → MRSA). */
export function phenotypeFor(idx: AliasIndex, pathogen: string, drugClass?: string, antibiotic?: string): string | undefined {
  for (const [code, m] of Object.entries(idx.phenotypeMeta)) {
    if (m.pathogen !== pathogen) continue;
    if (drugClass && m.drugClass === drugClass) return code;
    if (antibiotic && ((antibiotic === 'OXA' && pathogen === 'SAU') || (antibiotic === 'VAN' && m.antibiotic === 'VAN'))) return code;
  }
  return undefined;
}

/** GLASS indicator for a phenotype or pathogen(+class). */
export function glassIndicatorFor(idx: AliasIndex, phenotype?: string, pathogen?: string, drugClass?: string, antibiotics: string[] = []): string | undefined {
  if (phenotype) {
    const g = idx.phenotypeMeta[phenotype]?.glassIndicator;
    if (g) return g;
    if (phenotype === 'VRE') return 'VRE_EFM_BLOOD';
    if (phenotype === 'CRE') return 'CR_KPN_BLOOD';
  }
  const cls = drugClass ?? (antibiotics[0] ? idx.antibioticClass[antibiotics[0]] : undefined);
  switch (pathogen) {
    case 'SAU':
      return 'MRSA_BLOOD';
    case 'ABA':
      return 'CR_ABA_BLOOD';
    case 'PAE':
      return 'CR_PAE_BLOOD';
    case 'EFM':
    case 'ENC':
      return 'VRE_EFM_BLOOD';
    case 'SPN':
      return 'PNSP_BLOOD';
    case 'ECO':
      return cls === 'ceph3' ? '3GC_R_ECO_BLOOD' : cls === 'fluoroquinolones' ? 'FQ_R_ECO_BLOOD' : cls === 'carbapenems' ? 'CR_ECO_BLOOD' : undefined;
    case 'KPN':
      return cls === 'ceph3' ? '3GC_R_KPN_BLOOD' : cls === 'carbapenems' ? 'CR_KPN_BLOOD' : undefined;
    default:
      return undefined;
  }
}

/**
 * Decide whether (and which) data intent an utterance expresses. Returns null for
 * conceptual / navigation questions, which go to KB retrieval instead.
 */
export function resolveIntent(p: ParsedQuery, idx: AliasIndex, ctx?: ChatContext): DataIntent | null {
  const e = p.entities;
  const cues = p.cues;
  let phenotype: string | undefined = e.phenotypes[0];
  let pathogen: string | undefined = e.pathogens[0];
  let antibiotics = [...e.antibiotics];
  const drugClass: string | undefined = e.classes[0];
  if (!phenotype && pathogen) phenotype = phenotypeFor(idx, pathogen, drugClass, antibiotics.length === 1 ? antibiotics[0] : undefined);
  if (phenotype && !pathogen) pathogen = idx.phenotypeMeta[phenotype]?.pathogen;

  const otherCountries = e.countries.filter((c) => c !== 'TWN');
  const strongCue =
    p.years.length > 0 ||
    e.levels.length > 0 ||
    e.settings.length > 0 ||
    e.specimens.length > 0 ||
    otherCountries.length > 0 ||
    cues.trend ||
    cues.compare ||
    cues.rank ||
    cues.levelWord ||
    cues.count ||
    cues.latest ||
    cues.question ||
    (cues.international && !isDefinitional(p.raw));
  const anyCue = strongCue || cues.resistanceWord;

  let inherited = false;
  let level: Level = e.levels.length === 1 ? e.levels[0] : 'all';
  let setting: OnsetSetting = e.settings.length === 1 ? e.settings[0] : 'all';
  let specimen: 'all' | SpecimenLike = e.specimens[0] ?? 'all';
  let indicator: string | undefined;

  if (!phenotype && !pathogen && ctx && strongCue && (ctx.phenotype || ctx.pathogen || ctx.indicator)) {
    phenotype = ctx.phenotype;
    pathogen = ctx.pathogen;
    if (!antibiotics.length && ctx.antibiotics) antibiotics = [...ctx.antibiotics];
    if (!e.levels.length && ctx.level && !cues.levelWord && !cues.rank) level = ctx.level;
    if (!e.settings.length && ctx.setting) setting = ctx.setting;
    if (!e.specimens.length && ctx.specimen) specimen = ctx.specimen;
    indicator = ctx.indicator;
    inherited = true;
  }

  const base = { level, setting, specimen, years: p.yearRange ? [] : p.years, yearRange: p.yearRange, inherited };

  // ---- international comparison (GLASS) -----------------------------------------
  if (otherCountries.length > 0 || (cues.international && (phenotype || pathogen || indicator) && !isDefinitional(p.raw))) {
    indicator = glassIndicatorFor(idx, phenotype, pathogen, drugClass, antibiotics) ?? (phenotype || pathogen ? undefined : indicator);
    return {
      kind: 'glass',
      mode: otherCountries.length ? 'compare' : 'rank',
      phenotype,
      pathogen,
      indicator,
      countries: ['TWN', ...otherCountries],
      ...base,
    };
  }

  // ---- isolate counts ---------------------------------------------------------------
  if (cues.count && !isDefinitional(p.raw)) {
    const mode: Mode = !pathogen && (cues.top || cues.rank) ? 'top' : cues.trend || p.yearRange ? 'trend' : 'value';
    return { kind: 'isolates', mode, pathogen, phenotype, ...base };
  }

  if (!phenotype && !pathogen) return null;
  // conceptual question about an organism ("What is CRAB?") → KB
  if (!strongCue && (isDefinitional(p.raw) || !anyCue)) return null;

  // ---- mode ---------------------------------------------------------------------
  let mode: Mode = 'value';
  if (p.years.length >= 2 && !p.yearRange) mode = 'compareYears';
  else if (e.settings.length >= 2) mode = 'bySetting';
  else if (e.levels.length >= 2) mode = 'byLevel';
  else if (cues.levelWord || (cues.rank && !e.levels.length)) mode = cues.trend ? 'byLevel' : 'rankLevels';
  else if (cues.trend || p.yearRange) mode = 'trend';

  // Phenotype indicators only exist for all specimens → specimen-specific questions use drug-level rows.
  if (phenotype && specimen !== 'all') {
    const m = idx.phenotypeMeta[phenotype];
    if (m?.pathogen && m.antibiotic) {
      return { kind: 'drug', mode, pathogen: m.pathogen, antibiotics: [m.antibiotic], drugClass: m.drugClass, phenotype, ...base };
    }
  }
  if (phenotype) return { kind: 'phenotype', mode, phenotype, pathogen, ...base };

  if (!antibiotics.length && drugClass) antibiotics = CLASS_PREFERRED[drugClass] ?? [];
  if (!antibiotics.length) {
    return { kind: 'drug', mode: 'profile', pathogen, antibiotics: [], ...base };
  }
  return { kind: 'drug', mode, pathogen, antibiotics, drugClass, ...base };
}
