import { describe, expect, it } from 'vitest';
import { ANTHROPIC_URL, buildContextBlock, classify, ClaudeError, CLAUDE_MODEL, streamClaude, trimHistory } from '../claude';
import type { EngineAnswer } from '../types';

const offline: EngineAnswer = {
  kind: 'data',
  text: '2024 年醫學中心的 **CRKP** 為 **11.5%**。',
  links: [{ label: 'Open', href: '#/resistance?phenotype=CRKP' }],
  chips: [],
  facts: ['CRKP — medical centres: 2024 11.5% [read from a chart]'],
  passages: [{ id: 'crkp-zh', text: 'CRKP 是…' }],
  confidence: 1,
};

function sse(events: object[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      for (const e of events) c.enqueue(enc.encode(`event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

describe('Claude client', () => {
  it('sends the browser-direct headers, model and facts; streams text deltas', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return sse([
        { type: 'message_start', message: {} },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
        { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '醫學中心 ' } },
        { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '**11.5%**' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' },
      ]);
    }) as unknown as typeof fetch;
    const parts: string[] = [];
    const out = await streamClaude({ apiKey: 'sk-ant-test', locale: 'zh-TW', question: 'CRKP?', offline, history: [], onText: (t) => parts.push(t), fetchImpl });
    expect(out.text).toBe('醫學中心 **11.5%**');
    expect(parts).toHaveLength(2);
    expect(out.stopReason).toBe('end_turn');
    expect(seen!.url).toBe(ANTHROPIC_URL);
    const h = seen!.init.headers as Record<string, string>;
    expect(h['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(h['x-api-key']).toBe('sk-ant-test');
    const body = JSON.parse(String(seen!.init.body));
    expect(body.model).toBe(CLAUDE_MODEL);
    expect(body.stream).toBe(true);
    expect(JSON.stringify(body.system)).toContain('2024 11.5%');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'CRKP?' });
  });

  it('maps HTTP errors to friendly kinds', async () => {
    const fail = (status: number, type: string) =>
      (async () => new Response(JSON.stringify({ type: 'error', error: { type, message: 'nope' } }), { status })) as unknown as typeof fetch;
    await expect(streamClaude({ apiKey: 'k', locale: 'en', question: 'q', offline, history: [], onText: () => {}, fetchImpl: fail(401, 'authentication_error') })).rejects.toMatchObject({ kind: 'auth' });
    await expect(streamClaude({ apiKey: 'k', locale: 'en', question: 'q', offline, history: [], onText: () => {}, fetchImpl: fail(429, 'rate_limit_error') })).rejects.toMatchObject({ kind: 'rateLimit' });
    const net = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(streamClaude({ apiKey: 'k', locale: 'en', question: 'q', offline, history: [], onText: () => {}, fetchImpl: net })).rejects.toBeInstanceOf(ClaudeError);
    expect(classify(529)).toBe('overloaded');
    expect(classify(400)).toBe('badRequest');
  });

  it('keeps history alternating and user-first', () => {
    expect(
      trimHistory([
        { role: 'assistant', content: 'welcome' },
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'assistant', content: 'c' },
      ]),
    ).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });

  it('context block names the answer language and forbids invented figures via facts', () => {
    const c = buildContextBlock('ja', offline);
    expect(c).toContain('Japanese');
    expect(c).toContain('Resolved data facts');
  });
});
