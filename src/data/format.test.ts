import { describe, expect, it } from 'vitest';
import { dimName, fmtDelta, fmtNumber, fmtPct, localized, slugify, toCsv } from './format';

describe('format', () => {
  it('formats percents and numbers', () => {
    expect(fmtPct(41.234)).toBe('41.2%');
    expect(fmtPct(null)).toBe('—');
    expect(fmtNumber(12840)).toBe('12,840');
    expect(fmtNumber(12840, 'en', { compact: true })).toBe('12.8K');
    expect(fmtDelta(2.14)).toBe('+2.1');
    expect(fmtDelta(-0.44)).toBe('−0.4');
    expect(fmtDelta(0)).toBe('±0.0');
  });
  it('localizes dims with fallback', () => {
    const dims = [{ code: 'KPN', name: { 'zh-TW': '克雷伯氏肺炎桿菌', en: 'K. pneumoniae', ja: '肺炎桿菌' } }];
    expect(dimName(dims, 'KPN', 'zh-TW')).toBe('克雷伯氏肺炎桿菌');
    expect(dimName(dims, 'KPN', 'ja')).toBe('肺炎桿菌');
    expect(dimName(dims, 'XXX', 'en')).toBe('XXX');
    expect(localized({ 'zh-TW': '中', en: '', ja: '' }, 'ja')).toBe('中');
  });
  it('slugifies and encodes CSV', () => {
    expect(slugify('Resistance trend: KPN × MEM')).toBe('resistance-trend-kpn-mem');
    expect(slugify('抗藥性 趨勢')).toBe('抗藥性-趨勢');
    expect(toCsv([{ a: 1, b: 'x,y' }, { a: null, b: 'q"z' }])).toBe('a,b\r\n1,"x,y"\r\n,"q""z"');
  });
});
