/** Conversation persistence (last 20 messages) in localStorage `twamr.chat`. */
import type { ChatContext, MiniChartSpec, AnswerLink } from '../engine/types';

export const CHAT_STORAGE = 'twamr.chat';
export const MAX_MESSAGES = 20;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  /** which engine produced an assistant message */
  source?: 'offline' | 'claude';
  kind?: string;
  chart?: MiniChartSpec;
  links?: AnswerLink[];
  chips?: string[];
  /** friendly error shown above a fallback answer */
  error?: string;
  /** streaming in progress (never persisted) */
  pending?: boolean;
  locale?: string;
}

interface Stored {
  v: 1;
  messages: ChatMessage[];
  context?: ChatContext;
}

export function loadChat(): { messages: ChatMessage[]; context?: ChatContext } {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE);
    if (!raw) return { messages: [] };
    const s = JSON.parse(raw) as Stored;
    if (s?.v !== 1 || !Array.isArray(s.messages)) return { messages: [] };
    return {
      messages: s.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string').slice(-MAX_MESSAGES),
      context: s.context,
    };
  } catch {
    return { messages: [] };
  }
}

export function saveChat(messages: ChatMessage[], context?: ChatContext): void {
  try {
    const keep = messages.filter((m) => !m.pending).slice(-MAX_MESSAGES);
    if (!keep.length) localStorage.removeItem(CHAT_STORAGE);
    else localStorage.setItem(CHAT_STORAGE, JSON.stringify({ v: 1, messages: keep, context } satisfies Stored));
  } catch {
    /* storage full / unavailable — conversation stays in memory */
  }
}

let seq = 0;
export function newId(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}
