/** Mesure LCP, CLS, poids transféré sur mobile simulé (CPU ×4, 4G lente). Serveur attendu sur PORT (3300). */
import { chromium } from "playwright-core";
const PORT = process.env.PORT || 3300;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
for (const chemin of ["/", "/debarras-appartement/", "/devis/"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let js = 0, total = 0;
  p.on("response", async (r) => {
    const l = Number((await r.allHeaders())["content-length"] || (await r.body().catch(() => Buffer.alloc(0))).length);
    total += l;
    if (r.url().endsWith(".js")) js += l;
  });
  await p.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: "layout-shift", buffered: true });
  });
  const t0 = Date.now();
  await p.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: "load" });
  const load = Date.now() - t0;
  await p.waitForTimeout(3000);
  const { lcp, cls } = await p.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
  console.log(`${chemin.padEnd(24)} LCP ${Math.round(lcp)} ms · CLS ${cls.toFixed(3)} · load ${load} ms · JS ${(js / 1024).toFixed(0)} Ko · total ${(total / 1024).toFixed(0)} Ko`);
  await ctx.close();
}
await b.close();
