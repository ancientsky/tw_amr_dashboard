/**
 * Canonical data contract — mirrors docs/ARCHITECTURE.md §4 exactly.
 * Every consumer codes against these types. Shared file: append only.
 */

export type Locale = 'zh-TW' | 'en' | 'ja';
export const LOCALES: readonly Locale[] = ['zh-TW', 'en', 'ja'] as const;

export type LocalizedText = { 'zh-TW': string; en: string; ja: string };

export interface SourceRef {
  id: string;
  title: LocalizedText;
  publisher: string;
  year: number;
  url?: string;
  kind: 'annual-report' | 'open-data' | 'glass' | 'curated';
}

export interface Dim {
  code: string;
  name: LocalizedText;
  group?: string;
  order?: number;
  meta?: Record<string, unknown>;
}

export interface Envelope<T> {
  dataset: string;
  version: string;
  generatedAt: string;
  provisional: boolean;
  sources: SourceRef[];
  notes?: LocalizedText;
  dims?: Record<string, Dim[]>;
  records: T[];
}

/* ---------- shared enums ---------- */

export type Level = 'all' | 'medical_center' | 'regional' | 'district';
export type Ward = 'all' | 'icu' | 'non_icu';
export type Specimen = 'all' | 'blood' | 'urine' | 'sputum' | 'pus' | 'stool';
/** THAS onset setting: community-onset / hospital-onset. */
export type OnsetSetting = 'all' | 'co' | 'ho';
/** How exact a transcribed value is (chart_estimate ≈ ±1–2 pts). */
export type Precision = 'table' | 'text' | 'chart_estimate';
export type WhoPriority = 'critical' | 'high' | 'medium';

export const LEVELS: readonly Level[] = ['all', 'medical_center', 'regional', 'district'];
export const WARDS: readonly Ward[] = ['all', 'icu', 'non_icu'];
export const SPECIMENS: readonly Specimen[] = ['all', 'blood', 'urine', 'sputum', 'pus', 'stool'];
export const ONSET_SETTINGS: readonly OnsetSetting[] = ['all', 'co', 'ho'];
export const PRECISIONS: readonly Precision[] = ['table', 'text', 'chart_estimate'];

/** Pathogen dim meta (dims.pathogens[].meta). */
export interface PathogenMeta {
  gram?: '+' | '-' | 'positive' | 'negative' | string;
  whoPriority?: WhoPriority;
  keyPhenotype?: string;
}

/* ---------- 2. resistance.json ---------- */

export interface ResistanceRecord {
  year: number;
  /** short code: SAU, EFM, EFA, ECO, KPN, PAE, ABA, ENT, SPN, CDI … */
  pathogen: string;
  /** antibiotic code: OXA, VAN, CRO, MEM, CIP, TZP, AMK, COL, TGC, LVX, PEN, ERY, CAZ, FEP, SXT … */
  antibiotic: string;
  /** phenotype code: MRSA, VRE, CRAB, CRKP, CRPA, CRE, 3GC-R-ECO … */
  phenotype?: string;
  level: Level;
  ward: Ward;
  /** community-onset / hospital-onset infection per THAS */
  setting: OnsetSetting;
  specimen: Specimen;
  isolates: number | null;
  resistant_pct: number;
  susceptible_pct?: number;
  precision: Precision;
  /** edition of the annual report the value was transcribed from */
  reportYear?: number;
}

/* ---------- 2b. isolates.json ---------- */

export type IsolateScope = 'all' | 'blood' | 'urine' | 'sputum' | 'pus' | 'stool' | 'co' | 'ho';

export interface IsolateRecord {
  year: number;
  organism: string;
  scope: IsolateScope;
  level?: Level;
  rank?: number;
  isolates: number;
  precision?: Precision;
  reportYear?: number;
  /** MDRO split counts: 'I+R' | 'S'; absent = totals */
  subset?: string;
}

/* ---------- 3. antibiotic_use.json ---------- */

export type AmuSetting = 'inpatient' | 'outpatient' | 'all';
export type AwareCategory = 'Access' | 'Watch' | 'Reserve' | 'Not recommended' | 'Unclassified';
export type AmuMetric = 'DID' | 'DDD_per_1000_inhabitants_day' | 'DOT';

export interface AmuRecord {
  year: number;
  level: Level;
  setting: AmuSetting;
  /** ATC code: J01, J01CR05, J01DH … */
  atc: string;
  /** class code (dims.classes) */
  className: string;
  aware: AwareCategory;
  /** DID = DDD/1000 patient-days */
  metric: AmuMetric;
  value: number;
}

/* ---------- 4. hai.json / hai_pathogens.json ---------- */

export type IcuType =
  | 'all'
  | 'medical'
  | 'surgical'
  | 'mixed'
  | 'cardiac'
  | 'neuro'
  | 'pediatric'
  | 'neonatal'
  | 'burn';

export type HaiMetric =
  | 'hai_density'
  | 'clabsi'
  | 'cauti'
  | 'vap'
  | 'central_line_util'
  | 'urinary_cath_util'
  | 'ventilator_util'
  | 'bsi_density'
  | 'uti_density'
  | 'pneu_density';

export interface HaiRecord {
  year: number;
  level: Level;
  icu_type: IcuType;
  metric: HaiMetric;
  value: number;
  unit: string;
}

export type HaiSite = 'all' | 'bsi' | 'uti' | 'pneu';

export interface HaiPathogenRecord {
  year: number;
  level: Level;
  site: HaiSite;
  rank: number;
  pathogen: string;
  pct: number;
}

/* ---------- 5. glass.json ---------- */

export type GlassIndicator =
  | 'MRSA_BLOOD'
  | '3GC_R_ECO_BLOOD'
  | 'CR_ECO_BLOOD'
  | '3GC_R_KPN_BLOOD'
  | 'CR_KPN_BLOOD'
  | 'CR_ABA_BLOOD'
  | 'CR_PAE_BLOOD'
  | 'VRE_EFM_BLOOD'
  | 'FQ_R_ECO_BLOOD'
  | 'PNSP_BLOOD';

export interface GlassRecord {
  iso3: string;
  country: LocalizedText;
  whoRegion: string;
  year: number;
  indicator: GlassIndicator;
  resistant_pct: number;
  isolates: number | null;
  source: string;
}

/* ---------- 6. links.json ---------- */

export type LinkCategory = 'amr' | 'amu' | 'hai' | 'one-health' | 'data-portal' | 'guideline';

export interface LinkRecord {
  id: string;
  org: string;
  name: LocalizedText;
  url: string;
  category: LinkCategory;
  region: string;
  description: LocalizedText;
  tags: string[];
}

/* ---------- 7. glossary.json ---------- */

export interface GlossaryRecord {
  term: LocalizedText;
  abbr: string;
  definition: LocalizedText;
  related: string[];
}

/* ---------- 8. kb.json ---------- */

/** Deep link to a chart (route + hash query params) used by the chatbot KB. */
export interface ChartLink {
  /** route path, e.g. '/resistance' */
  route?: string;
  /** embed/registry chart id, e.g. 'resistance-trend' */
  chart?: string;
  params?: Record<string, string>;
  label?: LocalizedText;
}

export interface KbRecord {
  id: string;
  lang: Locale;
  q: string[];
  a: string;
  chart?: ChartLink;
  tags: string[];
}

/* ---------- 1. meta.json ---------- */

export interface IngestionPdf {
  file?: string;
  name?: string;
  report?: string;
  year?: number;
  sha256?: string;
  status?: string;
  [k: string]: unknown;
}

export interface MetaData {
  latestYear: number;
  yearsAvailable: number[];
  provisional: boolean;
  sources: SourceRef[];
  ingestion: { status: 'provisional' | 'ingested'; pdfs: Array<IngestionPdf | string> };
  lastBuild: string;
  /** optional extras the pipeline may emit (e.g. comparability notes) */
  comparability?: Record<string, unknown>;
  datasets?: string[];
  /** datasets whose envelopes are provisional (pipeline convenience; envelopes remain authoritative) */
  provisionalDatasets?: string[];
  contentDigest?: string;
  notes?: LocalizedText;
  [k: string]: unknown;
}

/* ---------- dataset registry ---------- */

export interface DatasetMap {
  meta: MetaData;
  resistance: Envelope<ResistanceRecord>;
  isolates: Envelope<IsolateRecord>;
  antibiotic_use: Envelope<AmuRecord>;
  hai: Envelope<HaiRecord>;
  hai_pathogens: Envelope<HaiPathogenRecord>;
  glass: Envelope<GlassRecord>;
  links: Envelope<LinkRecord>;
  glossary: Envelope<GlossaryRecord>;
  kb: Envelope<KbRecord>;
}

export type DatasetName = keyof DatasetMap;
