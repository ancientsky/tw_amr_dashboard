import type {
  Envelope,
  GlassRecord,
  IsolateRecord,
  KbRecord,
  Level,
  Locale,
  MetaData,
  OnsetSetting,
  ResistanceRecord,
} from '../../../data/types';
import type { Entities, SpecimenLike } from './entities';

/** Datasets the engine reads (any may be missing while loading / on failure). */
export interface EngineData {
  resistance?: Envelope<ResistanceRecord> | null;
  isolates?: Envelope<IsolateRecord> | null;
  glass?: Envelope<GlassRecord> | null;
  kb?: Envelope<KbRecord> | null;
  meta?: MetaData | null;
}

export type Mode = 'value' | 'trend' | 'compareYears' | 'byLevel' | 'rankLevels' | 'bySetting' | 'profile' | 'rank' | 'compare' | 'top';

/** Structured reading of an utterance (pure parse; no data access). */
export interface ParsedQuery {
  raw: string;
  lang: Locale;
  entities: Entities;
  years: number[];
  yearRange?: [number, number];
  /** cue words */
  cues: {
    trend: boolean;
    compare: boolean;
    rank: boolean;
    levelWord: boolean;
    count: boolean;
    international: boolean;
    latest: boolean;
    top: boolean;
    resistanceWord: boolean;
    question: boolean;
  };
}

export type IntentKind = 'phenotype' | 'drug' | 'glass' | 'isolates';

export interface DataIntent {
  kind: IntentKind;
  mode: Mode;
  phenotype?: string;
  pathogen?: string;
  antibiotics?: string[];
  /** antibiotic class the user named (for wording) */
  drugClass?: string;
  level: Level;
  setting: OnsetSetting;
  specimen: 'all' | SpecimenLike;
  years: number[];
  yearRange?: [number, number];
  indicator?: string;
  countries?: string[];
  /** entity fields inherited from the previous turn */
  inherited?: boolean;
}

/** Conversation context carried between turns so follow-ups ("which level is highest?") resolve. */
export interface ChatContext {
  phenotype?: string;
  pathogen?: string;
  antibiotics?: string[];
  level?: Level;
  setting?: OnsetSetting;
  specimen?: 'all' | SpecimenLike;
  indicator?: string;
}

export type ChartKind = 'line' | 'bar' | 'hbar';

/** Serializable mini-chart spec (persisted with the message; rendered with EChart). */
export interface MiniChartSpec {
  kind: ChartKind;
  title: string;
  categories: (string | number)[];
  series: { name: string; data: (number | null)[] }[];
  unit: 'pct' | 'count';
  /** index of a category to emphasise (bars) */
  highlight?: number;
  /** a precision caveat shown under the chart */
  note?: string;
}

export interface AnswerLink {
  label: string;
  /** hash route, e.g. '#/resistance?phenotype=CRKP' */
  href: string;
}

export interface EngineAnswer {
  kind: 'data' | 'kb' | 'unsure' | 'fallback' | 'loading';
  text: string;
  chart?: MiniChartSpec;
  links: AnswerLink[];
  chips: string[];
  /** English, model-facing facts (numbers + provenance) for Claude mode */
  facts: string[];
  /** KB passages (UI language) for Claude mode */
  passages: { id: string; text: string }[];
  confidence: number;
  intent?: DataIntent;
  context?: ChatContext;
}
