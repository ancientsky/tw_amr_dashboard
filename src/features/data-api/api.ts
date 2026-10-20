import { SITE_URL } from '../../app/url';

/** Production API base (absolute) — snippets always show this, never localhost. */
export const API_BASE = `${SITE_URL}api/v1`;

export interface ApiParam {
  name: string;
  in: string;
  values: string[];
}

export interface ApiEndpoint {
  /** OpenAPI path template, e.g. /resistance/pathogen/{pathogen}.json */
  path: string;
  summary: string;
  operationId: string;
  /** dataset tag from the spec ('' for catalogue / schema endpoints) */
  tag: string;
  params: ApiParam[];
  kind: 'json' | 'csv' | 'schema' | 'yaml';
}

export interface ParsedOpenApi {
  title: string;
  version: string;
  server: string;
  endpoints: ApiEndpoint[];
}

/** Subset of api/v1/index.json that we read. */
export interface IndexDataset {
  id: string;
  dataset: string;
  records: number;
  provisional: boolean;
  version: string;
  json: string;
  csv: string;
  schema: string;
  slices: { by: string; urlTemplate: string; values: (string | number)[] }[];
}

export interface ApiIndex {
  baseUrl: string;
  generatedAt: string;
  provisionalDatasets?: string[];
  datasets: IndexDataset[];
}

const unquote = (s: string): string => {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"'))
    return t.slice(1, -1).replace(/\\(["\\])/g, '$1');
  return t;
};

function kindOf(path: string): ApiEndpoint['kind'] {
  if (path.endsWith('.csv')) return 'csv';
  if (path.endsWith('.schema.json')) return 'schema';
  if (path.endsWith('.yaml')) return 'yaml';
  return 'json';
}

/**
 * Minimal, dependency-free reader for the generated openapi.yaml: it understands only the
 * shapes scripts/build_data.py emits (paths → get → summary / operationId / tags / parameters+enum).
 */
export function parseOpenApi(text: string): ParsedOpenApi {
  const out: ParsedOpenApi = { title: '', version: '', server: '', endpoints: [] };
  const lines = text.split(/\r?\n/);
  let ep: ApiEndpoint | null = null;
  let param: ApiParam | null = null;
  let mode: 'none' | 'tags' | 'params' | 'enum' | 'servers' = 'none';
  let inPaths = false;

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();

    if (indent === 0) {
      inPaths = line === 'paths:';
      mode = line === 'servers:' ? 'servers' : 'none';
      ep = null;
      param = null;
      continue;
    }
    if (!inPaths) {
      if (indent === 2 && line.startsWith('title:')) out.title = unquote(line.slice(6));
      else if (indent === 2 && line.startsWith('version:')) out.version = unquote(line.slice(8));
      else if (mode === 'servers' && line.startsWith('- url:')) out.server = unquote(line.slice(6));
      continue;
    }
    if (indent === 2) {
      const m = /^"?(\/[^"]*?)"?:\s*$/.exec(line);
      if (m) {
        ep = { path: m[1], summary: '', operationId: '', tag: '', params: [], kind: kindOf(m[1]) };
        out.endpoints.push(ep);
        param = null;
        mode = 'none';
      }
      continue;
    }
    if (!ep) continue;
    if (indent === 6) {
      if (line.startsWith('summary:')) ep.summary = unquote(line.slice(8));
      else if (line.startsWith('operationId:')) ep.operationId = unquote(line.slice(12));
      else if (line === 'tags:') mode = 'tags';
      else if (line === 'parameters:') mode = 'params';
      else if (line === 'responses:') mode = 'none';
      continue;
    }
    if (mode === 'tags' && indent === 8 && line.startsWith('- ')) {
      if (!ep.tag) ep.tag = unquote(line.slice(2));
      continue;
    }
    if (mode === 'params' || mode === 'enum') {
      if (indent === 8 && line.startsWith('- name:')) {
        param = { name: unquote(line.slice(7)), in: 'path', values: [] };
        ep.params.push(param);
        mode = 'params';
      } else if (param && indent === 10 && line.startsWith('in:')) {
        param.in = unquote(line.slice(3));
      } else if (param && line === 'enum:') {
        mode = 'enum';
      } else if (param && mode === 'enum' && line.startsWith('- ')) {
        param.values.push(unquote(line.slice(2)));
      }
    }
  }
  // an unquoted `200:` response key never becomes a path; drop anything that is not a real path
  out.endpoints = out.endpoints.filter((e) => e.path.startsWith('/'));
  return out;
}

/** Build the same endpoint list from index.json when openapi.yaml cannot be read. */
export function endpointsFromIndex(index: ApiIndex): ApiEndpoint[] {
  const base = index.baseUrl.replace(/\/$/, '');
  const rel = (u: string) => u.replace(base, '');
  const eps: ApiEndpoint[] = [
    { path: '/index.json', summary: '', operationId: 'getIndex', tag: '', params: [], kind: 'json' },
  ];
  for (const d of index.datasets) {
    eps.push({
      path: rel(d.json),
      summary: '',
      operationId: `get_${d.dataset}_json`,
      tag: d.dataset,
      params: [],
      kind: 'json',
    });
    eps.push({
      path: rel(d.csv),
      summary: '',
      operationId: `get_${d.dataset}_csv`,
      tag: d.dataset,
      params: [],
      kind: 'csv',
    });
    for (const sl of d.slices) {
      eps.push({
        path: rel(sl.urlTemplate),
        summary: '',
        operationId: `get_${d.dataset}_by_${sl.by}`,
        tag: d.dataset,
        params: [{ name: sl.by, in: 'path', values: sl.values.map(String) }],
        kind: 'json',
      });
    }
  }
  eps.push({
    path: '/schema/{name}.schema.json',
    summary: '',
    operationId: 'getSchema',
    tag: '',
    params: [{ name: 'name', in: 'path', values: [...index.datasets.map((d) => d.dataset), 'common'] }],
    kind: 'schema',
  });
  eps.push({
    path: '/openapi.yaml',
    summary: '',
    operationId: 'getOpenApi',
    tag: '',
    params: [],
    kind: 'yaml',
  });
  return eps;
}

/** Fill {param} placeholders. Missing values stay as the placeholder. */
export function resolvePath(path: string, values: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (m, k: string) => (values[k] ? encodeURIComponent(values[k]) : m));
}

export interface Snippets {
  curl: string;
  js: string;
  python: string;
  r: string;
}

/** Copy-paste snippets for one absolute URL. */
export function buildSnippets(url: string, kind: ApiEndpoint['kind']): Snippets {
  const file = url.split('/').pop() ?? 'data';
  if (kind === 'csv') {
    return {
      curl: `curl -sSLO "${url}"\n# or stream the first rows\ncurl -s "${url}" | head -n 5`,
      js: `const res = await fetch("${url}");\nif (!res.ok) throw new Error(res.status);\nconst csv = await res.text();\nconst [header, ...rows] = csv.trim().split("\\n");\nconsole.log(header, rows.length);`,
      python: `import pandas as pd\n\ndf = pd.read_csv("${url}")\nprint(df.head())`,
      r: `df <- read.csv("${url}", encoding = "UTF-8")\nhead(df)`,
    };
  }
  if (kind === 'yaml') {
    return {
      curl: `curl -sSL "${url}" -o ${file}`,
      js: `const spec = await (await fetch("${url}")).text();\nconsole.log(spec.slice(0, 300));`,
      python: `import requests\n\nspec = requests.get("${url}", timeout=30).text\nprint(spec[:300])`,
      r: `spec <- readLines("${url}", encoding = "UTF-8")\nhead(spec)`,
    };
  }
  return {
    curl: `curl -s "${url}" | jq '.records | length'`,
    js: `const res = await fetch("${url}");\nif (!res.ok) throw new Error(res.status);\nconst data = await res.json();\nconsole.log(data.provisional, data.records?.length);`,
    python: `import requests\n\nres = requests.get("${url}", timeout=30)\nres.raise_for_status()\ndata = res.json()\nprint(data.get("provisional"), len(data.get("records", [])))`,
    r: `library(httr2)\n\nresp <- request("${url}") |> req_perform()\ndata <- resp_body_json(resp, simplifyVector = TRUE)\nstr(data$records)`,
  };
}

export function formatBytes(n: number, locale: string): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: v >= 100 || i === 0 ? 0 : 1 }).format(v)} ${units[i]}`;
}
