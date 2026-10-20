/**
 * URL helpers for deep links, embeds and hash-query parsing (§6).
 * Router-agnostic: safe to use from the embed entry and from non-React code.
 */

export const SITE_URL = 'https://ancientsky.github.io/tw_amr_dashboard/';
export const REPO_URL = 'https://github.com/ancientsky/tw_amr_dashboard';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryPatch = Record<string, QueryValue>;

/** Absolute base of the running site (origin + Vite base), e.g. http://localhost:5173/tw_amr_dashboard/ */
export function siteBase(): string {
  if (typeof window === 'undefined') return SITE_URL;
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

/** Parse the query part of a hash route: '#/resistance?pathogen=ABA' → URLSearchParams */
export function parseHashQuery(hash: string = typeof window !== 'undefined' ? window.location.hash : ''): URLSearchParams {
  const i = hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? hash.slice(i + 1) : '');
}

/** Read the path part of a hash route: '#/resistance?x=1' → '/resistance' */
export function parseHashPath(hash: string = typeof window !== 'undefined' ? window.location.hash : ''): string {
  const h = hash.replace(/^#/, '');
  const i = h.indexOf('?');
  const p = i >= 0 ? h.slice(0, i) : h;
  return p || '/';
}

export function toSearch(params: QueryPatch | URLSearchParams): string {
  const sp = params instanceof URLSearchParams ? new URLSearchParams(params) : new URLSearchParams();
  if (!(params instanceof URLSearchParams)) {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined || v === '' || v === false) continue;
      sp.set(k, v === true ? '1' : String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Absolute deep link into the app: deepLink('/resistance', {pathogen:'ABA'}) */
export function deepLink(path: string, params: QueryPatch | URLSearchParams = {}): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${siteBase()}#${p}${toSearch(params)}`;
}

/** Absolute URL of the embed page for a chart id. */
export function embedUrl(chart: string, params: QueryPatch = {}): string {
  return `${siteBase()}embed.html#/${toSearch({ chart, ...params })}`;
}

/** `<script>` snippet hospitals paste into their pages (public/embed.js). */
export function embedSnippet(chart: string, params: QueryPatch = {}): string {
  const attrs = Object.entries({ chart, ...params } as QueryPatch)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => {
      const name = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return ` data-${name}="${escapeAttr(v === true ? '1' : String(v))}"`;
    })
    .join('');
  return `<script src="${siteBase()}embed.js"${attrs} async></script>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
