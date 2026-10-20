/**
 * Chat state machine shared by the drawer and the #/chat page: loads the datasets once,
 * runs the offline engine, optionally streams Claude, persists the last 20 messages.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDataset } from '../../../data/load';
import type { DatasetName } from '../../../data/types';
import { useT } from '../../../i18n';
import { answerQuestion } from '../engine/answer';
import { CLAUDE_MODEL, ClaudeError, readKey, streamClaude, type HistoryTurn } from '../engine/claude';
import type { ChatContext, EngineAnswer, EngineData } from '../engine/types';
import { loadChat, newId, saveChat, type ChatMessage } from './storage';

const DATASETS: DatasetName[] = ['resistance', 'isolates', 'glass', 'kb', 'meta'];

let dataPromise: Promise<EngineData> | null = null;
/** Load every dataset the engine needs (cached; failures leave that dataset undefined). */
export function loadEngineData(): Promise<EngineData> {
  if (!dataPromise) {
    dataPromise = Promise.allSettled(DATASETS.map((n) => loadDataset(n))).then((res) => {
      const out: Record<string, unknown> = {};
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') out[DATASETS[i]] = r.value.data;
      });
      if (!out.kb && !out.resistance) dataPromise = null; // allow retry
      return out as EngineData;
    });
  }
  return dataPromise;
}

export function useApiKey(): [string, () => void] {
  const [key, setKey] = useState(() => readKey());
  const refresh = useCallback(() => setKey(readKey()), []);
  useEffect(() => {
    const on = () => setKey(readKey());
    window.addEventListener('twamr:anthropic-key', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('twamr:anthropic-key', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return [key, refresh];
}

function fromAnswer(a: EngineAnswer, locale: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: newId(),
    role: 'assistant',
    text: a.text,
    ts: Date.now(),
    source: 'offline',
    kind: a.kind,
    chart: a.chart,
    links: a.links,
    chips: a.chips,
    locale,
    ...extra,
  };
}

export function useChat() {
  const t = useT();
  const locale = t.locale;
  const [{ messages, context }, setState] = useState(() => loadChat());
  const [data, setData] = useState<EngineData | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey] = useApiKey();
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef({ messages, context });
  stateRef.current = { messages, context };

  useEffect(() => {
    let alive = true;
    loadEngineData().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    saveChat(messages, context);
  }, [messages, context]);

  // keep other open instances (drawer ↔ page) in sync
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === 'twamr.chat') setState(loadChat());
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const patch = useCallback((id: string, fn: (m: ChatMessage) => ChatMessage) => {
    setState((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) }));
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      const user: ChatMessage = { id: newId(), role: 'user', text: q, ts: Date.now(), locale };
      const history: HistoryTurn[] = stateRef.current.messages.filter((m) => !m.pending && !m.error).map((m) => ({ role: m.role, content: m.text }));
      setState((s) => ({ ...s, messages: [...s.messages, user] }));
      setBusy(true);
      const engineData = data ?? (await loadEngineData());
      const offline = answerQuestion(q, { locale, data: engineData, context: stateRef.current.context });
      const nextContext: ChatContext | undefined = offline.context ?? stateRef.current.context;
      const key = apiKey;
      if (!key) {
        setState((s) => ({ messages: [...s.messages, fromAnswer(offline, locale)], context: nextContext }));
        setBusy(false);
        return;
      }
      const pending = fromAnswer(offline, locale, { text: '', source: 'claude', pending: true });
      setState((s) => ({ messages: [...s.messages, pending], context: nextContext }));
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let acc = '';
      try {
        const out = await streamClaude({
          apiKey: key,
          locale,
          question: q,
          offline,
          history,
          signal: ctrl.signal,
          onText: (d) => {
            acc += d;
            const snapshot = acc;
            patch(pending.id, (m) => ({ ...m, text: snapshot }));
          },
        });
        const text = out.text.trim() || offline.text;
        patch(pending.id, (m) => ({
          ...m,
          text: out.stopReason === 'max_tokens' ? `${text}\n\n${t('chat.err.truncated')}` : text,
          pending: false,
        }));
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          patch(pending.id, (m) => ({ ...m, text: acc.trim() || offline.text, source: acc.trim() ? 'claude' : 'offline', pending: false }));
        } else {
          const ce = err instanceof ClaudeError ? err : new ClaudeError('generic', String((err as Error)?.message ?? err));
          const msg = t(`chat.err.${ce.kind}`, { model: CLAUDE_MODEL, detail: ce.detail.slice(0, 160) });
          patch(pending.id, (m) => ({ ...m, text: offline.text, source: 'offline', pending: false, error: `${msg} ${t('chat.err.fallbackNote')}` }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, data, locale, apiKey, patch, t],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setState({ messages: [], context: undefined });
  }, []);

  return { messages, send, stop, clear, busy, ready: !!data, apiKey, data };
}
