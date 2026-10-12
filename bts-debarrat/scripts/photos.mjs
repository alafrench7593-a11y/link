/**
 * Télécharge et optimise les photos déclarées dans src/config/photos.ts (champ credit.telechargement).
 *   npm run photos
 * Sortie : public/photos/<id>.webp (2000 px de large max, qualité 78). Ensuite, renseigner `src`.
 * Nécessite l'accès réseau aux hôtes images.unsplash.com / images.pexels.com.
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tmp = path.join(tmpdir(), `bts-photos-${process.pid}.ts`);
writeFileSync(tmp, readFileSync("src/config/photos.ts", "utf8"));
const { photos } = await import(pathToFileURL(tmp).href);
mkdirSync("public/photos", { recursive: true });

let ok = 0;
for (const p of Object.values(photos)) {
  const url = p.credit?.telechargement;
  if (!url) {
    console.log(`• ${p.id} : aucune source déclarée (${p.sujet})`);
    continue;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = `public/photos/${p.id}.webp`;
    await sharp(buf).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
    console.log(`✓ ${p.id} → ${out} (${p.credit.auteur}, ${p.credit.licence})`);
    ok++;
  } catch (e) {
    console.log(`✗ ${p.id} : téléchargement impossible (${e.message}). Source : ${p.credit.page}`);
  }
}
console.log(`\n${ok} photo(s) installée(s). Renseignez ensuite src: "/photos/<id>.webp" dans src/config/photos.ts.`);
