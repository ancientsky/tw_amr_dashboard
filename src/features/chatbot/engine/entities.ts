/**
 * Entity resolution: alias tables built from `resistance.dims` (+ `glass.dims` countries)
 * in all three languages, plus hand-curated clinical synonyms. One longest-match-first
 * pass over the normalised utterance resolves pathogens, antibiotics, antibiotic classes,
 * MDRO phenotypes, hospital levels, onset settings, specimens and countries.
 */
import type { Dim, Level, OnsetSetting } from '../../../data/types';
import { normalizeForMatch } from './text';

export type EntityKind = 'pathogen' | 'antibiotic' | 'class' | 'phenotype' | 'level' | 'setting' | 'specimen' | 'country';
export type SpecimenLike = 'blood' | 'urine' | 'sputum' | 'pus' | 'stool';

export interface Alias {
  /** normalised term (normalizeForMatch without the padding spaces) */
  term: string;
  code: string;
  kind: EntityKind;
  /** Latin term → must match on word boundaries */
  latin: boolean;
}

export interface EntityHit {
  kind: EntityKind;
  code: string;
  start: number;
  end: number;
  term: string;
}

export interface Entities {
  pathogens: string[];
  antibiotics: string[];
  classes: string[];
  phenotypes: string[];
  levels: Exclude<Level, 'all'>[];
  settings: Exclude<OnsetSetting, 'all'>[];
  specimens: SpecimenLike[];
  countries: string[];
  hits: EntityHit[];
}

export interface EntityDims {
  pathogens?: Dim[];
  antibiotics?: Dim[];
  antibioticClasses?: Dim[];
  phenotypes?: Dim[];
  countries?: Dim[];
}

/* ------------------------------------------------------------------ synonyms */

const PATHOGEN_SYN: Record<string, string[]> = {
  SAU: ['金黃色葡萄球菌', '金黄色葡萄球菌', '金葡菌', '金黃葡萄球菌', 'staph aureus', 's aureus', 'staphylococcus aureus', 'staph', '黄色ブドウ球菌', '黄色ぶどう球菌', 'sau'],
  ABA: ['鮑氏不動桿菌', '鮑曼不動桿菌', '鮑式不動桿菌', '不動桿菌', 'acinetobacter', 'a baumannii', 'baumannii', 'アシネトバクター', 'aba'],
  KPN: [
    '克雷伯氏肺炎桿菌',
    '克雷伯肺炎桿菌',
    '克雷白氏肺炎桿菌',
    '肺炎克雷伯氏菌',
    '肺炎克雷伯菌',
    '克雷伯氏菌',
    '克雷伯菌',
    'klebsiella',
    'k pneumoniae',
    'klebsiella pneumoniae',
    'クレブシエラ',
    '肺炎桿菌',
    'kpn',
  ],
  ECO: ['大腸桿菌', 'e coli', 'ecoli', 'escherichia coli', 'escherichia', '大腸菌', 'eco'],
  PAE: ['綠膿桿菌', '绿脓杆菌', '銅綠假單胞菌', 'pseudomonas', 'p aeruginosa', 'pseudomonas aeruginosa', '緑膿菌', 'pae'],
  EFM: ['屎腸球菌', 'faecium', 'e faecium', 'フェシウム', 'efm'],
  EFA: ['糞腸球菌', 'faecalis', 'e faecalis', 'フェカーリス', 'efa'],
  ENC: ['腸球菌', 'enterococcus', 'enterococci', '腸球菌属'],
  SPN: ['肺炎鏈球菌', '肺炎链球菌', '肺炎雙球菌', 'pneumococcus', 'pneumococci', 'pneumococcal', 's pneumoniae', '肺炎球菌', 'spn'],
  ENB: ['腸道菌', '腸道菌目', '腸桿菌科', 'enterobacterales', 'enterobacteriaceae', '腸内細菌', '腸内細菌目', '腸内細菌科'],
  ECL: ['陰溝腸桿菌', 'enterobacter', 'e cloacae', 'エンテロバクター'],
  CDI: ['困難梭狀桿菌', '困難梭菌', 'c difficile', 'c diff', 'clostridioides difficile', 'clostridium difficile', 'ディフィシル'],
  NGO: ['淋病雙球菌', '淋球菌', 'gonorrhoeae', 'gonococcus', '淋菌'],
  HPY: ['幽門螺旋桿菌', '幽門桿菌', 'h pylori', 'helicobacter', 'ピロリ菌', 'ピロリ'],
  SAL: ['沙門氏菌', 'salmonella', 'サルモネラ'],
  SHI: ['志賀氏桿菌', 'shigella', '赤痢菌'],
  SMA: ['嗜麥芽窄食單胞菌', 'stenotrophomonas', 'ステノトロホモナス'],
  HIN: ['流感嗜血桿菌', 'h influenzae', 'haemophilus', 'インフルエンザ菌'],
  GAS: ['a群鏈球菌', 'a 群鏈球菌', 'group a strep', 'strep pyogenes', 's pyogenes', 'a群溶連菌', '化膿性鏈球菌'],
  GBS: ['b群鏈球菌', 'b 群鏈球菌', 'group b strep', 's agalactiae', 'b群溶連菌'],
  PMI: ['奇異變形桿菌', '變形桿菌', 'proteus', 'プロテウス'],
  SMR: ['黏質沙雷氏菌', '沙雷氏菌', 'serratia', 'セラチア'],
  BFR: ['脆弱擬桿菌', 'bacteroides', 'バクテロイデス'],
};

const ANTIBIOTIC_SYN: Record<string, string[]> = {
  OXA: ['methicillin', 'meticillin', 'oxacillin', '甲氧西林', '苯唑西林', 'メチシリン', 'オキサシリン', 'oxa'],
  VAN: ['vancomycin', 'vanco', '萬古黴素', '万古霉素', '萬古霉素', 'バンコマイシン'],
  MEM: ['meropenem', 'mero', '美羅培南', '美洛培南', '美平', 'メロペネム', 'mem'],
  IPM: ['imipenem', '亞胺培南', '伊米配能', '泰能', 'イミペネム', 'ipm'],
  ETP: ['ertapenem', '厄他培南', 'エルタペネム', 'etp'],
  CIP: ['ciprofloxacin', 'cipro', '環丙沙星', '环丙沙星', 'シプロフロキサシン', 'シプロ', 'cip'],
  LVX: ['levofloxacin', 'levo', '左氧氟沙星', '可樂必妥', 'レボフロキサシン', 'lvx'],
  CRO: ['ceftriaxone', '頭孢曲松', '頭孢三嗪', 'セフトリアキソン', 'cro'],
  CTX: ['cefotaxime', '頭孢噻肟', 'セフォタキシム', 'ctx'],
  CAZ: ['ceftazidime', '頭孢他啶', 'セフタジジム', 'caz'],
  FEP: ['cefepime', '頭孢吡肟', 'セフェピム', 'fep'],
  TZP: ['piperacillin tazobactam', 'pip tazo', 'piptazo', 'tazocin', '哌拉西林 他唑巴坦', '泰位精', 'ピペラシリン タゾバクタム', 'tzp'],
  AMK: ['amikacin', '阿米卡星', 'アミカシン', 'amk'],
  COL: ['colistin', 'polymyxin e', '可利斯汀', '黏菌素', 'コリスチン'],
  TGC: ['tigecycline', '老虎黴素', '替加環素', 'チゲサイクリン', 'tgc'],
  SXT: ['trimethoprim sulfamethoxazole', 'tmp smx', 'co trimoxazole', 'cotrimoxazole', 'bactrim', '撲菌特', 'スルファメトキサゾール トリメトプリム', 'st合剤', 'sxt'],
  AMP: ['ampicillin', '安比西林', 'アンピシリン'],
  SAM: ['ampicillin sulbactam', 'unasyn', '安比西林 舒巴坦', 'アンピシリン スルバクタム', 'sam'],
  CZO: ['cefazolin', '頭孢唑林', 'セファゾリン', 'czo'],
  FOX: ['cefoxitin', '頭孢西丁', 'セフォキシチン', 'fox'],
  GEN: ['gentamicin', '健他黴素', 'ゲンタマイシン'],
  PEN: ['penicillin', '青黴素', '盤尼西林', 'ペニシリン'],
  ERY: ['erythromycin', '紅黴素', 'エリスロマイシン', 'ery'],
  CLI: ['clindamycin', '克林黴素', 'クリンダマイシン'],
  LNZ: ['linezolid', '利奈唑胺', 'リネゾリド', 'lnz'],
  DAP: ['daptomycin', '達托黴素', 'ダプトマイシン', 'dap'],
  MNO: ['minocycline', '美諾四環黴素', 'ミノサイクリン', 'mno'],
  MFX: ['moxifloxacin', '莫西沙星', 'モキシフロキサシン', 'mfx'],
  ATM: ['aztreonam', '胺曲南', 'アズトレオナム', 'atm'],
};

const CLASS_SYN: Record<string, string[]> = {
  carbapenems: ['carbapenem', 'carbapenems', '碳青黴烯', '碳青黴烯類', '碳青霉烯', 'カルバペネム', 'カルバペネム系'],
  ceph3: [
    '3gc',
    'third generation cephalosporin',
    'third generation cephalosporins',
    '3rd generation cephalosporin',
    '3rd generation cephalosporins',
    '3rd gen cephalosporin',
    '3rd gen cephalosporins',
    '第三代頭孢菌素',
    '第三代頭孢',
    '三代頭孢',
    '第3世代セファロスポリン',
    '第三世代セファロスポリン',
    '第3世代セフェム',
    '第三世代セフェム',
  ],
  fluoroquinolones: ['fq', 'fluoroquinolone', 'fluoroquinolones', 'quinolone', 'quinolones', '氟喹諾酮', '氟喹諾酮類', '喹諾酮', 'フルオロキノロン', 'キノロン', 'ニューキノロン'],
  aminoglycosides: ['aminoglycoside', 'aminoglycosides', '胺基醣苷', '胺基糖苷', 'アミノグリコシド'],
  glycopeptides: ['glycopeptide', 'glycopeptides', '醣肽類', 'グリコペプチド'],
};

/** Preferred antibiotic codes when a class is named (first available wins). */
export const CLASS_PREFERRED: Record<string, string[]> = {
  carbapenems: ['MEM', 'IPM', 'ETP', 'DOR'],
  ceph3: ['CRO', 'CTX', 'CAZ', 'CFP', 'CFM'],
  fluoroquinolones: ['CIP', 'LVX', 'MFX'],
  aminoglycosides: ['AMK', 'GEN'],
  glycopeptides: ['VAN'],
};

const PHENOTYPE_SYN: Record<string, string[]> = {
  MRSA: ['mrsa', 'methicillin resistant staphylococcus aureus', 'methicillin resistant s aureus', 'methicillin resistant staph', '抗藥性金黃色葡萄球菌', 'メチシリン耐性黄色ブドウ球菌'],
  VRE: ['vre', 'vancomycin resistant enterococci', 'vancomycin resistant enterococcus', '抗萬古黴素腸球菌', 'バンコマイシン耐性腸球菌'],
  'VR-EFM': ['vrefm', 'vr efm', 'vre faecium', 'vancomycin resistant e faecium', 'vancomycin resistant faecium'],
  'VR-EFA': ['vrefa', 'vr efa', 'vre faecalis', 'vancomycin resistant e faecalis', 'vancomycin resistant faecalis'],
  CRAB: ['crab', 'carbapenem resistant acinetobacter', 'carbapenem resistant a baumannii', 'carbapenem resistant acinetobacter baumannii', '抗碳青黴烯鮑氏不動桿菌', 'カルバペネム耐性アシネトバクター'],
  CRKP: ['crkp', 'carbapenem resistant klebsiella', 'carbapenem resistant k pneumoniae', 'carbapenem resistant klebsiella pneumoniae', '抗碳青黴烯克雷伯氏肺炎桿菌', 'カルバペネム耐性肺炎桿菌'],
  CRPA: ['crpa', 'carbapenem resistant pseudomonas', 'carbapenem resistant p aeruginosa', '抗碳青黴烯綠膿桿菌', 'カルバペネム耐性緑膿菌'],
  CRE: ['cre', 'carbapenem resistant enterobacterales', 'carbapenem resistant enterobacteriaceae', '抗碳青黴烯腸道菌', 'カルバペネム耐性腸内細菌'],
  'CR-ECO': ['cr eco', 'creco', 'cr e coli', 'carbapenem resistant e coli', 'carbapenem resistant escherichia coli', '抗碳青黴烯大腸桿菌', 'カルバペネム耐性大腸菌'],
};

const LEVEL_SYN: Record<Exclude<Level, 'all'>, string[]> = {
  medical_center: ['醫學中心', '医学中心', '醫中', 'medical center', 'medical centers', 'medical centre', 'medical centres', '医学センター', '医学中心病院'],
  regional: ['區域醫院', '区域医院', '區域級', '區域級醫院', 'regional hospital', 'regional hospitals', 'regional', '地域病院'],
  district: ['地區醫院', '地区医院', '地區級', '地區級醫院', 'district hospital', 'district hospitals', 'district', '地区病院'],
};

const SETTING_SYN: Record<Exclude<OnsetSetting, 'all'>, string[]> = {
  co: ['社區相關感染', '社區相關', '社區感染', '社區型', '社區', 'community onset', 'community acquired', 'community', 'co', '市中感染', '市中関連', '市中'],
  ho: ['醫療相關感染', '醫療相關', '院內感染', '院內', 'hospital onset', 'hospital acquired', 'nosocomial', 'ho', '医療関連感染', '医療関連', '院内感染', '院内'],
};

const SPECIMEN_SYN: Record<SpecimenLike, string[]> = {
  blood: ['血液', '血流', '菌血症', '血液培養', 'blood', 'bloodstream', 'bacteremia', 'bacteraemia', 'bsi', '血液検体'],
  urine: ['尿液', '尿路', 'urine', 'urinary', 'uti', '尿'],
  sputum: ['痰', '喀痰', '呼吸道', 'sputum', 'respiratory'],
  pus: ['膿', '傷口', 'pus', 'wound', '創部'],
  stool: ['糞便', 'stool', 'feces', 'faeces', '便'],
};

const COUNTRY_SYN: Record<string, string[]> = {
  TWN: ['taiwan', '台灣', '台湾', 'twn', '我國', '我国', '國內', '国内'],
  USA: ['usa', 'united states', 'america', '美國', '米国', 'アメリカ'],
  GBR: ['uk', 'united kingdom', 'britain', 'england', '英國', '英国', 'イギリス'],
  KOR: ['korea', 'south korea', '韓國', '南韓', '韓国'],
  JPN: ['japan', '日本', 'jpn'],
  CHN: ['china', '中國', '中国', '大陸'],
  DEU: ['germany', '德國', 'ドイツ'],
  AUS: ['australia', '澳洲', '澳大利亞', 'オーストラリア'],
};

/** Latin aliases that are also common English words — never auto-derived. */
const LATIN_BLOCK = new Set(['sodium', 'complex', 'high level', 'spp', 'all', 'can', 'nor', 'ita', 'ind', 'sau', 'esp']);

/* ------------------------------------------------------------------ index */

export interface AliasIndex {
  aliases: Alias[];
  /** phenotype code → { pathogen, antibiotic, drugClass, glassIndicator } */
  phenotypeMeta: Record<string, { pathogen?: string; antibiotic?: string; drugClass?: string; glassIndicator?: string }>;
  /** antibiotic code → class code */
  antibioticClass: Record<string, string>;
  /** pathogen code → key phenotype */
  keyPhenotype: Record<string, string>;
}

const isLatin = (s: string) => /^[a-z0-9 ]+$/.test(s);

function pieces(name: string): string[] {
  // "Oxacillin (methicillin)" → ['Oxacillin (methicillin)', 'Oxacillin', 'methicillin']
  const out = [name];
  const m = /^(.*?)[(（](.+?)[)）]\s*$/.exec(name);
  if (m) {
    out.push(m[1]);
    out.push(m[2]);
  }
  return out;
}

function push(list: Alias[], seen: Set<string>, raw: string, code: string, kind: EntityKind) {
  const term = normalizeForMatch(raw).trim();
  if (!term || term.length < 2) {
    // single CJK characters are allowed only from curated synonym lists (passed through pushExact)
    return;
  }
  if (isLatin(term) && LATIN_BLOCK.has(term)) return;
  const key = `${kind}|${term}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ term, code, kind, latin: isLatin(term) });
}

function pushExact(list: Alias[], seen: Set<string>, raw: string, code: string, kind: EntityKind) {
  const term = normalizeForMatch(raw).trim();
  if (!term) return;
  const key = `${kind}|${term}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ term, code, kind, latin: isLatin(term) });
}

const cache = new WeakMap<object, AliasIndex>();

/** Build (and memoise per dims object) the alias index. */
export function buildAliasIndex(dims: EntityDims): AliasIndex {
  const hit = cache.get(dims);
  if (hit) return hit;
  const aliases: Alias[] = [];
  const seen = new Set<string>();
  const phenotypeMeta: AliasIndex['phenotypeMeta'] = {};
  const antibioticClass: Record<string, string> = {};
  const keyPhenotype: Record<string, string> = {};

  for (const d of dims.pathogens ?? []) {
    for (const loc of ['zh-TW', 'en', 'ja'] as const) for (const p of pieces(d.name[loc])) push(aliases, seen, p, d.code, 'pathogen');
    const short = (d.meta?.short as string | undefined) ?? '';
    if (short && short.length > 3) push(aliases, seen, short, d.code, 'pathogen');
    const kp = d.meta?.keyPhenotype as string | undefined;
    if (kp) keyPhenotype[d.code] = kp;
  }
  for (const [code, syn] of Object.entries(PATHOGEN_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'pathogen');

  for (const d of dims.antibiotics ?? []) {
    for (const loc of ['zh-TW', 'en', 'ja'] as const) for (const p of pieces(d.name[loc])) push(aliases, seen, p, d.code, 'antibiotic');
    if (d.group) antibioticClass[d.code] = d.group;
  }
  for (const [code, syn] of Object.entries(ANTIBIOTIC_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'antibiotic');

  for (const d of dims.antibioticClasses ?? []) {
    for (const loc of ['zh-TW', 'en', 'ja'] as const) push(aliases, seen, d.name[loc], d.code, 'class');
  }
  for (const [code, syn] of Object.entries(CLASS_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'class');

  for (const d of dims.phenotypes ?? []) {
    for (const loc of ['zh-TW', 'en', 'ja'] as const) for (const p of pieces(d.name[loc])) push(aliases, seen, p, d.code, 'phenotype');
    phenotypeMeta[d.code] = {
      pathogen: d.meta?.pathogen as string | undefined,
      antibiotic: d.meta?.antibiotic as string | undefined,
      drugClass: d.meta?.drugClass as string | undefined,
      glassIndicator: d.meta?.glassIndicator as string | undefined,
    };
  }
  for (const [code, syn] of Object.entries(PHENOTYPE_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'phenotype');

  for (const [code, syn] of Object.entries(LEVEL_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'level');
  for (const [code, syn] of Object.entries(SETTING_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'setting');
  for (const [code, syn] of Object.entries(SPECIMEN_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'specimen');

  for (const d of dims.countries ?? []) {
    for (const loc of ['zh-TW', 'en', 'ja'] as const) push(aliases, seen, d.name[loc], d.code, 'country');
  }
  for (const [code, syn] of Object.entries(COUNTRY_SYN)) for (const s of syn) pushExact(aliases, seen, s, code, 'country');

  // Longest first; on equal length prefer more specific kinds (phenotype > pathogen > others).
  const kindRank: Record<EntityKind, number> = { phenotype: 0, antibiotic: 1, class: 2, pathogen: 3, level: 4, setting: 5, specimen: 6, country: 7 };
  aliases.sort((a, b) => b.term.length - a.term.length || kindRank[a.kind] - kindRank[b.kind]);
  const idx: AliasIndex = { aliases, phenotypeMeta, antibioticClass, keyPhenotype };
  cache.set(dims, idx);
  return idx;
}

/** Resolve entities in an utterance. Overlapping matches are resolved longest-first. */
export function extractEntities(text: string, index: AliasIndex): Entities {
  const hay = normalizeForMatch(text);
  const taken = new Uint8Array(hay.length);
  const hits: EntityHit[] = [];
  for (const a of index.aliases) {
    let from = 0;
    for (;;) {
      const i = hay.indexOf(a.term, from);
      if (i < 0) break;
      from = i + 1;
      const end = i + a.term.length;
      if (a.latin) {
        const before = hay[i - 1] ?? ' ';
        const after = hay[end] ?? ' ';
        if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
      }
      let free = true;
      for (let k = i; k < end; k++)
        if (taken[k]) {
          free = false;
          break;
        }
      if (!free) continue;
      for (let k = i; k < end; k++) taken[k] = 1;
      hits.push({ kind: a.kind, code: a.code, start: i, end, term: a.term });
    }
  }
  hits.sort((x, y) => x.start - y.start);
  const uniq = <T extends string>(kind: EntityKind): T[] => [...new Set(hits.filter((h) => h.kind === kind).map((h) => h.code as T))];
  return {
    pathogens: uniq('pathogen'),
    antibiotics: uniq('antibiotic'),
    classes: uniq('class'),
    phenotypes: uniq('phenotype'),
    levels: uniq('level'),
    settings: uniq('setting'),
    specimens: uniq('specimen'),
    countries: uniq('country'),
    hits,
  };
}

/** Canonical KB tag tokens for resolved entities (cross-language "known terms"). */
export const ENTITY_TAGS: Record<string, string[]> = {
  ABA: ['acinetobacter'],
  KPN: ['klebsiella'],
  ECO: ['ecoli'],
  PAE: ['pseudomonas'],
  ENC: ['enterococcus'],
  EFM: ['enterococcus'],
  EFA: ['enterococcus'],
  SPN: ['pneumococcus', 'pnsp'],
  SAU: ['mrsa'],
  CDI: ['cdi', 'clostridioides'],
  ENB: ['cre'],
  MRSA: ['mrsa'],
  VRE: ['vre'],
  'VR-EFM': ['vre'],
  'VR-EFA': ['vre'],
  CRAB: ['crab'],
  CRKP: ['crkp', 'cre'],
  CRPA: ['crpa'],
  CRE: ['cre'],
  'CR-ECO': ['cre', 'ecoli'],
  carbapenems: ['cre'],
  ceph3: ['esbl', '3gc'],
  fluoroquinolones: ['fq', 'quinolone'],
  blood: ['blood', 'specimen'],
  urine: ['urine', 'specimen'],
  medical_center: ['hospital', 'level'],
  regional: ['hospital', 'level'],
  district: ['hospital', 'level'],
};
