import { describe, expect, it } from 'vitest';
import type { Locale } from '../../../../data/types';
import { aliasIndexFor } from '../answer';
import { extractEntities } from '../entities';
import { OPEN_END, parseQuery, parseYears, resolveIntent } from '../parse';
import type { ChatContext, DataIntent } from '../types';
import { DATA } from './fixtures';

const idx = aliasIndexFor(DATA);
const intentOf = (q: string, locale: Locale = 'zh-TW', ctx?: ChatContext) => resolveIntent(parseQuery(q, locale, idx), idx, ctx);

type Expect = Partial<Omit<DataIntent, 'years'>> & { years?: number[] };
/** [locale, utterance, expected subset | null (= no data intent → KB)] */
const CASES: [Locale, string, Expect | null][] = [
  // ---- zh-TW
  ['zh-TW', '2024 年 CRKP 在醫學中心多少？', { kind: 'phenotype', phenotype: 'CRKP', level: 'medical_center', mode: 'value', years: [2024] }],
  ['zh-TW', '大腸桿菌對 ciprofloxacin 的抗藥性', { kind: 'drug', pathogen: 'ECO', antibiotics: ['CIP'], mode: 'value' }],
  ['zh-TW', 'CRAB 哪個層級最高', { kind: 'phenotype', phenotype: 'CRAB', mode: 'rankLevels' }],
  ['zh-TW', '台灣的 CRAB 跟日本比', { kind: 'glass', indicator: 'CR_ABA_BLOOD', countries: ['TWN', 'JPN'], mode: 'compare' }],
  ['zh-TW', '113 年鮑氏不動桿菌對碳青黴烯類的抗藥性', { kind: 'phenotype', phenotype: 'CRAB', years: [2024] }],
  ['zh-TW', '金黃色葡萄球菌的抗藥性', { kind: 'drug', pathogen: 'SAU', mode: 'profile' }],
  ['zh-TW', 'MRSA 社區與醫療相關感染比較', { kind: 'phenotype', phenotype: 'MRSA', mode: 'bySetting' }],
  ['zh-TW', '克雷伯氏肺炎桿菌血液檢體對碳青黴烯的抗藥性', { kind: 'drug', pathogen: 'KPN', specimen: 'blood', phenotype: 'CRKP' }],
  ['zh-TW', '2019 到 2024 年 VRE 趨勢', { kind: 'phenotype', phenotype: 'VRE', mode: 'trend', yearRange: [2019, 2024] }],
  ['zh-TW', 'CRAB 在地區醫院的醫療相關感染', { kind: 'phenotype', phenotype: 'CRAB', level: 'district', setting: 'ho' }],
  ['zh-TW', '2024 年總菌株數是多少？', { kind: 'isolates', mode: 'value', years: [2024] }],
  ['zh-TW', '綠膿桿菌對 imipenem 在區域醫院', { kind: 'drug', pathogen: 'PAE', antibiotics: ['IPM'], level: 'regional' }],
  ['zh-TW', '民國112年醫學中心 MRSA', { kind: 'phenotype', phenotype: 'MRSA', level: 'medical_center', years: [2023] }],
  ['zh-TW', 'CRAB 是什麼？', null],
  ['zh-TW', '如何下載資料？', null],
  // ---- en
  ['en', 'MRSA trend hospital-onset', { kind: 'phenotype', phenotype: 'MRSA', setting: 'ho', mode: 'trend' }],
  ['en', 'compare VRE 2017 vs 2024', { kind: 'phenotype', phenotype: 'VRE', mode: 'compareYears', years: [2017, 2024] }],
  ['en', 'E. coli 3GC resistance in blood 2023', { kind: 'drug', pathogen: 'ECO', drugClass: 'ceph3', specimen: 'blood', years: [2023] }],
  ['en', 'Which hospital level has the highest CRAB?', { kind: 'phenotype', phenotype: 'CRAB', mode: 'rankLevels' }],
  ['en', 'carbapenem-resistant Klebsiella in medical centres', { kind: 'phenotype', phenotype: 'CRKP', level: 'medical_center' }],
  ['en', "How does Taiwan's MRSA rank internationally?", { kind: 'glass', indicator: 'MRSA_BLOOD', mode: 'rank' }],
  ['en', 'Taiwan vs Korea', { kind: 'glass', countries: ['TWN', 'KOR'], mode: 'compare' }],
  ['en', 'Top 10 organisms by isolates in 2024', { kind: 'isolates', mode: 'top', years: [2024] }],
  ['en', 'Acinetobacter fluoroquinolone resistance in district hospitals', { kind: 'drug', pathogen: 'ABA', drugClass: 'fluoroquinolones', level: 'district' }],
  ['en', 'CRKP community- vs hospital-onset', { kind: 'phenotype', phenotype: 'CRKP', mode: 'bySetting' }],
  ['en', 'MRSA since 2020', { kind: 'phenotype', phenotype: 'MRSA', mode: 'trend', yearRange: [2020, OPEN_END] }],
  ['en', 'What is CRKP?', null],
  ['en', 'How do I embed a chart?', null],
  // ---- ja
  ['ja', '2024年の医学センターの CRKP は？', { kind: 'phenotype', phenotype: 'CRKP', level: 'medical_center', years: [2024] }],
  ['ja', 'CRAB はどの病院種別で最も高い？', { kind: 'phenotype', phenotype: 'CRAB', mode: 'rankLevels' }],
  ['ja', '緑膿菌のカルバペネム耐性の推移', { kind: 'phenotype', phenotype: 'CRPA', mode: 'trend' }],
  ['ja', '大腸菌のシプロフロキサシン耐性率', { kind: 'drug', pathogen: 'ECO', antibiotics: ['CIP'] }],
  ['ja', '台湾の CRAB を日本と比較', { kind: 'glass', indicator: 'CR_ABA_BLOOD', countries: ['TWN', 'JPN'] }],
  ['ja', '大腸菌の血液検体の分離株数の推移', { kind: 'isolates', pathogen: 'ECO', specimen: 'blood', mode: 'trend' }],
  ['ja', 'MRSA の市中関連と医療関連の比較', { kind: 'phenotype', phenotype: 'MRSA', mode: 'bySetting' }],
  ['ja', '地区病院の VRE（2022年）', { kind: 'phenotype', phenotype: 'VRE', level: 'district', years: [2022] }],
  ['ja', '黄色ブドウ球菌のメチシリン耐性', { kind: 'phenotype', phenotype: 'MRSA' }],
  ['ja', 'CRAB とは？', null],
];

describe('intent parsing (≥25 utterances × 3 languages)', () => {
  it('has enough cases per language', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(25);
    for (const l of ['zh-TW', 'en', 'ja'] as const) expect(CASES.filter((c) => c[0] === l).length).toBeGreaterThanOrEqual(8);
  });
  for (const [locale, q, want] of CASES) {
    it(`[${locale}] ${q}`, () => {
      const got = intentOf(q, locale);
      if (want === null) {
        expect(got).toBeNull();
        return;
      }
      expect(got).not.toBeNull();
      expect(got).toMatchObject(want);
    });
  }
});

describe('years', () => {
  it('parses Gregorian, ROC and ranges', () => {
    expect(parseYears('2024 年').years).toEqual([2024]);
    expect(parseYears('113年').years).toEqual([2024]);
    expect(parseYears('民國 110 年至 113 年').range).toEqual([2021, 2024]);
    expect(parseYears('2017-2024').range).toEqual([2017, 2024]);
    expect(parseYears('2017〜2024年').range).toEqual([2017, 2024]);
    expect(parseYears('2017 vs 2024')).toEqual({ years: [2017, 2024], range: undefined });
    expect(parseYears('2019年以降').range).toEqual([2019, OPEN_END]);
    expect(parseYears('ATCC 25922').years).toEqual([]);
  });
});

describe('entities', () => {
  it('resolves trilingual names and synonyms', () => {
    const e = (s: string) => extractEntities(s, idx);
    expect(e('鮑氏不動桿菌').pathogens).toEqual(['ABA']);
    expect(e('克雷伯氏肺炎桿菌').pathogens).toEqual(['KPN']);
    expect(e('肺炎鏈球菌').pathogens).toEqual(['SPN']);
    expect(e('大腸桿菌').pathogens).toEqual(['ECO']);
    expect(e('K. pneumoniae').pathogens).toEqual(['KPN']);
    expect(e('アシネトバクター').pathogens).toEqual(['ABA']);
    expect(e('carbapenems').classes).toEqual(['carbapenems']);
    expect(e('3GC').classes).toEqual(['ceph3']);
    expect(e('FQ').classes).toEqual(['fluoroquinolones']);
    expect(e('levofloxacin').antibiotics).toEqual(['LVX']);
    expect(e('co-trimoxazole').antibiotics).toEqual(['SXT']);
    expect(e('co-trimoxazole').settings).toEqual([]);
    expect(e('醫學中心、區域醫院、地區醫院').levels).toEqual(['medical_center', 'regional', 'district']);
    expect(e('社區相關感染 vs 醫療相關感染').settings).toEqual(['co', 'ho']);
    expect(e('血液').specimens).toEqual(['blood']);
    expect(e('Who is the CDC director').settings).toEqual([]);
    expect(e('臺灣 日本 韓國').countries).toEqual(['TWN', 'JPN', 'KOR']);
  });
});

describe('conversation context', () => {
  it('inherits the subject for follow-ups that carry a data cue', () => {
    const ctx: ChatContext = { phenotype: 'CRAB', pathogen: 'ABA' };
    expect(intentOf('哪個層級最高？', 'zh-TW', ctx)).toMatchObject({ kind: 'phenotype', phenotype: 'CRAB', mode: 'rankLevels', inherited: true });
    expect(intentOf('and in 2022?', 'en', ctx)).toMatchObject({ phenotype: 'CRAB', years: [2022] });
    expect(intentOf('日本と比べると？', 'ja', ctx)).toMatchObject({ kind: 'glass', indicator: 'CR_ABA_BLOOD' });
    expect(intentOf('What is AMR?', 'en', ctx)).toBeNull();
  });
});
