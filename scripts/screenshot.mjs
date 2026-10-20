#!/usr/bin/env node
/**
 * Smoke screenshots: serves dist/ under /tw_amr_dashboard/ and captures every route in
 * light/dark × zh-TW/en/ja (+ embed widgets) to screenshots/. Reports console errors.
 *
 *   npm run build && node scripts/screenshot.mjs [--mobile] [--routes=/,/resistance] [--strict]
 *
 * Uses the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers); never runs `playwright install`.
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'screenshots');
const BASE = '/tw_amr_dashboard/';
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

const ROUTES = (opt('routes') ?? '/,/resistance,/antibiotic-use,/hai,/international,/data,/resources,/about,/chat,/does-not-exist').split(',');
const THEMES = (opt('themes') ?? 'light,dark').split(',');
const LANGS = (opt('langs') ?? 'zh-TW,en,ja').split(',');
const EMBEDS = ['resistance-trend&pathogen=ABA&antibiotic=MEM', 'resistance-heatmap', 'kpi-strip&compact=1', 'nope'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.csv': 'text/csv; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
};

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
      return res.end();
    }
    let p = normalize(decodeURIComponent(url.pathname.slice(BASE.length))).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const slug = (r) => (r === '/' ? 'overview' : r.replace(/^\//, '').replace(/[^\w-]+/g, '_'));

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist/ not found — run `npm run build` first.');
    process.exit(2);
  }
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const problems = [];
  let shots = 0;
  const viewport = flag('mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 };

  async function capture(url, file, theme, lang) {
    const ctx = await browser.newContext({ viewport, colorScheme: theme, locale: lang, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errs.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#root > *', { timeout: 15000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, file), fullPage: true });
    shots++;
    if (errs.length) problems.push({ url, errs });
    await ctx.close();
  }

  for (const theme of THEMES)
    for (const lang of LANGS) {
      for (const r of ROUTES) {
        const url = `${origin}${BASE}#${r}?lang=${lang}&theme=${theme}`;
        await capture(url, `${slug(r)}-${theme}-${lang}${flag('mobile') ? '-mobile' : ''}.png`, theme, lang);
      }
    }
  for (const theme of THEMES)
    for (const e of EMBEDS) {
      const url = `${origin}${BASE}embed.html#/?chart=${e}&lang=en&theme=${theme}`;
      await capture(url, `embed-${e.split('&')[0]}-${theme}.png`, theme, 'en');
    }

  await browser.close();
  server.close();
  console.log(`\n${shots} screenshots → ${OUT}`);
  if (problems.length) {
    console.log(`\n${problems.length} page(s) logged console errors:`);
    for (const p of problems) console.log(`  ${p.url}\n    - ${p.errs.slice(0, 5).join('\n    - ')}`);
    if (flag('strict')) process.exit(1);
  } else console.log('No console errors.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
