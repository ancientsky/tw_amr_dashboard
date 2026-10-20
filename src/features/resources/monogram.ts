const STOP = new Set(['of', 'the', 'for', 'and', 'on', 'de', 'des', 'du', 'la', 'le', 'a', 'in']);

/** First segment of an organisation string: "WHO / FAO" → "WHO", "CDC (US)" → "CDC". */
function head(org: string): string {
  return org.split(/\s\/\s|\s\(|,/)[0].trim() || org.trim();
}

/** 1–4 letter monogram for an organisation name ("WHO", "ECDC", "Public Health Agency of Canada" → "PH"). */
export function monogram(org: string): string {
  const h = head(org);
  const tokens = h.split(/[\s-]+/).filter(Boolean);
  if (!tokens.length) return '?';
  const first = tokens[0].replace(/[^A-Za-z0-9]/g, '');
  if (first.length >= 2 && first === first.toUpperCase() && /[A-Z]/.test(first))
    return first.slice(0, first.length <= 4 ? first.length : 3);
  const letters = tokens
    .filter((x) => !STOP.has(x.toLowerCase()))
    .map((x) => x.replace(/[^\p{L}\p{N}]/gu, '')[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  return (letters || h.slice(0, 2)).toUpperCase();
}

/** Deterministic hue (0–359) from a string, snapped to 24° steps so neighbours differ visibly. */
export function hueFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 15) * 24;
}
