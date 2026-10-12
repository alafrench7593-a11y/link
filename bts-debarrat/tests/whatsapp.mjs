/** Vérifie le format wa.me avec un numéro factice, sans toucher à la configuration réelle. */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const dir = mkdtempSync(path.join(tmpdir(), "bts-wa-"));
const site = readFileSync("src/config/site.ts", "utf8")
  .replace("whatsapp: null as string | null", 'whatsapp: "33 6 00 00 00 00" as string | null')
  .replace("telephoneLien: null as string | null", 'telephoneLien: "+33 6 00 00 00 00" as string | null');
writeFileSync(path.join(dir, "site.ts"), site);
writeFileSync(path.join(dir, "whatsapp.ts"), readFileSync("src/lib/whatsapp.ts", "utf8").replace('"@/config/site"', '"./site.ts"'));
const wa = await import(pathToFileURL(path.join(dir, "whatsapp.ts")).href);

const url = wa.whatsappUrl("Bonjour BTS DÉBARRAT, devis cave à [ville] ?");
assert.match(url, /^https:\/\/wa\.me\/33600000000\?text=/);
assert.equal(decodeURIComponent(url.split("text=")[1]), "Bonjour BTS DÉBARRAT, devis cave à [ville] ?");
assert.match(wa.whatsappUrl(), /text=Bonjour%20BTS%20D%C3%89BARRAT/);
assert.equal(wa.telUrl(), "tel:+33600000000");
console.log("✓ Liens WhatsApp au format officiel wa.me/<numéro>?text=… et lien tel: corrects");
