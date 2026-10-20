import { useEffect, useState } from 'react';
import { endpointsFromIndex, parseOpenApi, type ApiEndpoint, type ApiIndex, type ParsedOpenApi } from './api';

/** Same-origin API root (works in dev, preview and on Pages). */
export const LOCAL_API = `${import.meta.env.BASE_URL}api/v1`;

export interface Catalog {
  index: ApiIndex | null;
  spec: ParsedOpenApi | null;
  endpoints: ApiEndpoint[];
}

type State = { status: 'loading' | 'ready' | 'error'; catalog: Catalog; error?: string };

let cached: Promise<Catalog> | null = null;

async function getText(url: string, accept: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: accept } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('text/html')) throw new Error('not found');
  return res.text();
}

export function loadCatalog(): Promise<Catalog> {
  if (cached) return cached;
  cached = (async () => {
    const [idx, yaml] = await Promise.allSettled([
      getText(`${LOCAL_API}/index.json`, 'application/json').then((x) => JSON.parse(x) as ApiIndex),
      getText(`${LOCAL_API}/openapi.yaml`, 'text/yaml, text/plain'),
    ]);
    const index = idx.status === 'fulfilled' ? idx.value : null;
    let spec: ParsedOpenApi | null = null;
    if (yaml.status === 'fulfilled') {
      try {
        spec = parseOpenApi(yaml.value);
        if (!spec.endpoints.length) spec = null;
      } catch {
        spec = null;
      }
    }
    if (!index && !spec) throw new Error('api catalogue unavailable');
    const endpoints = spec?.endpoints ?? endpointsFromIndex(index!);
    return { index, spec, endpoints };
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

const EMPTY: Catalog = { index: null, spec: null, endpoints: [] };

/** Loads api/v1/index.json + openapi.yaml once for the whole page. */
export function useApiCatalog(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: 'loading', catalog: EMPTY });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading', catalog: EMPTY }));
    loadCatalog().then(
      (catalog) => alive && setState({ status: 'ready', catalog }),
      (e: unknown) =>
        alive &&
        setState({ status: 'error', catalog: EMPTY, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [nonce]);
  return { ...state, retry: () => setNonce((n) => n + 1) };
}
