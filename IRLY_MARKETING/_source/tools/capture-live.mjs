// Records the IRLY demo in real time through Chromium's screencast (what the screen shows,
// app animations included), then resamples it to a fixed frame rate.
// node capture-live.mjs <spec.json>
// spec: { out, fps, dpr, setup: [step], steps: [step] }
//   step: { goto } | { wait: ms } | { tap: "text" } | { scroll: px, ms } | { hold: ms }
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const BASE = process.env.BASE || 'http://localhost:8090';
const fps = spec.fps || 30;
fs.rmSync(spec.out, { recursive: true, force: true });
fs.mkdirSync(spec.out, { recursive: true });

const browser = await chromium.launch({ args: [`--force-device-scale-factor=${spec.dpr || 2}`] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
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
// The demo banner is hidden for marketing footage only (a style rule, so it never flickers).
await page.addInitScript(() => {
  const hide = () => {
    for (const d of document.querySelectorAll('div')) {
      const t = d.textContent || '';
      if ((t.startsWith('Démo ·') || t.startsWith('Demo ·')) && t.length < 90) {
        let el = d;
        while (el && !['fixed', 'absolute'].includes(getComputedStyle(el).position)) el = el.parentElement;
        if (el) el.style.visibility = 'hidden';
      }
    }
  };
  new MutationObserver(hide).observe(document, { childList: true, subtree: true });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = async (text) => {
  try {
    await page.getByText(text, { exact: false }).first().click({ timeout: 4000, noWaitAfter: true });
  } catch {
    console.error('tap failed', text);
  }
};
const run = async (steps) => {
  for (const s of steps) {
    if (s.goto) await page.goto(BASE + s.goto, { waitUntil: 'networkidle' });
    if (s.wait) await sleep(s.wait);
    if (s.tap) await tap(s.tap);
    if (s.scroll) {
      await page.mouse.move(195, s.y || 520);
      const steps = Math.max(1, Math.round(s.ms / 16));
      const e = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
      const t0 = Date.now();
      for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, s.scroll * (e((i + 1) / steps) - e(i / steps)));
        const due = t0 + ((i + 1) * s.ms) / steps;
        const left = due - Date.now();
        if (left > 0) await sleep(left);
      }
    }
    if (s.hold) await sleep(s.hold);
  }
};

await run(spec.setup || []);
const cdp = await context.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 390 * (spec.dpr || 2), maxHeight: 844 * (spec.dpr || 2), everyNthFrame: 1 });
const start = Date.now() / 1000;
await run(spec.steps);
const end = Date.now() / 1000;
await cdp.send('Page.stopScreencast');

// Resample: for every output tick, the last frame shown at that moment.
const total = Math.round((end - start) * fps);
let j = 0;
for (let i = 0; i < total; i += 1) {
  const t = start + i / fps;
  while (j + 1 < frames.length && frames[j + 1].t <= t) j += 1;
  fs.writeFileSync(path.join(spec.out, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(frames[j].data, 'base64'));
}
console.log(`frames ${total} from ${frames.length} screencast frames (${(frames.length / (end - start)).toFixed(1)} fps real)`, spec.out);
await browser.close();
