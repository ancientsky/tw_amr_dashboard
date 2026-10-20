import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Select,
  Skeleton,
  Tabs,
  type SelectOption,
} from '../../components/ui';
import { dimName } from '../../data/format';
import { useOptionalDataset } from '../../data/load';
import { useT } from '../../i18n';
import { API_BASE, buildSnippets, formatBytes, resolvePath, type ApiEndpoint } from './api';
import { LOCAL_API, useApiCatalog } from './catalog';
import { CodeBlock, useCopy } from './CodeBlock';
import { JsonTree } from './JsonTree';
import s from './dataApi.module.css';

type Lang = 'curl' | 'js' | 'python' | 'r';
type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ok';
      status: number;
      ms: number;
      bytes: number;
      kind: ApiEndpoint['kind'];
      json?: unknown;
      text?: string;
    };

const GROUP_ORDER = [
  '',
  'meta',
  'resistance',
  'isolates',
  'antibiotic_use',
  'hai',
  'hai_pathogens',
  'glass',
  'links',
  'glossary',
  'kb',
];

function groupOf(ep: ApiEndpoint): string {
  if (ep.tag) return ep.tag;
  return ep.path.startsWith('/schema') ? 'schema' : ep.path.startsWith('/openapi') ? 'spec' : 'index';
}

/** Which dataset's dims label a path parameter. */
function labelSource(param: string): 'resistance' | 'glass' | null {
  if (param === 'pathogen' || param === 'phenotype') return 'resistance';
  if (param === 'indicator' || param === 'country') return 'glass';
  return null;
}

export function ApiExplorer() {
  const t = useT();
  const copy = useCopy();
  const { status, catalog, retry } = useApiCatalog();
  const { endpoints, spec } = catalog;

  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<string>('/resistance/phenotype/{phenotype}.json');
  const [values, setValues] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<Lang>('curl');
  const [result, setResult] = useState<Result>({ state: 'idle' });
  const abort = useRef<AbortController | null>(null);

  const current = endpoints.find((e) => e.path === sel) ?? endpoints[0];

  // default param values when the endpoint changes
  useEffect(() => {
    if (!current) return;
    setValues((v) => {
      const next: Record<string, string> = { ...v };
      for (const p of current.params) {
        if (!p.values.includes(next[p.name] ?? '')) {
          const pref =
            p.name === 'year'
              ? String(Math.max(...p.values.map(Number)))
              : p.name === 'country'
                ? 'TWN'
                : p.name === 'phenotype'
                  ? 'CRKP'
                  : p.name === 'pathogen'
                    ? 'KPN'
                    : p.values[0];
          next[p.name] = p.values.includes(pref) ? pref : p.values[0];
        }
      }
      return next;
    });
    setResult({ state: 'idle' });
  }, [current]);

  const needsRes = current?.params.some((p) => labelSource(p.name) === 'resistance');
  const needsGlass = current?.params.some((p) => labelSource(p.name) === 'glass');
  const res = useOptionalDataset(needsRes ? 'resistance' : null);
  const gl = useOptionalDataset(needsGlass ? 'glass' : null);

  const optionsFor = (pName: string, vals: string[]): SelectOption[] => {
    const src = labelSource(pName);
    const dimKey =
      pName === 'pathogen'
        ? 'pathogens'
        : pName === 'phenotype'
          ? 'phenotypes'
          : pName === 'indicator'
            ? 'indicators'
            : pName === 'country'
              ? 'countries'
              : '';
    const dims =
      src === 'resistance' ? res.data?.dims?.[dimKey] : src === 'glass' ? gl.data?.dims?.[dimKey] : undefined;
    return vals.map((v) => {
      const nm = dims ? dimName(dims, v, t.locale) : v;
      return { value: v, label: nm && nm !== v ? `${v} · ${nm}` : v };
    });
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((e) => `${e.path} ${e.summary} ${e.tag}`.toLowerCase().includes(q));
  }, [endpoints, filter]);

  const groups = useMemo(() => {
    const m = new Map<string, ApiEndpoint[]>();
    for (const e of filtered) {
      const g = groupOf(e);
      m.set(g, [...(m.get(g) ?? []), e]);
    }
    const order = (g: string) => {
      const i = GROUP_ORDER.indexOf(g === 'index' ? '' : g);
      return i < 0 ? 99 : i;
    };
    return [...m.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  }, [filtered]);

  const relPath = current ? resolvePath(current.path, values) : '';
  const missing = relPath.includes('{');
  const absUrl = `${API_BASE}${relPath}`;
  const snippets = current ? buildSnippets(absUrl, current.kind) : null;

  const run = async () => {
    if (!current || missing) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setResult({ state: 'loading' });
    const t0 = performance.now();
    try {
      const r = await fetch(`${LOCAL_API}${relPath}`, { signal: ac.signal });
      const text = await r.text();
      const ms = Math.round(performance.now() - t0);
      if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) {
        setResult({ state: 'error', message: `HTTP ${r.ok ? 404 : r.status}` });
        return;
      }
      let json: unknown;
      if (current.kind === 'json' || current.kind === 'schema') {
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
      }
      setResult({
        state: 'ok',
        status: r.status,
        ms,
        bytes: new TextEncoder().encode(text).length,
        kind: current.kind,
        json,
        text: json === undefined ? text.split('\n').slice(0, 24).join('\n') : undefined,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setResult({ state: 'error', message: (e as Error).message });
    }
  };

  useEffect(() => () => abort.current?.abort(), []);

  const title = spec?.title || 'TW-AMR Watch API';

  if (status === 'loading') return <Skeleton height={420} radius={16} />;
  if (status === 'error' || !current)
    return (
      <EmptyState
        icon="alert"
        title={t('common.error')}
        body={t('common.errorBody')}
        action={
          <Button onClick={retry} icon="send">
            {t('actions.retry')}
          </Button>
        }
      />
    );

  const label = (e: ApiEndpoint) => (e.summary ? e.summary : e.path);

  return (
    <div className={s.stack}>
      <div className={s.apiMeta}>
        <Badge tone="accent">{spec?.version ? `${t('data.api.version')} ${spec.version}` : 'v1'}</Badge>
        <Badge tone="info">OpenAPI 3.1</Badge>
        <span className={s.apiTitle}>{title}</span>
        <code className={s.baseUrl}>{API_BASE}</code>
        <button
          type="button"
          className={s.iconLink}
          onClick={() => copy(API_BASE)}
          aria-label={t('data.dl.copyUrl')}
          title={t('data.dl.copyUrl')}
        >
          <Icon name="copy" size={14} />
        </button>
        <a className={s.specLink} href={`${LOCAL_API}/openapi.yaml`} target="_blank" rel="noopener">
          openapi.yaml <Icon name="external" size={12} />
        </a>
      </div>

      <div className={s.explorer}>
        <nav className={s.epList} aria-label={t('data.api.endpoints')}>
          <div className={s.epSearch}>
            <Icon name="search" size={16} />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('data.api.filter')}
              aria-label={t('data.api.filter')}
              className={s.epInput}
            />
          </div>
          <div className={s.epScroll}>
            {groups.length === 0 && <p className={s.muted}>{t('common.empty')}</p>}
            {groups.map(([g, list]) => (
              <div key={g} className={s.epGroup}>
                <div className={s.epGroupName}>{t(`data.api.groups.${g}`)}</div>
                {list.map((e) => (
                  <button
                    key={e.path}
                    type="button"
                    className={[s.ep, e.path === current.path ? s.epActive : ''].join(' ')}
                    aria-current={e.path === current.path ? 'true' : undefined}
                    onClick={() => setSel(e.path)}
                    title={label(e)}
                  >
                    <span className={s.epVerb}>GET</span>
                    <span className={s.epPath}>{e.path}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <div className={s.tryPanel}>
          <div className={s.tryHead}>
            <div className={s.tryTitle}>
              <span className={s.epVerb}>GET</span>
              <code className={s.tryPath}>{current.path}</code>
            </div>
            <p className={s.trySummary}>{current.summary || t('data.api.noSummary')}</p>
          </div>

          {current.params.length > 0 && (
            <div className={s.params}>
              {current.params.map((p) => (
                <Select
                  key={p.name}
                  label={t(`data.api.param.${p.name}`)}
                  showLabel
                  options={optionsFor(p.name, p.values)}
                  value={values[p.name] ?? p.values[0]}
                  onChange={(v) => setValues((m) => ({ ...m, [p.name]: v }))}
                  minWidth={180}
                />
              ))}
            </div>
          )}

          <div className={s.urlBar}>
            <code className={s.urlText} title={absUrl}>
              {absUrl}
            </code>
            <Button
              variant="primary"
              icon="send"
              onClick={run}
              disabled={missing || result.state === 'loading'}
            >
              {result.state === 'loading' ? t('common.loading') : t('data.api.tryIt')}
            </Button>
            <Button icon="copy" onClick={() => copy(absUrl)}>
              {t('actions.copy')}
            </Button>
          </div>

          <div className={s.response} aria-live="polite">
            {result.state === 'idle' && <p className={s.muted}>{t('data.api.idle')}</p>}
            {result.state === 'loading' && <Skeleton height={160} radius={12} />}
            {result.state === 'error' && (
              <p className={s.errorText} role="alert">
                {t('common.error')}: {result.message}
              </p>
            )}
            {result.state === 'ok' && (
              <>
                <div className={s.respStats}>
                  <Badge tone="accent" dot>
                    {result.status} OK
                  </Badge>
                  <span>{formatBytes(result.bytes, t.locale)}</span>
                  <span>{result.ms} ms</span>
                  {result.json !== undefined &&
                    typeof result.json === 'object' &&
                    (result.json as { provisional?: boolean }).provisional === true && (
                      <Badge tone="warn">{t('provisional.chip')}</Badge>
                    )}
                  <span className={s.muted}>{t('data.api.first50')}</span>
                </div>
                {result.json !== undefined ? (
                  <JsonTree value={result.json} />
                ) : (
                  <pre className={s.pre} tabIndex={0}>
                    <code>{result.text}</code>
                  </pre>
                )}
              </>
            )}
          </div>

          {snippets && (
            <div className={s.snippets}>
              <Tabs
                label={t('data.api.snippets')}
                value={lang}
                onChange={setLang}
                idBase="api-snip"
                items={[
                  { value: 'curl', label: 'curl' },
                  { value: 'js', label: 'JavaScript' },
                  { value: 'python', label: 'Python' },
                  { value: 'r', label: 'R' },
                ]}
              />
              <div role="tabpanel" id={`api-snip-panel-${lang}`} aria-labelledby={`api-snip-tab-${lang}`}>
                <CodeBlock code={snippets[lang]} label={`${lang} ${t('data.api.snippets')}`} />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className={s.endpointCount}>{t('data.api.count', { n: endpoints.length })}</p>
    </div>
  );
}
