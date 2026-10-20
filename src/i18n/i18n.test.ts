import { describe, expect, it } from 'vitest';
import en from './en.json';
import ja from './ja.json';
import zhTW from './zh-TW.json';
import { translate, translateLocalized } from './index';

function flat(d: Record<string, unknown>, p = ''): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v && typeof v === 'object') Object.assign(o, flat(v as Record<string, unknown>, `${p}${k}.`));
    else o[p + k] = String(v);
  }
  return o;
}

describe('i18n', () => {
  it('all dictionaries share the same keys', () => {
    const k = (d: Record<string, unknown>) => Object.keys(flat(d)).sort();
    expect(k(zhTW)).toEqual(k(en));
    expect(k(ja)).toEqual(k(en));
  });
  it('no empty strings and ja/zh are not copies of en', () => {
    const e = flat(en);
    for (const d of [zhTW, ja]) {
      const f = flat(d);
      expect(Object.values(f).every((v) => v.trim().length > 0)).toBe(true);
      const same = Object.keys(f).filter((key) => f[key] === e[key] && /[a-z]{4,}/.test(e[key]));
      // brand names / language names may legitimately match
      expect(same.length).toBeLessThan(25);
    }
  });
  it('falls back locale → en → key and interpolates', () => {
    expect(translate('zh-TW', 'nav.overview')).toBe('總覽');
    expect(translate('ja', 'kpi.vsPrev', { year: 2023 })).toBe('2023年比');
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
    expect(translateLocalized({ 'zh-TW': '甲', en: 'A', ja: '' }, 'ja')).toBe('A');
  });
});
