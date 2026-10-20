import { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { deepLink, type QueryPatch } from '../url';

/**
 * Read / write query params inside the hash route (HashRouter):
 *   #/resistance?pathogen=ABA&antibiotic=MEM&years=2017-2024
 *
 *   const q = useHashQuery();
 *   q.get('pathogen')              // 'ABA' | null
 *   q.set({ pathogen: 'KPN' })      // merge-patch; null/'' removes a key; replace history by default
 *   q.link()                       // absolute deep link to the current view (for copy/share)
 */
export function useHashQuery() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();

  const get = useCallback((key: string): string | null => params.get(key), [params]);
  const getAll = useCallback((key: string): string[] => params.getAll(key), [params]);

  const set = useCallback(
    (patch: QueryPatch, opts: { replace?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '' || v === false) next.delete(k);
            else next.set(k, v === true ? '1' : String(v));
          }
          return next;
        },
        { replace: opts.replace ?? true },
      );
    },
    [setParams],
  );

  const link = useCallback(
    (extra: QueryPatch = {}) => {
      const merged = new URLSearchParams(params);
      for (const [k, v] of Object.entries(extra)) {
        if (v === null || v === undefined || v === '' || v === false) merged.delete(k);
        else merged.set(k, String(v));
      }
      return deepLink(location.pathname, merged);
    },
    [params, location.pathname],
  );

  return useMemo(
    () => ({ params, get, getAll, set, link, path: location.pathname }),
    [params, get, getAll, set, link, location.pathname],
  );
}

/** Single typed param with default: const [pathogen, setPathogen] = useQueryParam('pathogen', 'KPN') */
export function useQueryParam<T extends string = string>(
  key: string,
  fallback: T,
  allowed?: readonly T[],
): [T, (v: T | null) => void] {
  const q = useHashQuery();
  const raw = q.get(key) as T | null;
  const value = raw !== null && (!allowed || allowed.includes(raw)) ? raw : fallback;
  const setValue = useCallback((v: T | null) => q.set({ [key]: v === fallback ? null : v }), [q, key, fallback]);
  return [value, setValue];
}
