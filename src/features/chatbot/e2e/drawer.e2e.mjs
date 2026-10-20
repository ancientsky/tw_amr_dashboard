#!/usr/bin/env node
/**
 * Manual smoke test for the assistant drawer (not part of `npm test`).
 *   npm run build && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node src/features/chatbot/e2e/drawer.e2e.mjs
 * Serves dist/ under /tw_amr_dashboard/, opens the floating launcher on the overview page,
 * asks one question in each language (zh-TW / en / ja) and asserts the answers contain
 * numbers, a mini chart and an explorer deep link. Also checks follow-up chips, the
 * mobile full-screen sheet, persistence and openChat(). Screenshots → screenshots/chat-drawer-*.png
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'screenshots');
const BASE = '/tw_amr_dashboard/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(302, { Location: BASE });
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

const CASES = [
  { lang: 'zh-TW', q: '2024 年 CRKP 在醫學中心多少？', expect: /11\.5%/ },
  { lang: 'en', q: 'MRSA trend hospital-onset', expect: /\d+\.\d%/ },
  { lang: 'ja', q: 'CRAB はどの病院種別で最も高い？', expect: /74\.6%/ },
];

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
  if (!ok) failures++;
};

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ missing — run npm run build');
  mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const errors = [];

  for (const c of CASES) {
    console.log(`\n[${c.lang}] ${c.q}`);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: c.lang, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(`${c.lang}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${c.lang}: ${e.message}`));
    await page.goto(`${origin}${BASE}#/?lang=${c.lang}&theme=${c.lang === 'en' ? 'dark' : 'light'}`, { waitUntil: 'networkidle' });
    const launcher = page.locator('[data-chat-launcher]');
    await launcher.waitFor();
    check((await launcher.innerText()).includes('AI'), 'launcher shows the AI badge');
    const dialog = page.getByRole('dialog');
    await launcher.click();
    if (!(await dialog.waitFor({ timeout: 5000 }).then(() => true, () => false))) {
      console.log('  ! first launcher click did not open the drawer — retrying (busy machine?)');
      await launcher.click();
      await dialog.waitFor();
    }
    const input = dialog.locator('textarea');
    await input.waitFor();
    check(await input.evaluate((el) => el === document.activeElement), 'composer is focused when the drawer opens');
    await input.fill(c.q);
    await input.press('Enter');
    const answer = dialog.locator('li').filter({ has: page.locator('figure') }).last();
    await answer.waitFor({ timeout: 15000 });
    const text = await answer.innerText();
    check(c.expect.test(text), `answer contains the expected number (${c.expect})`);
    check((await answer.locator('canvas').count()) > 0, 'mini chart rendered');
    check((await answer.locator('a[href^="#/resistance"]').count()) > 0, 'explorer deep link present');
    const chips = answer.locator('[role="group"] button');
    check((await chips.count()) >= 2, `follow-up chips present (${await chips.count()})`);
    const box = await dialog.boundingBox();
    check(box && Math.round(box.width) <= 420 && box.x > 600, `desktop drawer is a right-side panel ≤ 420px (got ${box && Math.round(box.width)}px)`);
    await page.screenshot({ path: join(OUT, `chat-drawer-${c.lang}.png`) });
    if (c.lang === 'zh-TW') {
      // follow-up chip uses the conversation context
      await dialog.getByRole('button', { name: /哪個層級最高/ }).first().click();
      await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] figure').length >= 2, null, { timeout: 15000 });
      const last = await dialog.locator('li').last().innerText();
      check(/醫學中心|區域醫院|地區醫院/.test(last) && /\d+\.\d%/.test(last), 'follow-up chip answered with per-level numbers');
      // persistence across reloads
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('[data-chat-launcher]').click();
      await page.getByRole('dialog').locator('figure').first().waitFor({ timeout: 15000 });
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('twamr.chat') || '{}').messages?.length ?? 0);
      check(stored === 4, `conversation persisted in localStorage (${stored} messages)`);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      check(true, 'Escape closes the drawer');
      // openChat() API from the scaffold
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('twamr:chat-open', { detail: { q: 'VRE 2024' } })));
      await page.getByRole('dialog').waitFor();
      await page.waitForFunction(() => /18\.0%/.test(document.querySelector('[role="dialog"]')?.textContent ?? ''), null, { timeout: 15000 });
      check(true, 'openChat({ q }) opens the drawer and answers');
    }
    await ctx.close();
  }

  // Claude mode with a mocked Messages API (streaming success, then a 401 → offline fallback)
  console.log('\n[claude mode, mocked API]');
  const cctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'en', reducedMotion: 'reduce' });
  await cctx.addInitScript(() => localStorage.setItem('twamr.anthropicKey', 'sk-ant-test-0000000000000000000000'));
  let mode = 'ok';
  let lastBody = null;
  let lastHeaders = null;
  await cctx.route('https://api.anthropic.com/v1/messages', async (route) => {
    lastBody = JSON.parse(route.request().postData() || '{}');
    lastHeaders = route.request().headers();
    const cors = { 'access-control-allow-origin': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-headers': '*' } });
    if (mode === '401') return route.fulfill({ status: 401, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    const body = [
      ev({ type: 'message_start', message: {} }),
      ev({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'In 2024 CRAB was **58.4%** nationally ' } }),
      ev({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '([explorer](#/resistance?phenotype=CRAB)).' } }),
      ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }),
      ev({ type: 'message_stop' }),
    ].join('');
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body });
  });
  const cp = await cctx.newPage();
  cp.on('pageerror', (e) => errors.push(`claude: ${e.message}`));
  await cp.goto(`${origin}${BASE}#/chat?lang=en`, { waitUntil: 'networkidle' });
  const panel = cp.locator('main');
  check(/Claude mode/.test(await panel.innerText()), 'Claude-mode badge shown when a key is stored');
  await panel.locator('textarea').fill('CRAB 2024');
  await panel.locator('textarea').press('Enter');
  await cp.waitForFunction(() => /Written by Claude/.test(document.querySelector('main')?.textContent ?? ''), null, { timeout: 15000 });
  const ctext = await panel.locator('li').last().innerText();
  check(/58\.4%/.test(ctext), 'streamed Claude text rendered');
  check(lastHeaders?.['anthropic-dangerous-direct-browser-access'] === 'true' && lastBody?.model === 'claude-haiku-5-5', 'request uses the browser header and claude-haiku-5-5');
  check(JSON.stringify(lastBody?.system ?? '').includes('58.4%'), 'system prompt carries the resolved data facts');
  check((await panel.locator('li').last().locator('figure').count()) === 1, 'offline mini chart attached to the Claude answer');
  mode = '401';
  await panel.locator('textarea').fill('MRSA 2024');
  await panel.locator('textarea').press('Enter');
  await cp.waitForFunction(() => /401/.test(document.querySelector('main ol li:last-child')?.textContent ?? ''), null, { timeout: 15000 });
  const etext = await panel.locator('li').last().innerText();
  check(/48\.0%/.test(etext) && /Offline engine/.test(etext), '401 → friendly error + offline answer');
  await cp.screenshot({ path: join(OUT, 'chat-claude-mock.png') });
  await cctx.close();

  // mobile: full-screen sheet; launcher sits above the safe area
  console.log('\n[mobile]');
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW', reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push(`mobile: ${e.message}`));
  await mp.goto(`${origin}${BASE}#/resistance?lang=zh-TW`, { waitUntil: 'networkidle' });
  const lb = await mp.locator('[data-chat-launcher]').boundingBox();
  check(lb && lb.y + lb.height <= 844 - 16 && lb.width <= 52, `mobile launcher is compact and above the bottom edge (${lb && JSON.stringify(lb)})`);
  await mp.locator('[data-chat-launcher]').click();
  const d = mp.getByRole('dialog');
  await d.waitFor();
  const db = await d.boundingBox();
  check(db && Math.round(db.width) === 390 && Math.round(db.height) >= 840, 'mobile drawer is a full-screen sheet');
  await d.locator('textarea').fill('台灣的 CRAB 跟日本比');
  await d.locator('textarea').press('Enter');
  await d.locator('figure').first().waitFor({ timeout: 15000 });
  check(/\d+\.\d%/.test(await d.innerText()), 'mobile answer contains numbers');
  await mp.screenshot({ path: join(OUT, 'chat-drawer-mobile.png') });
  await m.close();

  await browser.close();
  server.close();
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll drawer checks passed.');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
