// Launch Chromium for the QA/screenshot scripts. Uses Playwright's bundled browser when it is
// installed; otherwise falls back to PLAYWRIGHT_CHROMIUM_EXECUTABLE or any Chromium found under
// PLAYWRIGHT_BROWSERS_PATH (e.g. a pre-provisioned /opt/pw-browsers that is older than the npm package).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

function fallbackExecutable() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (explicit && existsSync(explicit)) return explicit;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .reverse();
  for (const d of dirs) {
    const bin = join(root, d, 'chrome-linux', 'chrome');
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

export async function launchChromium(options = {}) {
  try {
    return await chromium.launch(options);
  } catch (err) {
    const executablePath = fallbackExecutable();
    if (!executablePath) throw err;
    console.warn(`[launch] bundled Chromium unavailable; using ${executablePath}`);
    return chromium.launch({ ...options, executablePath });
  }
}
