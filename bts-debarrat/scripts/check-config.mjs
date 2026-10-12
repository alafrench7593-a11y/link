/**
 * Contrôle avant mise en ligne : liste les informations manquantes.
 *   npm run check:config            → rapport
 *   npm run check:config -- --strict → code de sortie 1 si un point bloquant manque (à brancher sur le déploiement de production)
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(path.join(tmpdir(), "bts-config-"));
for (const f of ["site", "zones", "realisations", "services", "checklist"]) {
  const src = readFileSync(`src/config/${f}.ts`, "utf8");
  // Node ≥ 22.18 exécute le TypeScript directement (suppression des types).
  writeFileSync(path.join(dir, `${f}.ts`), src.replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"'));
}
const { checklist } = await import(pathToFileURL(path.join(dir, "checklist.ts")).href);
const points = checklist();
let bloquants = 0;
for (const p of points) {
  const etat = p.ok ? "✓" : p.bloquant ? "✗" : "•";
  if (!p.ok && p.bloquant) bloquants++;
  console.log(`${etat} ${p.libelle}${p.ok ? "" : ` — ${p.bloquant ? "OBLIGATOIRE" : "recommandé"} (${p.aide})`}`);
}
console.log(bloquants ? `\n${bloquants} point(s) obligatoire(s) manquant(s) : ne pas mettre en ligne.` : "\nConfiguration complète pour la mise en ligne.");
process.exit(process.argv.includes("--strict") && bloquants ? 1 : 0);
