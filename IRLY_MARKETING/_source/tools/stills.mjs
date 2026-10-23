// Contact sheet of chosen moments of a composition, to review timing and layout before a render.
// node stills.mjs <src-root> <page-rel> <out.jpg> <t1> <t2> ...
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [root, rel, out, ...times] = process.argv.slice(2);
const port = String(8100 + Math.floor(Math.random() * 800));
const here = path.dirname(new URL(import.meta.url).pathname);
const server = spawn('node', [path.join(here, 'serve.mjs'), root, port], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 0.5 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('requestfailed', (r) => console.error('missing', r.url()));
await page.goto(`http://localhost:${port}/${rel}`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.__ready);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stills-'));
const files = [];
for (const t of times) {
  await page.evaluate((x) => window.seek(x), Number(t));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const f = path.join(tmp, `t${String(t).padStart(6, '0')}s.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 80 });
  files.push(f);
}
await browser.close();
server.kill();
execFileSync('python3', [path.join(here, 'sheet.py'), out, String(Math.min(files.length, 8)), '270', ...files], { stdio: 'inherit' });
