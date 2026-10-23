// Renders a time-driven composition (window.seek(t)) to a silent H.264 MP4, frame by frame.
// node render-video.mjs <src-root> <page-rel> <seconds> <out.mp4> [fps=30] [scale=1]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [root, rel, seconds, out, fpsArg = '30', scaleArg = '1'] = process.argv.slice(2);
const fps = Number(fpsArg);
const scale = Number(scaleArg); // 0.5 renders a half-size draft for review
const total = Math.round(Number(seconds) * fps);
const port = String(8100 + Math.floor(Math.random() * 800));

const server = spawn('node', [path.join(path.dirname(new URL(import.meta.url).pathname), 'serve.mjs'), root, port], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('requestfailed', (r) => console.error('missing', r.url()));
await page.goto(`http://localhost:${port}/${rel}`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.__ready);

const W = Math.round(1080 * scale);
const H = Math.round(1920 * scale);
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', scale < 1 ? '23' : '16',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let i = 0; i < total; i += 1) {
  await page.evaluate((t) => window.seek(t), i / fps);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`frame ${i}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
server.kill();
console.log('video', out);
