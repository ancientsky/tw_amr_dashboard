/**
 * Offline answer engine: data intents first (precise numbers + mini chart + deep link),
 * then BM25 retrieval over the KB, then a graceful "not sure" with related topics.
 */
import type { Dim, Locale } from '../../../data/types';
import { buildAliasIndex, ENTITY_TAGS, type AliasIndex, type EntityDims } from './entities';
import { execGlass } from './intents/glass';
import { execIsolates } from './intents/isolates';
import { execResistance } from './intents/resistance';
import { emptyAnswer, hashLink, tc, type ExecCtx } from './intents/common';
import { buildKbIndex, decideKb, kbEntry, searchKb, type KbHit, type KbIndex } from './kb';
import { parseQuery, resolveIntent } from './parse';
import type { ChatContext, DataIntent, EngineAnswer, EngineData, ParsedQuery } from './types';

const dimsCache = new WeakMap<object, { glass: unknown; dims: EntityDims }>();

/** Alias index for the loaded datasets (memoised on the resistance dims object). */
export function aliasIndexFor(data: EngineData): AliasIndex {
  const rd = (data.resistance?.dims ?? EMPTY) as Record<string, Dim[]>;
  const glassDims = data.glass?.dims;
  let entry = dimsCache.get(rd);
  if (!entry || entry.glass !== glassDims) {
    entry = {
      glass: glassDims,
      dims: {
        pathogens: rd.pathogens,
        antibiotics: rd.antibiotics,
        antibioticClasses: rd.antibioticClasses,
        phenotypes: rd.phenotypes,
        countries: glassDims?.countries,
      },
    };
    dimsCache.set(rd, entry);
  }
  return buildAliasIndex(entry.dims);
}
const EMPTY = {};

/** Tag → phenotype context, so a KB answer about CRAB lets "哪個層級最高？" follow up. */
const TAG_PHENOTYPE: Record<string, string> = { crab: 'CRAB', crkp: 'CRKP', mrsa: 'MRSA', vre: 'VRE', crpa: 'CRPA', cre: 'CRE' };

export interface AnswerOptions {
  locale: Locale;
  data: EngineData;
  context?: ChatContext;
}

export interface AnswerDebug {
  parsed: ParsedQuery;
  intent: DataIntent | null;
  hits: KbHit[];
}

function kbIndexFor(data: EngineData): KbIndex | null {
  return data.kb?.records?.length ? buildKbIndex(data.kb.records) : null;
}

function kbLink(x: ExecCtx, hit: KbHit) {
  const c = hit.rec.chart;
  if (!c?.route) return [];
  const label = c.label ? c.label[x.locale] || c.label.en : tc(x.locale, 'link.related');
  return [{ label, href: hashLink(c.route, c.params ?? {}) }];
}

/** Run the full pipeline; `debug` receives intermediate results (tests / dev). */
export function answerQuestion(question: string, opts: AnswerOptions, debug?: (d: AnswerDebug) => void): EngineAnswer {
  const { locale, data } = opts;
  const q = question.trim();
  if (!data.kb && !data.resistance) return emptyAnswer({ kind: 'loading', text: tc(locale, 'loading'), confidence: 0 });
  const idx = aliasIndexFor(data);
  const x: ExecCtx = { locale, data, idx };
  const parsed = parseQuery(q, locale, idx);
  const intent = resolveIntent(parsed, idx, opts.context);

  const kbIdx = kbIndexFor(data);
  const extra = [
    ...parsed.entities.phenotypes,
    ...parsed.entities.pathogens,
    ...parsed.entities.classes,
    ...parsed.entities.specimens,
    ...parsed.entities.levels,
  ].flatMap((c) => ENTITY_TAGS[c] ?? []);
  const hits = kbIdx ? searchKb(kbIdx, q, locale, { extraTokens: extra, limit: 6 }) : [];
  debug?.({ parsed, intent, hits });
  const passages = hits.slice(0, 3).map((h) => ({ id: h.rec.id, text: h.rec.a }));

  if (intent) {
    let ans: EngineAnswer | null = null;
    try {
      ans =
        intent.kind === 'glass'
          ? execGlass(x, intent)
          : intent.kind === 'isolates'
            ? execIsolates(x, intent)
            : execResistance(x, intent);
    } catch (err) {
      console.warn('[chat] intent failed', err);
      ans = null;
    }
    if (ans) {
      // offer the matching concept entry ("What is CRAB?") as a follow-up when present
      if (kbIdx && intent.phenotype && !ans.chips.some((c) => c.includes(intent.phenotype!))) {
        ans.chips.push(tc(locale, 'chip.what', { name: intent.phenotype }));
      }
      ans.passages = passages;
      ans.chips = [...new Set(ans.chips)].slice(0, 4);
      return ans;
    }
    if (intent.kind !== 'glass' && (intent.phenotype || intent.pathogen) && data.resistance) {
      // entity understood but nothing in the data → say so, then fall through to KB suggestions
      const name = intent.phenotype ?? intent.pathogen ?? '';
      const related = hits.slice(0, 3).map((h) => h.rec.q[0]);
      return emptyAnswer({
        kind: 'unsure',
        text: tc(locale, 'ans.noData', { name }),
        chips: related,
        passages,
        confidence: 0.3,
        facts: [`No matching Taiwan data row for: ${JSON.stringify({ ...intent, years: intent.years })}`],
      });
    }
  }

  const decision = decideKb(hits);
  if (decision.confident && decision.top) {
    const top = decision.top;
    const phen = top.rec.tags.map((t) => TAG_PHENOTYPE[t]).find(Boolean);
    const chips = decision.related.filter((h) => !h.rec.tags.includes('meta')).map((h) => h.rec.q[0]);
    if (phen) chips.unshift(tc(locale, 'chip.trend', { name: phen }), tc(locale, 'chip.rankLevels', { name: phen }));
    return emptyAnswer({
      kind: 'kb',
      text: top.rec.a,
      links: kbLink(x, top),
      chips: [...new Set(chips)].slice(0, 4),
      passages,
      confidence: Math.min(1, top.score / 8),
      context: phen ? { phenotype: phen, pathogen: idx.phenotypeMeta[phen]?.pathogen } : opts.context,
    });
  }
  if (decision.related.length) {
    return emptyAnswer({
      kind: 'unsure',
      text: tc(locale, 'unsure'),
      chips: decision.related.map((h) => h.rec.q[0]).slice(0, 4),
      links: decision.related.slice(0, 1).flatMap((h) => kbLink(x, h)),
      passages,
      confidence: decision.top ? Math.min(0.5, decision.top.score / 8) : 0,
      context: opts.context,
    });
  }
  return emptyAnswer({
    kind: 'fallback',
    text: tc(locale, 'fallback'),
    chips: [tc(locale, 'q.crkpMc'), tc(locale, 'q.whatCrab'), tc(locale, 'q.download')],
    passages,
    confidence: 0,
    context: opts.context,
  });
}

/** Look up the localized KB greeting (welcome message). */
export function greeting(data: EngineData, locale: Locale): string | undefined {
  const idx = kbIndexFor(data);
  return idx ? kbEntry(idx, 'greeting', locale)?.a : undefined;
}
