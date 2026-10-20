import { describe, expect, it } from 'vitest';
import { facebookIntent, lineIntent, threadsIntent, xIntent } from './intents';

const target = {
  url: 'https://ancientsky.github.io/tw_amr_dashboard/#/resistance?pathogen=KPN&antibiotic=MEM',
  text: 'CRKP 抗藥性趨勢 — TW-AMR Watch',
  hashtags: ['AMR', 'Taiwan'],
};

describe('share intents', () => {
  it('encodes deep links (incl. hash + query) and localized text', () => {
    const x = new URL(xIntent(target));
    expect(x.hostname).toBe('x.com');
    expect(x.searchParams.get('url')).toBe(target.url);
    expect(x.searchParams.get('text')).toBe(target.text);
    expect(x.searchParams.get('hashtags')).toBe('AMR,Taiwan');
    expect(new URL(facebookIntent(target)).searchParams.get('u')).toBe(target.url);
    expect(new URL(threadsIntent(target)).searchParams.get('text')).toContain(target.url);
    const line = new URL(lineIntent(target));
    expect(line.searchParams.get('url')).toBe(target.url);
    expect(line.searchParams.get('text')).toBe(target.text);
  });
});
