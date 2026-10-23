// Captures screens of the IRLY demo build (example data, no server) as a phone.
// node capture.mjs <out-dir> <name=route[@wait][#scrollY]> ...
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const BASE = process.env.BASE || 'http://localhost:8090';
const LOCALE = process.env.LOCALE || 'fr-FR';
const [outDir, ...jobs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: LOCALE,
  timezoneId: 'Asia/Dubai',
  colorScheme: 'dark',
  reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference',
});
// The demo's photos live on GitHub Pages (blocked here); the repository holds the same files.
const PHOTOS = process.env.PHOTOS || '/home/user/alafrench7593-a11y/irly/public-photos';
await context.route('**/alafrench7593-a11y.github.io/irly/photos/**', (route) => {
  const rel = new URL(route.request().url()).pathname.replace('/irly/photos/', '');
  const file = path.join(PHOTOS, decodeURIComponent(rel));
  if (fs.existsSync(file)) return route.fulfill({ path: file });
  console.error('missing photo', rel);
  return route.abort();
});
// getirly.com serves the website folder of the same repository.
const SITE = process.env.SITE || '/home/user/alafrench7593-a11y/irly/site';
await context.route('**/getirly.com/**', (route) => {
  const file = path.join(SITE, decodeURIComponent(new URL(route.request().url()).pathname));
  return fs.existsSync(file) && fs.statSync(file).isFile() ? route.fulfill({ path: file }) : route.abort();
});
await context.route(/images\.unsplash\.com/, (route) => route.abort());

const page = await context.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message.slice(0, 160)));

// The demo banner ("Démo · rien n'est enregistré") is hidden for the marketing captures only.
const hideDemoBanner = () =>
  page.evaluate(() => {
    const hits = [...document.querySelectorAll('div')].filter((d) => /^Démo ·|^Demo ·/.test(d.textContent || '') && d.textContent.length < 90);
    for (const d of hits) {
      let el = d;
      while (el && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).position !== 'absolute') el = el.parentElement;
      if (el) el.style.visibility = 'hidden';
    }
  });

for (const job of jobs) {
  // name=route[@wait][>text to tap>...][#scrollY]
  const [name, rest] = job.split('=');
  const [routeAndTaps, scroll] = rest.split('#');
  const [routeAndWait, ...taps] = routeAndTaps.split('>');
  const [route, wait = '5000'] = routeAndWait.split('@');
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(Number(wait));
  for (const tap of taps) {
    try {
      await page.getByText(tap, { exact: false }).first().click({ timeout: 5000 });
    } catch {
      console.error('tap failed', name, tap);
    }
    await page.waitForTimeout(2500);
  }
  if (scroll) {
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, Number(scroll));
    await page.waitForTimeout(1800);
  }
  if (!process.env.KEEP_BANNER) await hideDemoBanner();
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('shot', file, page.url());
}
await browser.close();
