/**
 * BM25F-style retrieval over the trilingual knowledge base (kb.json).
 * Fields: q paraphrases (weight 2), tags (1.5), answer (1). Entries are grouped by
 * their id stem (`crab-zh` / `crab-en` / `crab-ja` → `crab`); the best-scoring language
 * variant decides the group's score and the UI-language variant is served.
 */
import type { KbRecord, Locale } from '../../../data/types';
import { tokenize } from './text';

const K1 = 1.2;
const B = 0.75;
const W_Q = 2;
const W_TAG = 1.5;
const W_A = 1;

interface Doc {
  rec: KbRecord;
  group: string;
  tf: Map<string, number>;
  len: number;
}

export interface KbIndex {
  docs: Doc[];
  df: Map<string, number>;
  avgLen: number;
  byGroup: Map<string, Partial<Record<Locale, KbRecord>>>;
}

export interface KbHit {
  group: string;
  /** entry in the requested locale (falls back to en → any) */
  rec: KbRecord;
  score: number;
  /** idf-weighted share of the query terms matched by the best doc (0–1) */
  coverage: number;
}

const LANG_SUFFIX: Record<string, Locale> = { zh: 'zh-TW', en: 'en', ja: 'ja' };

export function kbGroup(id: string): string {
  const m = /^(.*)-(zh|en|ja)$/.exec(id);
  return m ? m[1] : id;
}

const cache = new WeakMap<object, KbIndex>();

export function buildKbIndex(records: readonly KbRecord[]): KbIndex {
  const hit = cache.get(records);
  if (hit) return hit;
  const docs: Doc[] = [];
  const df = new Map<string, number>();
  const byGroup = new Map<string, Partial<Record<Locale, KbRecord>>>();
  let total = 0;
  for (const rec of records) {
    const group = kbGroup(rec.id);
    const tf = new Map<string, number>();
    const add = (tokens: string[], w: number) => {
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + w);
    };
    add(tokenize(rec.q.join(' \n ')), W_Q);
    add(
      rec.tags.flatMap((t) => [t.toLowerCase(), ...tokenize(t.replace(/-/g, ' '))]),
      W_TAG,
    );
    add(tokenize(rec.a), W_A);
    let len = 0;
    for (const v of tf.values()) len += v;
    total += len;
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    docs.push({ rec, group, tf, len });
    const g = byGroup.get(group) ?? {};
    const suffix = /-(zh|en|ja)$/.exec(rec.id)?.[1];
    g[rec.lang ?? (suffix ? LANG_SUFFIX[suffix] : 'en')] = rec;
    byGroup.set(group, g);
  }
  const idx: KbIndex = { docs, df, avgLen: docs.length ? total / docs.length : 1, byGroup };
  cache.set(records, idx);
  return idx;
}

function idf(index: KbIndex, t: string): number {
  const n = index.docs.length;
  const d = index.df.get(t) ?? 0;
  return Math.log(1 + (n - d + 0.5) / (d + 0.5));
}

/** Pick the locale variant of a KB group (locale → en → any). */
export function kbEntry(index: KbIndex, group: string, locale: Locale): KbRecord | undefined {
  const g = index.byGroup.get(group);
  if (!g) return undefined;
  return g[locale] ?? g.en ?? Object.values(g)[0];
}

/**
 * Score the query against every doc; return groups sorted by score.
 * `extraTokens` are canonical "known term" tokens from entity resolution.
 */
export function searchKb(index: KbIndex, query: string, locale: Locale, opts: { extraTokens?: string[]; limit?: number } = {}): KbHit[] {
  const qTokens = [...new Set([...tokenize(query), ...(opts.extraTokens ?? [])])];
  if (!qTokens.length) return [];
  const qIdf = new Map(qTokens.map((t) => [t, idf(index, t)]));
  const qIdfTotal = [...qIdf.values()].reduce((a, b) => a + b, 0) || 1;
  const best = new Map<string, { score: number; coverage: number }>();
  for (const d of index.docs) {
    let score = 0;
    let matched = 0;
    for (const t of qTokens) {
      const f = d.tf.get(t);
      if (!f) continue;
      const w = qIdf.get(t)!;
      matched += w;
      score += (w * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * d.len) / index.avgLen));
    }
    if (score <= 0) continue;
    // small boost for the UI-language variant so ties resolve to it
    if (d.rec.lang === locale) score *= 1.05;
    const cur = best.get(d.group);
    if (!cur || score > cur.score) best.set(d.group, { score, coverage: matched / qIdfTotal });
  }
  const hits: KbHit[] = [];
  for (const [group, v] of best) {
    const rec = kbEntry(index, group, locale);
    if (rec) hits.push({ group, rec, score: v.score, coverage: v.coverage });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, opts.limit ?? 5);
}

export interface KbDecision {
  confident: boolean;
  top?: KbHit;
  related: KbHit[];
}

/** Confidence rule: absolute score + idf-weighted query coverage. */
export function decideKb(hits: KbHit[]): KbDecision {
  const [top, ...rest] = hits;
  if (!top) return { confident: false, related: [] };
  const second = rest[0]?.score ?? 0;
  const margin = top.score - second;
  const confident = (top.score >= 4 && top.coverage >= 0.4) || (top.score >= 2.5 && top.coverage >= 0.55 && margin >= 0.5);
  return { confident, top, related: confident ? rest.slice(0, 3) : hits.slice(0, 4) };
}
