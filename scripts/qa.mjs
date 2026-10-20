#!/usr/bin/env node
/**
 * Integration QA (Playwright): serves dist/ under /tw_amr_dashboard/ and checks, per route × language × theme:
 *   - no console errors / page errors / failed requests
 *   - no raw i18n keys or "undefined" / "NaN" / "[object" in visible text or aria/title attributes
 *   - <html lang> and document.title follow the language; exactly one <h1>
 *   - every ECharts instance uses the active theme
 * plus: no horizontal overflow at 360 px, and every embed chart renders and posts `twamr:resize`.
 *
 *   npm run build && node scripts/qa.mjs [--langs=zh-TW,en] [--themes=light] [--no-mobile] [--no-embeds]
 *
 * Exits 1 on any finding. Uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH); never runs `playwright install`.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const DIST = join(ROOT, 'dist');
const BASE = '/tw_amr_dashboard/';
const args = process.argv.slice(2);
const opt = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const flag = (n) => args.includes(`--${n}`);
const LANGS = opt('langs', 'zh-TW,en,ja').split(',');
const THEMES = opt('themes', 'light,dark').split(',');
const ROUTES = [
  '/', '/resistance', '/resistance?view=antibiogram', '/resistance?view=pathogen', '/resistance?view=compare',
  '/resistance?view=isolates', '/antibiotic-use', '/hai', '/international', '/data', '/resources', '/about', '/chat', '/nope',
];
const EMBEDS = ['resistance-trend', 'resistance-heatmap', 'kpi-strip', 'resistance-co-ho', 'resistance-pathogen-bars', 'glass-map', 'glass-bars', 'amu-stacked', 'amu-aware', 'hai-trend', 'hai-bump'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.csv': 'text/csv; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8' };

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__host.html') {
      res.writeHead(200, { 'content-type': TYPES['.html'] });
      const frames = EMBEDS.map((id, i) => `<iframe src="${BASE}embed.html#/?chart=${id}&lang=ja&theme=dark&id=e${i}" style="width:640px;height:200px;border:0"></iframe>`).join('');
      return res.end(`<!doctype html><meta charset="utf-8"><script>window.__m=[];addEventListener('message',e=>__m.push(e.data))</script>${frames}`);
    }
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404);
      return res.end();
    }
    let file = join(DIST, normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, ''));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function watch(page, sink) {
  page.on('console', (m) => m.type() === 'error' && sink.push(`console: ${m.text().slice(0, 240)}`));
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => sink.push(`requestfailed: ${r.url()}`));
}

async function settle(page) {
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/ not found — run `npm run build` first.');
    process.exit(2);
  }
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const issues = [];
  const titles = {};

  for (const theme of THEMES)
    for (const lang of LANGS) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
      for (const r of ROUTES) {
        const page = await ctx.newPage();
        const errs = [];
        watch(page, errs);
        await page.goto(`${origin}${BASE}#${r}${r.includes('?') ? '&' : '?'}lang=${lang}&theme=${theme}`, { waitUntil: 'networkidle' });
        await settle(page);
        const res = await page.evaluate(() => {
          const KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+)+$/;
          const BAD = /undefined|NaN|\[object|\{[a-zA-Z]+\}/;
          const notKey = (t) => /^\d/.test(t) || /\.(json|csv|yaml|js|png|svg|md|html|ts|org|gov|tw|uk|eu|int|io|ca|cn|com|jp|kr|th|au|net)$/.test(t) || /^v\d/.test(t);
          const out = [];
          const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = w.nextNode())) {
            const t = n.textContent.trim();
            const el = n.parentElement;
            if (!t || !el || el.closest('script,style,pre,code')) continue;
            if (KEY.test(t) && !notKey(t)) out.push(`raw key "${t}"`);
            else if (BAD.test(t) && !/^\/[\w/{}.-]+$/.test(t)) out.push(`bad text "${t.slice(0, 80)}"`);
          }
          for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]'))
            for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
              const v = el.getAttribute(a);
              if (v && (KEY.test(v.trim()) || BAD.test(v))) out.push(`bad ${a} "${v.slice(0, 80)}"`);
            }
          return {
            out,
            lang: document.documentElement.lang,
            title: document.title,
            h1: document.querySelectorAll('h1').length,
            charts: [...document.querySelectorAll('[data-echarts-theme]')].map((e) => e.dataset.echartsTheme),
          };
        });
        const tag = `${theme}/${lang} #${r}`;
        for (const o of [...res.out, ...errs]) issues.push(`${tag}: ${o}`);
        if (res.lang !== lang) issues.push(`${tag}: <html lang="${res.lang}">`);
        if (res.h1 !== 1) issues.push(`${tag}: ${res.h1} <h1> elements`);
        if (res.charts.some((c) => !c.includes(theme))) issues.push(`${tag}: chart(s) not re-themed`);
        (titles[r] ??= {})[lang] = res.title;
        await page.close();
      }
      await ctx.close();
    }
  for (const [r, t] of Object.entries(titles)) {
    const v = Object.values(t);
    if (v.length > 1 && new Set(v).size !== v.length) issues.push(`#${r}: document.title does not change with language`);
  }

  if (!flag('no-mobile')) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    for (const r of ROUTES) {
      const page = await ctx.newPage();
      await page.goto(`${origin}${BASE}#${r}${r.includes('?') ? '&' : '?'}lang=${LANGS[LANGS.length - 1]}`, { waitUntil: 'networkidle' });
      await settle(page);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
      if (o.sw > o.vw + 1) issues.push(`360px #${r}: horizontal overflow (${o.sw} > ${o.vw})`);
      await page.close();
    }
    await ctx.close();
  }

  if (!flag('no-embeds')) {
    const page = await browser.newPage();
    const errs = [];
    watch(page, errs);
    await page.goto(`${origin}/__host.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const msgs = await page.evaluate(() => window.__m);
    EMBEDS.forEach((id, i) => {
      if (!msgs.some((m) => m && m.type === 'twamr:resize' && m.id === `e${i}` && m.height > 100)) issues.push(`embed ${id}: no twamr:resize`);
    });
    for (const f of page.frames().slice(1)) {
      const ok = await f.evaluate(() => !!document.querySelector('section[aria-labelledby]') && !document.querySelector('.embed-unknown'));
      if (!ok) issues.push(`embed ${f.url()}: did not render a chart card`);
    }
    errs.forEach((e) => issues.push(`embeds: ${e}`));
    await page.close();
  }

  await browser.close();
  server.close();
  if (issues.length) {
    console.log(`${issues.length} issue(s):\n  ${[...new Set(issues)].join('\n  ')}`);
    process.exit(1);
  }
  console.log(`QA passed: ${ROUTES.length} routes × ${LANGS.length} languages × ${THEMES.length} themes${flag('no-mobile') ? '' : ', 360px overflow'}${flag('no-embeds') ? '' : `, ${EMBEDS.length} embeds`}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
