/**
 * Chart colour system (docs/ARCHITECTURE.md §5), validated with the dataviz skill's
 * palette validator (OKLab ΔE, Machado-2009 CVD simulation).
 *
 * The contract's 8 hue anchors (`CONTRACT_HUES`) failed the validator as-given
 * (amber outside the lightness band; olive↔ochre adjacent ΔE 2.2 under protanopia;
 * several fills < 3:1 on white). Per the snap-to-passing procedure we keep the
 * same eight hue families but re-step lightness per theme and re-order them so
 * adjacent slots stay separable. Results (adjacent pairs):
 *   light vs #ffffff : CVD ΔE 13.2, normal ΔE 20.7, all ≥ 3:1 contrast — PASS
 *   dark  vs #0e1512 : CVD ΔE  9.0, normal ΔE 20.8, all ≥ 3:1 contrast — PASS
 * For scatter / map / small-multiples (all-pairs), use at most the first 3 slots.
 */
import type { ThemeName } from '../../styles/tokens';

/** Contract hue anchors, kept for reference / documentation. */
export const CONTRACT_HUES = ['#00b37e', '#2f81f7', '#f2a93b', '#e05d6f', '#8b6cf6', '#17b8c6', '#c08c3a', '#7a9a01'] as const;

/** Slot order: jade, blue, amber, violet, ochre, teal, rose, olive. */
export const CATEGORICAL: Record<ThemeName, readonly string[]> = {
  light: ['#01835b', '#3082f8', '#b07400', '#7d5ce5', '#a36f08', '#0698a4', '#ac2c45', '#759403'],
  dark: ['#0f976b', '#4690fd', '#b97a09', '#8262ec', '#bc872f', '#13a5b2', '#cf4d61', '#80a114'],
};

/** De-emphasis / "Other" colour for context series. */
export const MUTED: Record<ThemeName, string> = { light: '#a3b0aa', dark: '#3d5248' };

/** Sequential resistance scale 0→50→100 % (semantic heat: green→amber→red). Dark = +0.08 OKLCH L. */
export const RESISTANCE_STOPS: Record<ThemeName, readonly [string, string, string]> = {
  light: ['#1a9c6b', '#f2c14e', '#d43d51'],
  dark: ['#3fb583', '#ffdf9a', '#f15968'],
};

/** Reserved status colours — only when a value *means* good/bad, always with icon + label. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

export function categorical(theme: ThemeName = 'light'): readonly string[] {
  return CATEGORICAL[theme];
}

/** Colour for slot i. Never cycles: index ≥ 8 returns the muted "Other" colour. */
export function seriesColor(i: number, theme: ThemeName = 'light'): string {
  return i >= 0 && i < 8 ? CATEGORICAL[theme][i] : MUTED[theme];
}

/**
 * Stable entity → colour mapping (colour follows the entity, not its rank).
 * Pass the full canonical order of keys (e.g. dim order); filtering keeps hues.
 */
export function colorMap(allKeys: readonly string[], theme: ThemeName = 'light'): (key: string) => string {
  const idx = new Map(allKeys.map((k, i) => [k, i]));
  return (key) => seriesColor(idx.get(key) ?? 99, theme);
}

/** Fixed colour slots for common strata so every chart agrees. */
export const WARD_ORDER = ['all', 'icu', 'non_icu'] as const;
export const LEVEL_ORDER = ['all', 'medical_center', 'regional', 'district'] as const;
export const SETTING_ORDER = ['all', 'co', 'ho'] as const;

/* ---------- colour math ---------- */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: [number, number, number]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => fromLin(Math.max(0, Math.min(1, v))) * 255) as [number, number, number];
  return rgbToHex(rgb);
}

/** Perceptual (OKLab) interpolation between two hex colours. */
export function mix(a: string, b: string, t: number): string {
  const x = toOklab(a);
  const y = toOklab(b);
  const k = Math.max(0, Math.min(1, t));
  return fromOklab([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

/** Colour for a resistance percentage on the green→amber→red scale (0–100, clamped). */
export function resistanceColor(pct: number | null | undefined, theme: ThemeName = 'light'): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return MUTED[theme];
  const [lo, mid, hi] = RESISTANCE_STOPS[theme];
  const p = Math.max(0, Math.min(100, pct));
  return p <= 50 ? mix(lo, mid, p / 50) : mix(mid, hi, (p - 50) / 50);
}

/** N evenly spaced stops of the resistance scale (for ECharts visualMap inRange.color). */
export function resistanceRamp(n = 7, theme: ThemeName = 'light'): string[] {
  return Array.from({ length: n }, (_, i) => resistanceColor((i / (n - 1)) * 100, theme));
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => toLin(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Legible label colour (near-black ink or white) for text placed inside a filled mark. */
export function textOn(fill: string): string {
  return contrastRatio(fill, '#0f1a16') >= contrastRatio(fill, '#ffffff') ? '#0f1a16' : '#ffffff';
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
