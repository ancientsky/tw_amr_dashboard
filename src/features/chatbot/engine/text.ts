/**
 * Text normalisation + tokenisation shared by the KB retriever and the entity matcher.
 * Script-aware rather than language-aware: Latin runs → stemmed words, CJK runs →
 * character bigrams (plus the run itself when short), so mixed queries such as
 * 「CRAB 是什麼」 or "MRSA 的趨勢" tokenise sensibly.
 */
import type { Locale } from '../../../data/types';

const KANA = /[぀-ヿㇰ-ㇿ]/;
const HAN = /[㐀-鿿豈-﫿]/;
const CJK_RUN = /[぀-ヿㇰ-ㇿ㐀-鿿豈-﫿ー]+/g;
const LATIN_RUN = /[a-z0-9]+/g;

/** NFKC, lowercase, 臺→台, unify dashes/whitespace. Keeps punctuation (years regexes need it). */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/臺/g, '台')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** normalize() + punctuation → single spaces. Used for alias matching ("e. coli" ≡ "e coli"). */
export function normalizeForMatch(s: string): string {
  return ` ${normalize(s)
    .replace(/[.\-_/\\·・,，、。:：;；()（）[\]【】「」『』"'“”‘’!！?？~〜～+&*%＊]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

export function hasCjk(s: string): boolean {
  return HAN.test(s) || KANA.test(s);
}

/** Script-based guess at the language of an utterance (falls back to the UI locale). */
export function detectLang(s: string, fallback: Locale): Locale {
  if (KANA.test(s)) return 'ja';
  if (HAN.test(s)) return fallback === 'ja' ? 'ja' : 'zh-TW';
  if (/[a-z]{2,}/i.test(s)) return 'en';
  return fallback;
}

const EN_STOP = new Set(
  'a an the is are was were be been of in on at for to from and or vs by with about what whats which who how does do did can could would should will me my i you your it its this that these those there their please tell show give much many any some get got rate rates'.split(
    ' ',
  ),
);

/** Tiny suffix-stripping stemmer (good enough for KB matching; not Porter-complete). */
export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (s.endsWith('es') && /(ch|sh|x|ss)es$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith('s') && !s.endsWith('ss') && !s.endsWith('us') && !s.endsWith('is')) s = s.slice(0, -1);
  const rules: [RegExp, string][] = [
    [/ization$/, 'ize'],
    [/isation$/, 'ize'],
    [/ational$/, 'ate'],
    [/(t)ion$/, '$1'],
    [/(s)ion$/, '$1'],
    [/ness$/, ''],
    [/ment$/, ''],
    [/ance$/, ''],
    [/ence$/, ''],
    [/ant$/, ''],
    [/ent$/, ''],
    [/ing$/, ''],
    [/edly$/, ''],
    [/ed$/, ''],
    [/ly$/, ''],
    [/ity$/, ''],
    [/ive$/, ''],
    [/al$/, ''],
  ];
  for (const [re, rep] of rules) {
    if (re.test(s)) {
      const next = s.replace(re, rep);
      if (next.length >= 4) {
        s = next;
        break;
      }
    }
  }
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

/** Tokenise text into stemmed Latin words + CJK bigrams. */
export function tokenize(text: string): string[] {
  const t = normalize(text);
  const out: string[] = [];
  for (const m of t.matchAll(LATIN_RUN)) {
    const w = m[0];
    if (EN_STOP.has(w)) continue;
    if (w.length === 1 && !/\d/.test(w)) continue;
    out.push(stem(w));
  }
  for (const m of t.matchAll(CJK_RUN)) {
    const run = m[0];
    if (run.length === 1) {
      out.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  }
  return out;
}

/** Simple string hash (stable ids for messages/cache keys). */
export function hashString(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
