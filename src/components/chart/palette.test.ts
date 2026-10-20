import { describe, expect, it } from 'vitest';
import { CATEGORICAL, colorMap, contrastRatio, mix, resistanceColor, resistanceRamp, seriesColor, textOn, MUTED } from './palette';

describe('palette', () => {
  it('has 8 slots per theme and never cycles', () => {
    expect(CATEGORICAL.light).toHaveLength(8);
    expect(CATEGORICAL.dark).toHaveLength(8);
    expect(seriesColor(8)).toBe(MUTED.light);
  });
  it('categorical marks clear 3:1 against the chart surface', () => {
    for (const c of CATEGORICAL.light) expect(contrastRatio(c, '#ffffff')).toBeGreaterThanOrEqual(3);
    for (const c of CATEGORICAL.dark) expect(contrastRatio(c, '#0e1512')).toBeGreaterThanOrEqual(3);
  });
  it('colour follows the entity', () => {
    const f = colorMap(['all', 'icu', 'non_icu']);
    expect(f('icu')).toBe(CATEGORICAL.light[1]);
    expect(f('zzz')).toBe(MUTED.light);
  });
  it('resistance scale hits the stops', () => {
    expect(resistanceColor(0)).toBe('#1a9c6b');
    expect(resistanceColor(50)).toBe('#f2c14e');
    expect(resistanceColor(100)).toBe('#d43d51');
    expect(resistanceColor(150)).toBe('#d43d51');
    expect(resistanceRamp(5)).toHaveLength(5);
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
  });
  it('picks legible label colours', () => {
    expect(textOn('#f2c14e')).toBe('#0f1a16');
    expect(textOn('#0e1512')).toBe('#ffffff');
  });
});
