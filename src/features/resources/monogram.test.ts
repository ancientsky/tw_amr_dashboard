import { describe, expect, it } from 'vitest';
import { hueFor, monogram } from './monogram';

describe('monogram', () => {
  it('uses acronyms as-is and initials otherwise', () => {
    expect(monogram('WHO')).toBe('WHO');
    expect(monogram('ECDC')).toBe('ECDC');
    expect(monogram('CDC (US)')).toBe('CDC');
    expect(monogram('WHO / FAO / WOAH / UNEP')).toBe('WHO');
    expect(monogram('Public Health Agency of Canada')).toBe('PH');
    expect(monogram('Taiwan CDC / data.gov.tw')).toBe('TC');
    expect(monogram('One Health Trust')).toBe('OH');
  });
  it('hue is deterministic and in range', () => {
    expect(hueFor('WHO')).toBe(hueFor('WHO'));
    expect(hueFor('abc')).toBeGreaterThanOrEqual(0);
    expect(hueFor('abc')).toBeLessThan(360);
  });
});
