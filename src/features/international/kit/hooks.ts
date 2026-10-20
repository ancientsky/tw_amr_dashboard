import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHashQuery } from '../../../app/hooks/useHashQuery';
import { clampYearRange, formatYearRange, parseYearRange, type YearRange } from '../../../data/select';

/**
 * Shared hooks for the international / antibiotic-use / HAI pages (owned by the
 * same feature agent). Kept free of page-specific logic.
 */

/** Comma-separated list param (`countries=JPN,KOR`). Unknown codes are dropped; empty → fallback. */
export function useListParam(
  key: string,
  allowed: readonly string[] | undefined,
  fallback: readonly string[],
): [string[], (v: readonly string[] | null) => void] {
  const q = useHashQuery();
  const raw = q.get(key);
  const value = useMemo(() => {
    if (raw === null) return [...fallback];
    if (raw === '' || raw === 'none') return [];
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = allowed ? list.filter((c) => allowed.includes(c)) : list;
    return [...new Set(ok)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, allowed, fallback.join(',')]);
  const set = useCallback(
    (v: readonly string[] | null) => {
      if (v === null) return q.set({ [key]: null });
      const same = v.length === fallback.length && v.every((x, i) => x === fallback[i]);
      q.set({ [key]: same ? null : v.length ? v.join(',') : 'none' });
    },
    [q, key, fallback],
  );
  return [value, set];
}

/** `years=2017-2024` param clamped to the dataset's bounds. */
export function useYearRangeParam(
  key: string,
  bounds: YearRange | undefined,
): [YearRange | undefined, (v: YearRange) => void] {
  const q = useHashQuery();
  const raw = q.get(key);
  const value = useMemo(() => {
    if (!bounds) return undefined;
    const p = parseYearRange(raw);
    return p ? clampYearRange(p, bounds) : bounds;
  }, [raw, bounds]);
  const set = useCallback(
    (v: YearRange) => {
      const full = bounds && v[0] === bounds[0] && v[1] === bounds[1];
      q.set({ [key]: full ? null : formatYearRange(v) });
    },
    [q, key, bounds],
  );
  return [value, set];
}

/** True below the given viewport width (re-renders on change). */
export function useNarrow(maxWidth = 640): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const fn = () => setNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return narrow;
}
