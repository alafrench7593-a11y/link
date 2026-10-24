// Renders 1080 × 1920 HTML compositions to PNG.
// node render-png.mjs <src-root> <html-rel>=<out.png> ...   (src-root is served on :8091)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [root, ...jobs] = process.argv.slice(2);

const server = spawn('node', [path.join(path.dirname(new URL(import.meta.url).pathname), 'serve.mjs'), root, '8091'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch();
// H=1350 renders the Instagram feed (4:5) frame.
const page = await browser.newPage({ viewport: { width: 1080, height: Number(process.env.H || 1920) }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('requestfailed', (r) => console.error('missing', r.url()));

for (const job of jobs) {
  const [rel, out] = job.split('=');
  await page.goto(`http://localhost:8091/${rel}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, type: 'png' });
  console.log('png', out);
}
await browser.close();
server.kill();
