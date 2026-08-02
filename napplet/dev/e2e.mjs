/**
 * Drives the built napplet inside the dev test shell (shell.html) with the
 * system Chrome via playwright-core — no browser download.
 *
 * Usage:
 *   npm run build:napplet
 *   python3 -m http.server 8090   # from the repo root, any static server works
 *   node napplet/dev/e2e.mjs
 *
 * A Vite dev server must NOT serve shell.html: it rewrites inline scripts into
 * external ones, which the NIP-5D baseline CSP rightfully blocks.
 */
import { chromium } from 'playwright-core';

const url = process.env.E2E_URL ?? 'http://localhost:8090/napplet/dev/shell.html';
const shot = process.env.E2E_SCREENSHOT;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(url);

  const frame = page.frameLocator('#frame');
  const folio = frame.locator('.folio');

  await frame.locator('.viewer').waitFor({ timeout: 10_000 });

  async function expectFolio(expected, step) {
    await folio.filter({ hasText: expected }).waitFor({ timeout: 5_000 });
    console.log(`ok: ${step} -> ${expected}`);
  }

  await expectFolio('01 / 05', 'intent opened deck');

  const stage = frame.locator('.stage');
  const box = await stage.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  await expectFolio('02 / 05', 'right-zone click advances');

  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2);
  await expectFolio('01 / 05', 'left-zone click goes back');

  const src = await frame.locator('.slide').getAttribute('src');
  if (!src?.startsWith('blob:')) throw new Error(`slide src is not a blob URL: ${src}`);
  console.log('ok: slide served via object URL under baseline CSP');

  if (shot) {
    await page.screenshot({ path: shot });
    console.log(`screenshot: ${shot}`);
  }
  console.log('E2E PASSED');
} finally {
  await browser.close();
}
