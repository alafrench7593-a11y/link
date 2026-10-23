// Records a real screen sequence of the IRLY demo frame by frame, with the page clock
// under control, so app animations and scrolls are captured smoothly at a fixed rate.
// node capture-seq.mjs <spec.json>
// spec: { out, fps, dpr, locale, setup: [step], steps: [step] }
//   step: { goto, wait } | { frames, wheel?: px per frame (eased), tap?: text } | { tap: text } | { hold: frames }
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const BASE = process.env.BASE || 'http://localhost:8090';
const fps = spec.fps || 30;
const dt = 1000 / fps;
fs.rmSync(spec.out, { recursive: true, force: true });
fs.mkdirSync(spec.out, { recursive: true });

const browser = await chromium.launch({ args: ['--disable-smooth-scrolling'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: spec.dpr || 2,
  isMobile: true,
  hasTouch: true,
  locale: spec.locale || 'fr-FR',
  timezoneId: 'Asia/Dubai',
  colorScheme: 'dark',
});
const PHOTOS = '/home/user/alafrench7593-a11y/irly/public-photos';
const SITE = '/home/user/alafrench7593-a11y/irly/site';
await context.route('**/alafrench7593-a11y.github.io/irly/photos/**', (r) => {
  const f = path.join(PHOTOS, decodeURIComponent(new URL(r.request().url()).pathname.replace('/irly/photos/', '')));
  return fs.existsSync(f) ? r.fulfill({ path: f }) : r.abort();
});
await context.route('**/getirly.com/**', (r) => {
  const f = path.join(SITE, decodeURIComponent(new URL(r.request().url()).pathname));
  return fs.existsSync(f) && fs.statSync(f).isFile() ? r.fulfill({ path: f }) : r.abort();
});
await context.route(/images\.unsplash\.com|openfreemap/, (r) => r.abort());

const page = await context.newPage();
if (spec.clock) await page.clock.install({ time: new Date('2026-10-23T19:10:00+04:00') });

const hideBanner = () =>
  page.evaluate(() => {
    for (const d of document.querySelectorAll('div')) {
      if (/^Démo ·|^Demo ·/.test(d.textContent || '') && d.textContent.length < 90) {
        let el = d;
        while (el && !['fixed', 'absolute'].includes(getComputedStyle(el).position)) el = el.parentElement;
        if (el) el.style.visibility = 'hidden';
      }
    }
  });

let n = 0;
const shoot = async () => {
  await hideBanner();
  await page.screenshot({ path: path.join(spec.out, `${String(n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
  n += 1;
};
// Without a controlled clock, each frame lets the page settle briefly after the scroll step.
const advance = async () => {
  if (spec.clock) await page.clock.runFor(dt);
  else await page.waitForTimeout(spec.settle || 45);
};
const tap = async (text) => {
  try {
    await page.getByText(text, { exact: false }).first().click({ timeout: 4000, noWaitAfter: true, force: true });
  } catch {
    console.error('tap failed', text);
  }
};

const run = async (steps, record) => {
  for (const s of steps) {
    if (s.goto) {
      await page.goto(BASE + s.goto, { waitUntil: spec.clock ? 'domcontentloaded' : 'networkidle' });
      await page.waitForTimeout(800);
    }
    if (s.wait) {
      // Let real network (local) settle while the app clock moves on.
      if (spec.clock) for (let i = 0; i < s.wait; i += 250) { await page.clock.runFor(250); await page.waitForTimeout(60); }
      else await page.waitForTimeout(s.wait);
    }
    if (s.tap && !s.frames) await tap(s.tap);
    if (s.frames) {
      if (s.tap) await tap(s.tap);
      await page.mouse.move(195, s.y || 520);
      for (let i = 0; i < s.frames; i += 1) {
        if (s.wheel) {
          // Ease in-out distribution of the total scroll over the frames.
          const e = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
          const d = s.wheel * (e((i + 1) / s.frames) - e(i / s.frames));
          if (Math.abs(d) > 0.01) await page.mouse.wheel(0, d);
        }
        await advance();
        if (record) await shoot();
      }
    }
    if (s.hold) for (let i = 0; i < s.hold; i += 1) { await advance(); if (record) await shoot(); }
  }
};

await run(spec.setup || [], false);
await run(spec.steps, true);
console.log('frames', n, spec.out);
await browser.close();
