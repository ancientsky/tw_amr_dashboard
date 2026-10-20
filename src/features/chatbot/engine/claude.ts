/**
 * Optional Claude mode: streams an answer from the Anthropic Messages API directly from
 * the browser with the user's own key (stored only in localStorage `twamr.anthropicKey`).
 *
 * Raw fetch + SSE parsing instead of @anthropic-ai/sdk: the project's dependency set is
 * fixed (docs/PHASE2.md) and this is the only runtime network call besides share intents.
 * The offline engine runs first; its resolved facts + KB passages are injected into the
 * system prompt so the model cites real Taiwan numbers instead of guessing.
 */
import type { Locale } from '../../../data/types';
import type { EngineAnswer } from './types';

export const CLAUDE_MODEL = 'claude-haiku-5-5';
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const KEY_STORAGE = 'twamr.anthropicKey';

export type ClaudeErrorKind = 'auth' | 'permission' | 'rateLimit' | 'overloaded' | 'network' | 'badRequest' | 'refusal' | 'generic';

export class ClaudeError extends Error {
  constructor(
    public kind: ClaudeErrorKind,
    public detail: string,
    public status?: number,
  ) {
    super(`${kind}: ${detail}`);
  }
}

export function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function writeKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable (private mode) — key lives for this session only */
  }
  window.dispatchEvent(new CustomEvent('twamr:anthropic-key'));
}

export function looksLikeKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

const LANG_NAME: Record<Locale, string> = { 'zh-TW': 'Traditional Chinese (zh-TW, Taiwan usage)', en: 'English', ja: 'Japanese' };

/** Stable instructions (identical across turns so the prefix stays cacheable). */
export const SYSTEM_INSTRUCTIONS = `You are the Q&A assistant of "TW-AMR Watch" (臺灣抗藥性監測儀表板), a static dashboard of Taiwan's national antimicrobial-resistance surveillance for infection-control professionals, clinical microbiologists and ID physicians.

Data provenance:
- Resistance (% non-susceptible / % resistant) and isolate counts are REAL values transcribed from the Taiwan CDC "Antimicrobial Resistance Surveillance Annual Report" 2022, 2023 and 2024 editions (THAS AR module), data years 2017–2024. Each value has a precision: "table" (exact antibiogram value; % = 100 − %S, i.e. non-susceptible incl. intermediate), "text" (stated in report text) or "chart_estimate" (read from a chart, about ±1–2 percentage points).
- Antibiotic use, healthcare-associated infection (HAI) and the international (WHO GLASS) comparison are PROVISIONAL curated estimates — say so whenever you use them.

Rules:
1. Answer in the language requested in the context block, concisely (usually 2–6 sentences or a short list). Use **bold** for key numbers. Plain markdown only (bold, lists, links); no tables, no headings.
2. Only state Taiwan figures that appear in the "Resolved data facts" block. Never invent, extrapolate or round differently any Taiwan number. If the facts don't cover the question, say the dashboard doesn't have that figure and point to the relevant page.
3. When you quote a chart_estimate value, mention it is read from a chart (≈ ±1–2 points). Mention the report edition when helpful.
4. You may explain general AMR concepts from your own knowledge, but keep them consistent with the knowledge-base passages, and do not give patient-specific treatment advice (recommend local guidelines / an ID physician).
5. Deep links: the dashboard uses hash routes. Resistance explorer: #/resistance?pathogen=<CODE>&antibiotic=<CODE>&phenotype=<CODE>&level=<all|medical_center|regional|district>&setting=<co|ho>&specimen=<blood|urine|pus|stool>&years=<YYYY-YYYY>; international view: #/international?indicator=<GLASS_CODE>&countries=TWN,JPN; other pages: #/, #/antibiotic-use, #/hai, #/data (downloads, API, embed), #/resources, #/about. Prefer the links given in the context; format them as markdown links.
6. Pathogen codes: SAU (S. aureus), EFM, EFA, ENC (Enterococcus spp.), SPN, ECO, KPN, ENB (Enterobacterales), PAE, ABA… Phenotypes: MRSA, VRE, VR-EFM, VR-EFA, CRAB, CRKP, CRPA, CRE, CR-ECO.`;

export function buildContextBlock(locale: Locale, offline: EngineAnswer): string {
  const facts = offline.facts.length ? offline.facts.map((f) => `- ${f}`).join('\n') : '- (no data intent resolved for this question)';
  const passages = offline.passages.length ? offline.passages.map((p) => `[${p.id}] ${p.text}`).join('\n') : '(none)';
  const links = offline.links.length ? offline.links.map((l) => `- ${l.label}: ${l.href}`).join('\n') : '(none)';
  return `Answer language: ${LANG_NAME[locale]}.

Resolved data facts (from the dashboard's datasets; the only Taiwan numbers you may cite):
${facts}

Offline engine draft answer (accurate; you may rephrase and expand):
${offline.text || '(none)'}

Knowledge-base passages:
${passages}

Suggested deep links:
${links}`;
}

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamOptions {
  apiKey: string;
  locale: Locale;
  question: string;
  offline: EngineAnswer;
  history: HistoryTurn[];
  signal?: AbortSignal;
  onText: (delta: string) => void;
  fetchImpl?: typeof fetch;
}

/** Map an HTTP status / API error type to a friendly error kind. */
export function classify(status: number | undefined, type?: string): ClaudeErrorKind {
  if (status === 401 || type === 'authentication_error') return 'auth';
  if (status === 403 || type === 'permission_error') return 'permission';
  if (status === 429 || type === 'rate_limit_error') return 'rateLimit';
  if (status === 529 || type === 'overloaded_error' || (status !== undefined && status >= 500)) return 'overloaded';
  if (status === 400 || status === 404 || status === 413 || type === 'invalid_request_error' || type === 'not_found_error') return 'badRequest';
  return 'generic';
}

/** Keep alternating roles, starting with a user turn, capped to the last few exchanges. */
export function trimHistory(history: HistoryTurn[], maxTurns = 8): HistoryTurn[] {
  const out: HistoryTurn[] = [];
  for (const h of history.slice(-maxTurns)) {
    if (!h.content.trim()) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === h.role) prev.content += `\n\n${h.content}`;
    else out.push({ ...h });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/**
 * Stream a Claude answer. Resolves with the full text and stop reason; throws ClaudeError.
 */
export async function streamClaude(o: StreamOptions): Promise<{ text: string; stopReason?: string }> {
  const doFetch = o.fetchImpl ?? fetch;
  const messages = [...trimHistory(o.history), { role: 'user' as const, content: o.question }];
  // ensure strict alternation after appending the question
  const merged = trimHistory(messages, messages.length);
  let res: Response;
  try {
    res = await doFetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: o.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': o.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        stream: true,
        // chat Q&A over supplied facts: low effort keeps latency down (Haiku 5.5 defaults to medium)
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: SYSTEM_INSTRUCTIONS },
          { type: 'text', text: buildContextBlock(o.locale, o.offline) },
        ],
        messages: merged,
      }),
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ClaudeError('network', (err as Error)?.message ?? 'fetch failed');
  }

  if (!res.ok) {
    let type: string | undefined;
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { type?: string; message?: string } };
      type = body.error?.type;
      if (body.error?.message) message = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ClaudeError(classify(res.status, type), message, res.status);
  }
  if (!res.body) throw new ClaudeError('generic', 'empty response body', res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let stopReason: string | undefined;
  const handle = (data: string) => {
    if (!data || data === '[DONE]') return;
    let ev: {
      type?: string;
      delta?: { type?: string; text?: string; stop_reason?: string };
      error?: { type?: string; message?: string };
    };
    try {
      ev = JSON.parse(data);
    } catch {
      return;
    }
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
      text += ev.delta.text;
      o.onText(ev.delta.text);
    } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) {
      stopReason = ev.delta.stop_reason;
    } else if (ev.type === 'error') {
      throw new ClaudeError(classify(undefined, ev.error?.type), ev.error?.message ?? 'stream error');
    }
    // thinking blocks (Haiku 5.5 thinks adaptively; display omitted) and pings are ignored
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      handle(data);
    }
  }
  if (buf.trim()) handle(buf.replace(/^data:\s*/m, ''));
  if (stopReason === 'refusal') throw new ClaudeError('refusal', 'refusal');
  return { text, stopReason };
}
