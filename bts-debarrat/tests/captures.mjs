/** Captures d'écran pleine page (après défilement) pour relecture visuelle. Serveur attendu sur PORT (3300). */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const PORT = process.env.PORT || 3300;
const pages = (process.argv[2] || "/,/debarras-appartement/,/devis/,/realisations/,/zone-intervention/").split(",");
mkdirSync("tests/captures", { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
for (const [nom, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
  for (const chemin of pages) {
    await p.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: "networkidle" });
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 400) { await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(80); }
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForTimeout(1500);
    const fichier = `tests/captures/${nom}${chemin.replace(/\//g, "_") || "_"}.png`;
    await p.screenshot({ path: fichier, fullPage: true });
    console.log(fichier);
  }
}
await b.close();
