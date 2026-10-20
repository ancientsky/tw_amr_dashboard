import { describe, expect, it } from 'vitest';
import type { KbRecord, Locale } from '../../../../data/types';
import { answerQuestion } from '../answer';
import { DATA } from './fixtures';

/**
 * Every deep link the chatbot or the KB emits must hit a real route with params that page
 * actually reads (and values it accepts) — otherwise the user lands on a default view.
 */
const PARAMS: Record<string, readonly string[]> = {
  '/': ['chart', 'overlay'],
  '/resistance': ['view', 'phenotype', 'pathogen', 'antibiotic', 'level', 'setting', 'specimen', 'years', 'year', 'items', 'organism', 'scope', 'chart', 'overlay'],
  '/international': ['indicator', 'countries', 'region', 'year', 'bars', 'chart'],
  '/antibiotic-use': ['level', 'metric', 'classes', 'years', 'chart'],
  '/hai': ['level', 'icu', 'metric', 'years', 'site', 'chart'],
  '/resources': ['q', 'cat', 'region', 'view'],
  '/data': ['chart'],
  '/about': [],
  '/chat': ['q'],
};
const VIEWS = ['trend', 'antibiogram', 'pathogen', 'compare', 'isolates'];
const MDROS = ['CRAB', 'CRE', 'CR-ECO', 'CRKP', 'CRPA', 'MRSA', 'VRE', 'VR-EFA', 'VR-EFM'];
const LEVELS = ['all', 'medical_center', 'regional', 'district'];

function check(href: string): string[] {
  const m = /^#(\/[^?]*)(?:\?(.*))?$/.exec(href);
  if (!m) return [`malformed ${href}`];
  const [, route, qs] = m;
  const allowed = PARAMS[route];
  if (!allowed) return [`unknown route ${route} in ${href}`];
  const q = new URLSearchParams(qs ?? '');
  const errs: string[] = [];
  for (const k of q.keys()) if (!allowed.includes(k)) errs.push(`${route} does not read "${k}" (${href})`);
  if (route === '/resistance') {
    const view = q.get('view') ?? 'trend';
    if (!VIEWS.includes(view)) errs.push(`bad view ${view}`);
    for (const p of (q.get('phenotype') ?? '').split(',').filter(Boolean)) if (!MDROS.includes(p)) errs.push(`explorer ignores phenotype ${p} (${href})`);
    const lv = q.get('level');
    if (lv && !LEVELS.includes(lv)) errs.push(`bad level ${lv}`);
    const pathogens = new Set((DATA.resistance?.dims?.pathogens ?? []).map((d) => d.code));
    const pg = q.get('pathogen');
    if (pg && !pathogens.has(pg)) errs.push(`unknown pathogen ${pg}`);
    const org = q.get('organism');
    const organisms = new Set((DATA.isolates?.dims?.organisms ?? []).map((d) => d.code));
    if (org && !organisms.has(org)) errs.push(`unknown organism ${org}`);
    if (q.has('organism') || q.has('scope')) if (view !== 'isolates') errs.push(`organism/scope only read by view=isolates (${href})`);
    if (q.has('items') && view !== 'compare') errs.push(`items only read by view=compare (${href})`);
  }
  return errs;
}

const QUESTIONS: [string, Locale][] = [
  ['2024 年 CRKP 在醫學中心多少？', 'zh-TW'],
  ['CRAB trend 2017-2024', 'en'],
  ['CRKP community- vs hospital-onset', 'en'],
  ['CRAB はどの病院種別で最も高い？', 'ja'],
  ['大腸桿菌對 ciprofloxacin 的抗藥性', 'zh-TW'],
  ['E. coli ceftriaxone resistance trend', 'en'],
  ['E. coli ciprofloxacin in urine', 'en'],
  ['金黃色葡萄球菌的抗藥性', 'zh-TW'],
  ['Klebsiella pneumoniae resistance profile', 'en'],
  ['台灣的 CRAB 跟日本比', 'zh-TW'],
  ['How many isolates were reported in 2024?', 'en'],
  ['How many Klebsiella pneumoniae isolates in blood?', 'en'],
  ['Top organisms by isolate count in 2023', 'en'],
  ['黃色ブドウ球菌の菌株数の推移', 'ja'],
  ['What is MRSA?', 'en'],
  ['VRE とは', 'ja'],
  ['ESBL 是什麼', 'zh-TW'],
  ['how do I download the data', 'en'],
  ['MRSA vs Japan', 'en'],
];

describe('chatbot deep links resolve to real routes/params', () => {
  it.each(QUESTIONS)('%s', (q, locale) => {
    const a = answerQuestion(q, { locale, data: DATA });
    for (const l of a.links) expect(check(l.href)).toEqual([]);
  });
  it('isolate answers open the explorer isolates view', () => {
    const a = answerQuestion('How many Klebsiella pneumoniae isolates were reported in 2024?', { locale: 'en', data: DATA });
    expect(a.links[0].href).toMatch(/^#\/resistance\?view=isolates&organism=KPN/);
  });
  it('drug-level answers do not send a non-MDRO phenotype to the trend view', () => {
    const a = answerQuestion('大腸桿菌對 ciprofloxacin 的抗藥性', { locale: 'zh-TW', data: DATA });
    expect(a.links[0].href).not.toMatch(/phenotype=/);
    expect(a.links[0].href).toMatch(/view=(compare|pathogen)/);
  });
  it('every KB chart link is valid', () => {
    const kb = (DATA.kb?.records ?? []) as KbRecord[];
    const bad = kb.flatMap((r) => {
      if (!r.chart?.route) return [];
      const qs = new URLSearchParams(Object.entries(r.chart.params ?? {}).map(([k, v]) => [k, String(v)])).toString();
      return check(`#${r.chart.route}${qs ? `?${qs}` : ''}`).map((e) => `${r.id}: ${e}`);
    });
    expect(bad).toEqual([]);
  });
});
