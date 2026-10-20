import { useEffect, useState } from 'react';
import type { DatasetMap, DatasetName } from './types';

/**
 * Runtime loader for public/data/<name>.json (canonical datasets, §4).
 *
 * - One cached promise per dataset (shared by every component and the embed).
 * - Graceful states: 'loading' | 'ready' | 'empty' | 'error'.
 * - Fixture fallback: in dev (or when VITE_FIXTURE_FALLBACK=1, or when the caller
 *   passes { fixtureFallback: true } — the embed does this) a missing dataset falls
 *   back to src/data/fixtures/<name>.json so the UI is never blank while the
 *   pipeline has not produced files yet. Fixture data is flagged `isFixture`.
 */

export type DatasetStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface DatasetState<N extends DatasetName> {
  status: DatasetStatus;
  data: DatasetMap[N] | null;
  error: Error | null;
  /** true when the data came from the bundled dev fixture, not public/data */
  isFixture: boolean;
}

export interface LoadOptions {
  fixtureFallback?: boolean;
}

interface Loaded<N extends DatasetName> {
  data: DatasetMap[N];
  isFixture: boolean;
}

const cache = new Map<string, Promise<Loaded<DatasetName>>>();
const settled = new Map<string, Loaded<DatasetName>>();

const fixtureModules = import.meta.glob<{ default: unknown }>('./fixtures/*.json');

const envFallback = import.meta.env.DEV || import.meta.env.VITE_FIXTURE_FALLBACK === '1';

export function datasetUrl(name: DatasetName): string {
  return `${import.meta.env.BASE_URL}data/${name}.json`;
}

export function hasFixture(name: DatasetName): boolean {
  return `./fixtures/${name}.json` in fixtureModules;
}

async function loadFixture<N extends DatasetName>(name: N): Promise<DatasetMap[N]> {
  const mod = fixtureModules[`./fixtures/${name}.json`];
  if (!mod) throw new Error(`No fixture for dataset "${name}"`);
  const m = await mod();
  return m.default as DatasetMap[N];
}

async function fetchJson<N extends DatasetName>(name: N, signal?: AbortSignal): Promise<DatasetMap[N]> {
  const res = await fetch(datasetUrl(name), { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${name}.json`);
  const type = res.headers.get('content-type') ?? '';
  // Vite dev server answers unknown paths with index.html — treat as missing.
  if (type.includes('text/html')) throw new Error(`${name}.json not found`);
  return (await res.json()) as DatasetMap[N];
}

/** Load (and cache) a dataset. Rejects only if both network and fixture fail. */
export function loadDataset<N extends DatasetName>(name: N, opts: LoadOptions = {}): Promise<Loaded<N>> {
  const useFallback = opts.fixtureFallback ?? envFallback;
  const key = `${name}|${useFallback ? 'fb' : 'net'}`;
  const hit = cache.get(key);
  if (hit) return hit as Promise<Loaded<N>>;
  const p = (async (): Promise<Loaded<N>> => {
    try {
      const data = await fetchJson(name);
      return { data, isFixture: false };
    } catch (err) {
      if (useFallback && hasFixture(name)) {
        const data = await loadFixture(name);
        return { data, isFixture: true };
      }
      throw err;
    }
  })();
  cache.set(key, p as Promise<Loaded<DatasetName>>);
  p.then(
    (v) => settled.set(key, v as Loaded<DatasetName>),
    () => cache.delete(key), // allow retry after failure
  );
  return p;
}

/** Synchronous peek at an already-loaded dataset (no fetch). */
export function peekDataset<N extends DatasetName>(name: N, opts: LoadOptions = {}): Loaded<N> | undefined {
  const useFallback = opts.fixtureFallback ?? envFallback;
  return settled.get(`${name}|${useFallback ? 'fb' : 'net'}`) as Loaded<N> | undefined;
}

/** Clears the cache (tests / manual refresh). */
export function clearDatasetCache(): void {
  cache.clear();
  settled.clear();
}

function isEmpty(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true;
  const recs = (data as { records?: unknown[] }).records;
  return Array.isArray(recs) ? recs.length === 0 : false;
}

/**
 * React hook: `const { status, data, error, isFixture } = useDataset('resistance')`.
 * Re-renders once when the cached promise settles; subsequent mounts are synchronous.
 */
export function useDataset<N extends DatasetName>(name: N, opts: LoadOptions = {}): DatasetState<N> {
  const fixtureFallback = opts.fixtureFallback;
  const initial = (): DatasetState<N> => {
    const hit = peekDataset(name, { fixtureFallback });
    if (hit)
      return {
        status: isEmpty(hit.data) ? 'empty' : 'ready',
        data: hit.data,
        error: null,
        isFixture: hit.isFixture,
      };
    return { status: 'loading', data: null, error: null, isFixture: false };
  };
  const [state, setState] = useState<DatasetState<N>>(initial);

  useEffect(() => {
    let alive = true;
    const hit = peekDataset(name, { fixtureFallback });
    if (hit) {
      setState({ status: isEmpty(hit.data) ? 'empty' : 'ready', data: hit.data, error: null, isFixture: hit.isFixture });
      return;
    }
    setState((s) => (s.status === 'loading' ? s : { ...s, status: 'loading' }));
    loadDataset(name, { fixtureFallback }).then(
      (v) => {
        if (!alive) return;
        setState({ status: isEmpty(v.data) ? 'empty' : 'ready', data: v.data, error: null, isFixture: v.isFixture });
      },
      (err: unknown) => {
        if (!alive) return;
        setState({
          status: 'error',
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
          isFixture: false,
        });
      },
    );
    return () => {
      alive = false;
    };
  }, [name, fixtureFallback]);

  return state;
}
