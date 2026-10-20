import { describe, expect, it } from 'vitest';
import type { Locale } from '../../../../data/types';
import { answerQuestion } from '../answer';
import { buildKbIndex, decideKb, searchKb } from '../kb';
import { stem, tokenize } from '../text';
import { DATA } from './fixtures';
import type { KbRecord } from '../../../../data/types';
import { translate } from '../../../../i18n';
import { SUGGESTION_GROUPS, WELCOME_KEYS } from '../../suggestions';

const ask = (q: string, locale: Locale = 'zh-TW') => answerQuestion(q, { locale, data: DATA });

describe('data answers carry real numbers, a chart and a deep link', () => {
  it('CRKP medical centres 2024 (zh)', () => {
    const a = ask('2024 年 CRKP 在醫學中心多少？');
    expect(a.kind).toBe('data');
    expect(a.text).toContain('11.5%');
    expect(a.text).toContain('醫學中心');
    expect(a.text).toMatch(/±1–2/); // chart-estimate caveat
    expect(a.chart?.kind).toBe('line');
    expect(a.links[0].href).toMatch(/^#\/resistance\?.*phenotype=CRKP.*level=medical_center/);
  });
  it('national 2024 MDRO headline values match the annual report', () => {
    const v = (q: string) => ask(q, 'en').text;
    expect(v('CRAB 2024')).toContain('58.4%');
    expect(v('MRSA 2024')).toContain('48.0%');
    expect(v('CRKP 2024')).toContain('15.6%');
    expect(v('VRE 2024')).toContain('18.0%');
  });
  it('HO vs CO for CRKP (en)', () => {
    const a = ask('CRKP community- vs hospital-onset', 'en');
    expect(a.text).toContain('29.5%');
    expect(a.text).toContain('11.5%');
    expect(a.chart?.series).toHaveLength(2);
  });
  it('level ranking for CRAB (ja) names district hospitals highest', () => {
    const a = ask('CRAB はどの病院種別で最も高い？', 'ja');
    expect(a.text).toContain('地区病院');
    expect(a.chart?.kind).toBe('bar');
  });
  it('antibiogram value for E. coli × ciprofloxacin uses exact table values', () => {
    const a = ask('大腸桿菌對 ciprofloxacin 的抗藥性');
    expect(a.text).toContain('46.0%');
    expect(a.text).toContain('敏感性圖譜');
  });
  it('GLASS comparison flags provisional international data', () => {
    const a = ask('台灣的 CRAB 跟日本比');
    expect(a.text).toMatch(/\d+\.\d%/);
    expect(a.text).toContain('暫定');
    expect(a.links[0].href).toContain('#/international');
  });
  it('isolate counts', () => {
    const a = ask('How many isolates were reported in 2024?', 'en');
    expect(a.text).toContain('755,833');
  });
  it('profile for a pathogen without a drug', () => {
    const a = ask('金黃色葡萄球菌的抗藥性');
    expect(a.chart?.kind).toBe('hbar');
    expect(a.text).toContain('MRSA');
  });
  it('missing year falls back to latest with a note', () => {
    const a = ask('CRKP 2030', 'en');
    expect(a.text).toMatch(/no 2030 value/);
  });
  it('emits model-facing facts with provenance', () => {
    const a = ask('2024 年 CRKP 在醫學中心多少？');
    expect(a.facts.join(' ')).toMatch(/2024 11\.5%/);
    expect(a.facts.join(' ')).toMatch(/report 2024/);
  });
});

describe('KB retrieval', () => {
  it('answers concept questions in the UI language', () => {
    const zh = ask('CRAB 是什麼？');
    expect(zh.kind).toBe('kb');
    expect(zh.text).toContain('碳青黴烯');
    const en = ask('How do I download the data?', 'en');
    expect(en.kind).toBe('kb');
    expect(en.links[0].href).toBe('#/data');
    // English question, Japanese UI → Japanese answer
    const ja = ask('What is AWaRe?', 'ja');
    expect(ja.kind).toBe('kb');
    expect(ja.text).toMatch(/AWaRe/);
    expect(ja.text).toMatch(/[ぁ-ん]/);
  });
  it('is graceful when unsure', () => {
    const a = ask('qwerty zxcvb', 'en');
    expect(['unsure', 'fallback']).toContain(a.kind);
    expect(a.chips.length).toBeGreaterThan(0);
  });
  it('confidence threshold separates strong and weak matches', () => {
    const idx = buildKbIndex((DATA.kb!.records ?? []) as KbRecord[]);
    expect(decideKb(searchKb(idx, 'what is VRE', 'en')).confident).toBe(true);
    expect(decideKb(searchKb(idx, 'banana', 'en')).confident).toBe(false);
  });
});

describe('suggested questions', () => {
  const keys = [...new Set([...WELCOME_KEYS, ...SUGGESTION_GROUPS.flatMap((g) => g.keys)])];
  for (const locale of ['zh-TW', 'en', 'ja'] as const) {
    it(`every suggestion gets a confident answer (${locale})`, () => {
      for (const k of keys) {
        const q = translate(locale, `chat.q.${k}`);
        const a = ask(q, locale);
        expect([k, a.kind]).toEqual([k, SUGGESTION_GROUPS.find((g) => g.keys.includes(k))!.topic === 'concepts' || SUGGESTION_GROUPS.find((g) => g.keys.includes(k))!.topic === 'site' ? 'kb' : 'data']);
      }
    });
  }
});

describe('text', () => {
  it('stems and bigrams', () => {
    expect(stem('resistance')).toBe(stem('resistant'));
    expect(stem('infections')).toBe(stem('infection'));
    expect(tokenize('CRAB 是什麼')).toEqual(['crab', '是什', '什麼']);
  });
});
