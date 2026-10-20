import { it } from 'vitest';
import { answerQuestion } from '../answer';
import { DATA } from './fixtures';
const QS: [string, 'zh-TW'|'en'|'ja'][] = (process.env.QS ?? '').split('||').filter(Boolean).map((s) => { const [l, q] = s.split('::'); return [q, l as 'zh-TW']; });
it('probe', () => {
  for (const [q, l] of QS) {
    let dbg: unknown;
    const a = answerQuestion(q, { locale: l, data: DATA }, (d) => (dbg = d));
    const d = dbg as { intent: unknown; hits: { group: string; score: number; coverage: number }[] };
    console.log(`\n### [${l}] ${q}\nintent=${JSON.stringify(d.intent)}\nhits=${d.hits.slice(0,3).map(h=>`${h.group}:${h.score.toFixed(2)}/${h.coverage.toFixed(2)}`).join(' ')}\n${a.kind}: ${a.text}\nchart=${a.chart ? a.chart.kind + ' ' + a.chart.title + ' ' + JSON.stringify(a.chart.series.map(s=>s.data)) : '-'}\nlinks=${a.links.map(l=>l.href).join(' ')}\nchips=${a.chips.join(' | ')}`);
  }
});
