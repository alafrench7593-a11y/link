/**
 * Tests de bout en bout sur le build de production (npm run build d'abord).
 *   node tests/e2e.mjs
 * Démarre deux serveurs Next :
 *   - :3100 relié à un faux service d'e-mail (vérifie la transmission réelle et les pièces jointes) ;
 *   - :3101 sans configuration d'envoi (vérifie qu'aucun faux succès n'est affiché).
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import zlib from "node:zlib";

/** PNG valide généré en mémoire (dégradé 64 × 48). */
function pngTest(w = 64, h = 48) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  const lignes = [];
  for (let y = 0; y < h; y++) {
    const l = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) l.set([x * 4, y * 5, 120], 1 + x * 3);
    lignes.push(l);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(lignes))), chunk("IEND", Buffer.alloc(0))]);
}

const EXE = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const OK = "\x1b[32m✓\x1b[0m";
const KO = "\x1b[31m✗\x1b[0m";
let echecs = 0;
const verifier = (cond, msg) => {
  console.log(`${cond ? OK : KO} ${msg}`);
  if (!cond) echecs++;
};
mkdirSync("tests/captures", { recursive: true });

// --- faux Resend ---
const recus = [];
const mock = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    recus.push({ auth: req.headers.authorization, body: JSON.parse(b || "{}") });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "test" }));
  });
});
await new Promise((r) => mock.listen(3199, r));

function serveur(port, env) {
  const p = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { env: { ...process.env, ...env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: "pipe" });
  p.stderr.on("data", (d) => {
    if (String(d).includes("EADDRINUSE")) {
      console.error(`Port ${port} déjà utilisé : arrêtez l'ancien serveur.`);
      process.exit(1);
    }
  });
  return new Promise((ok) => {
    p.stdout.on("data", (d) => String(d).includes("Ready") && ok(p));
    setTimeout(() => ok(p), 15000);
  });
}
const s1 = await serveur(3100, { RESEND_API_KEY: "re_test", DEVIS_DESTINATAIRE: "devis@test.local", DEVIS_EXPEDITEUR: "Site <site@test.local>", RESEND_API_URL: "http://127.0.0.1:3199/emails" });
const s2 = await serveur(3101, { RESEND_API_KEY: "", DEVIS_DESTINATAIRE: "", DEVIS_EXPEDITEUR: "" });
const BASE = "http://localhost:3100";

const browser = await chromium.launch({ executablePath: EXE });

try {
  // ---------- 1. Exploration de toutes les pages et de tous les liens internes ----------
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const erreursJs = [];
  page.on("pageerror", (e) => erreursJs.push(`${page.url()} : ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !page.url().includes("page-inexistante") && erreursJs.push(`${page.url()} : ${m.text()}`));

  const aVisiter = ["/"];
  const vus = new Set();
  const titres = new Map();
  const descriptions = new Map();
  const liensCasses = [];
  while (aVisiter.length) {
    const chemin = aVisiter.shift();
    if (vus.has(chemin)) continue;
    vus.add(chemin);
    const rep = await page.goto(BASE + chemin, { waitUntil: "networkidle" });
    const statut = rep?.status() ?? 0;
    if (statut !== 200) {
      liensCasses.push(`${chemin} → ${statut}`);
      continue;
    }
    const info = await page.evaluate(() => ({
      titre: document.title,
      h1: document.querySelectorAll("h1").length,
      desc: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
      canon: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      og: !!document.querySelector('meta[property="og:title"]'),
      imgSansAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
      svgImgSansLabel: [...document.querySelectorAll('svg[role="img"]')].filter((s) => !s.getAttribute("aria-label")).length,
      liens: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { JSON.parse(s.textContent); return true; } catch { return false; } }),
    }));
    const indexable = !info.robots.includes("noindex");
    verifier(info.h1 === 1, `${chemin} : un seul H1 (${info.h1})`);
    if (indexable) {
      verifier(info.desc.length > 50 && info.desc.length <= 170, `${chemin} : meta description (${info.desc.length} car.)`);
      verifier(info.canon.endsWith(chemin), `${chemin} : canonique ${info.canon}`);
      verifier(info.og, `${chemin} : Open Graph`);
      if (titres.has(info.titre)) verifier(false, `${chemin} : titre dupliqué avec ${titres.get(info.titre)}`);
      titres.set(info.titre, chemin);
      if (descriptions.has(info.desc)) verifier(false, `${chemin} : description dupliquée avec ${descriptions.get(info.desc)}`);
      descriptions.set(info.desc, chemin);
    }
    verifier(info.imgSansAlt === 0 && info.svgImgSansLabel === 0, `${chemin} : textes alternatifs`);
    verifier(info.jsonld.every(Boolean), `${chemin} : JSON-LD valide (${info.jsonld.length})`);
    for (const l of info.liens) {
      if (!l || l.startsWith("http") || l.startsWith("mailto:") || l.startsWith("tel:") || l.startsWith("#")) continue;
      const p = l.split("#")[0].split("?")[0];
      if (p && !vus.has(p)) aVisiter.push(p);
    }
  }
  verifier(liensCasses.length === 0, `Liens internes : ${vus.size} pages explorées, ${liensCasses.length} cassés ${liensCasses.join(", ")}`);

  const r404 = await page.goto(BASE + "/page-inexistante/");
  verifier(r404?.status() === 404, "Page 404 renvoie le statut 404");
  for (const f of ["/sitemap.xml", "/robots.txt"]) {
    const r = await page.goto(BASE + f);
    verifier(r?.status() === 200, `${f} disponible`);
  }
  const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
  verifier(!sitemap.includes("espace-pro"), "Le sitemap n'expose pas l'espace pro");

  // ---------- 2. Interactions ordinateur ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "tests/captures/accueil-desktop.png" });
  await page.getByRole("button", { name: "Prestations" }).click();
  verifier(await page.locator("#menu-prestations").isVisible(), "Menu Prestations s'ouvre");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  verifier(!(await page.locator("#menu-prestations").isVisible().catch(() => false)), "Menu Prestations se ferme avec Échap");

  const slider = page.locator('input[type="range"]').first();
  await slider.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const avant = await slider.inputValue();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  verifier(Number(await slider.inputValue()) > Number(avant), "Comparateur avant/après pilotable au clavier");
  const zone = page.locator(".cursor-ew-resize").first();
  const zb = await zone.boundingBox();
  await page.mouse.move(zb.x + zb.width * 0.2, zb.y + zb.height / 2);
  await page.mouse.down();
  await page.mouse.move(zb.x + zb.width * 0.15, zb.y + zb.height / 2);
  await page.mouse.up();
  verifier(Number(await slider.inputValue()) < 25, "Comparateur avant/après pilotable à la souris");

  // Galerie : changement d'onglet
  await page.getByRole("tab", { name: "Cave" }).click();
  await page.waitForTimeout(900);
  verifier((await page.getByRole("tab", { name: "Cave" }).getAttribute("aria-selected")) === "true", "Galerie avant/après : onglet Cave sélectionné");
  verifier(await page.getByText("Dessin d'illustration — en attente des photos de chantier").isVisible(), "Galerie avant/après : dessin explicitement légendé (aucun faux chantier)");

  // FAQ
  const q = page.getByRole("button", { name: "Le débarras peut-il être gratuit ?" });
  await q.scrollIntoViewIfNeeded();
  await q.click();
  await page.waitForTimeout(600);
  verifier((await q.getAttribute("aria-expanded")) === "true", "FAQ : la question s'ouvre");
  verifier(await page.getByText("Ce n'est pas systématique. Un débarras ne peut être gratuit").isVisible(), "FAQ : la réponse est visible");

  // Révélations au défilement : rien ne doit rester invisible après défilement complet
  for (let y = 0; y < 20000; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
  const restants = await page.evaluate(() => [...document.querySelectorAll("[data-reveal],[data-split],[data-reveal-img]")].filter((e) => !e.classList.contains("is-in")).map((e) => (e.textContent || e.tagName).trim().slice(0, 40)));
  verifier(restants.length === 0, `Animations au défilement : tous les éléments révélés (${restants.length} restant${restants.length ? " : " + restants.slice(0, 4).join(" | ") : ""})`);

  // ---------- 3. Mobile ----------
  const mob = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await mob.newPage();
  m.on("pageerror", (e) => erreursJs.push(`[mobile] ${m.url()} : ${e.message}`));
  for (const chemin of vus) {
    await m.goto(BASE + chemin, { waitUntil: "networkidle" });
    const deb = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    verifier(deb <= 0, `${chemin} : aucun débordement horizontal à 375 px (${deb})`);
  }
  await m.goto(BASE + "/", { waitUntil: "networkidle" });
  await m.screenshot({ path: "tests/captures/accueil-mobile.png" });
  await m.screenshot({ path: "tests/captures/accueil-mobile-complet.png", fullPage: true });
  const petits = await m.evaluate(() =>
    [...document.querySelectorAll("main a, main button, header button")]
      .filter((e) => e.offsetParent !== null && !e.closest(".prose-site,nav[aria-label=\"Fil d'Ariane\"],footer,li p,p"))
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height < 40).length,
  );
  verifier(petits === 0, `Mobile : cibles tactiles ≥ 40 px (${petits} trop petites)`);
  verifier(await m.locator("text=WhatsApp").last().isVisible(), "Mobile : barre d'action WhatsApp visible");
  await m.getByRole("button", { name: "Ouvrir le menu" }).click();
  await m.waitForTimeout(700);
  verifier(await m.locator("#menu-mobile").isVisible(), "Mobile : menu s'ouvre");
  await m.screenshot({ path: "tests/captures/menu-mobile.png" });
  await m.locator("#menu-mobile").getByRole("link", { name: "Débarras de cave" }).click();
  await m.waitForURL("**/debarras-cave/");
  await m.waitForTimeout(700);
  verifier(!(await m.locator("#menu-mobile").isVisible().catch(() => false)), "Mobile : menu se ferme après navigation");
  verifier((await m.locator("h1").textContent())?.includes("cave"), "Mobile : page Cave atteinte depuis le menu");

  // ---------- 4. Formulaire de devis : transmission réelle (faux service d'e-mail) ----------
  const f = await ctx.newPage();
  f.on("pageerror", (e) => erreursJs.push(`[devis] ${e.message}`));
  await f.goto(BASE + "/devis/?prestation=appartement", { waitUntil: "networkidle" });
  verifier(await f.getByRole("radio", { name: "Appartement" }).isChecked(), "Devis : prestation préremplie depuis l'URL");
  await f.getByRole("button", { name: /Continuer/ }).click();
  await f.waitForTimeout(500);
  await f.getByRole("button", { name: /Continuer/ }).click();
  await f.waitForTimeout(300);
  verifier(await f.getByText("Indiquez la ville du chantier.").isVisible(), "Devis : validation de l'étape 2 (ville)");
  verifier(await f.getByText("Le code postal comporte 5 chiffres").isVisible(), "Devis : validation de l'étape 2 (code postal)");
  await f.getByLabel("Ville *").fill("Montreuil");
  await f.getByLabel("Code postal *").fill("93100");
  verifier(!(await f.getByText("Indiquez la ville du chantier.").isVisible().catch(() => false)), "Devis : l'erreur disparaît après correction");
  await f.getByLabel("Étage").selectOption("4e étage");
  await f.getByLabel("Ascenseur").selectOption("Non");
  await f.getByLabel("Informations complémentaires").fill("Test automatisé — à ignorer.");
  await f.getByRole("button", { name: /Continuer/ }).click();
  await f.waitForTimeout(500);
  // photo PNG générée à la volée
  const png = pngTest();
  await f.locator('input[type="file"]').setInputFiles({ name: "salon.png", mimeType: "image/png", buffer: png });
  await f.waitForSelector('img[alt="Photo 1 sélectionnée"]');
  verifier(true, "Devis : photo ajoutée et prévisualisée");
  await f.getByRole("button", { name: /Continuer/ }).click();
  await f.waitForTimeout(500);
  await f.getByLabel("Nom *").fill("Testeur");
  await f.getByLabel("Téléphone *").fill("06 00 00 00 00");
  await f.getByRole("button", { name: /Envoyer ma demande/ }).click();
  await f.waitForTimeout(300);
  verifier(await f.getByText("Votre accord est nécessaire").isVisible(), "Devis : consentement obligatoire");
  await f.getByRole("checkbox").check();
  await f.screenshot({ path: "tests/captures/devis-etape4.png" });
  // double clic synchrone : la seconde soumission doit être ignorée
  await f.evaluate(() => {
    const b = [...document.querySelectorAll("button[type=submit]")].find((x) => x.textContent.includes("Envoyer ma demande"));
    b.click();
    b.click();
  });
  await f.waitForSelector("#confirmation-devis", { timeout: 15000 });
  const ref = await f.locator("#confirmation-devis strong").first().textContent();
  verifier(/^BTS-\d{6}-[A-Z0-9]{4}$/.test(ref ?? ""), `Devis : confirmation réelle avec référence ${ref}`);
  verifier(recus.length === 1, `Devis : une seule transmission malgré le double clic (${recus.length})`);
  const mail = recus[0]?.body ?? {};
  verifier(mail.to?.[0] === "devis@test.local" && mail.subject?.includes("Montreuil"), "Devis : e-mail adressé au destinataire configuré");
  verifier(mail.attachments?.length === 1 && mail.attachments[0].filename.endsWith(".jpg"), "Devis : photo jointe (recompressée en JPEG)");
  verifier(mail.text?.includes("4e étage") && mail.text?.includes("06 00 00 00 00"), "Devis : contenu complet transmis");
  await f.screenshot({ path: "tests/captures/devis-confirmation.png" });

  // API : rejet des fichiers non-image et du piège à robots
  const fd = new FormData();
  Object.entries({ prestation: "cave", ville: "Paris", codePostal: "75011", nom: "X Y", telephone: "0600000000", contact: "Téléphone", consentement: "true" }).forEach(([k, v]) => fd.append(k, v));
  fd.append("photos", new Blob(["<?php echo 1; ?>"], { type: "image/jpeg" }), "faux.jpg");
  const rFaux = await fetch(BASE + "/api/devis/", { method: "POST", body: fd });
  verifier(rFaux.status === 415, `API : fichier déguisé en image refusé (${rFaux.status})`);
  const fd2 = new FormData();
  fd2.append("site_web", "spam");
  const rBot = await fetch(BASE + "/api/devis/", { method: "POST", body: fd2 });
  verifier(rBot.status === 400 && recus.length === 1, "API : piège à robots, rien n'est transmis");

  // ---------- 5. Formulaire sans configuration : pas de faux succès ----------
  const g = await ctx.newPage();
  await g.goto("http://localhost:3101/devis/", { waitUntil: "networkidle" });
  await g.getByRole("radio", { name: "Cave" }).check({ force: true });
  await g.getByRole("button", { name: /Continuer/ }).click();
  await g.waitForTimeout(400);
  await g.getByLabel("Ville *").fill("Paris");
  await g.getByLabel("Code postal *").fill("75011");
  await g.getByRole("button", { name: /Continuer/ }).click();
  await g.waitForTimeout(400);
  await g.getByRole("button", { name: "Passer cette étape" }).click();
  await g.waitForTimeout(400);
  await g.getByLabel("Nom *").fill("Testeur");
  await g.getByLabel("Téléphone *").fill("0600000000");
  await g.getByRole("checkbox").check();
  await g.getByRole("button", { name: /Envoyer ma demande/ }).click();
  await g.waitForSelector("text=Votre demande n'a pas été transmise.", { timeout: 10000 });
  verifier((await g.locator("#confirmation-devis").count()) === 0, "Sans configuration : erreur affichée, aucune confirmation");

  // ---------- 6. Réduction des animations ----------
  const rm = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const r = await rm.newPage();
  await r.goto(BASE + "/debarras-maison/", { waitUntil: "networkidle" });
  const opa = await r.evaluate(() => [...document.querySelectorAll("[data-reveal]")].map((e) => getComputedStyle(e).opacity).filter((o) => o !== "1").length);
  verifier(opa === 0, "prefers-reduced-motion : contenu immédiatement visible");

  // ---------- 7. Absence de contenu inventé ----------
  const html = await (await fetch(BASE + "/")).text();
  verifier(!/AggregateRating|ratingValue/.test(html), "Aucun balisage de note agrégée");
  verifier(!/wa\.me\/\d/.test(html), "Aucun numéro WhatsApp inventé (numéro non configuré)");
  verifier(!/tel:\+?\d/.test(html), "Aucun numéro de téléphone inventé");
  verifier(!html.includes("Devis gratuit"), "« Devis gratuit » absent tant que non confirmé");

  verifier(erreursJs.length === 0, `Aucune erreur JavaScript${erreursJs.length ? " :\n   " + erreursJs.slice(0, 8).join("\n   ") : ""}`);
} catch (e) {
  console.error(e);
  echecs++;
} finally {
  await browser.close();
  s1.kill();
  s2.kill();
  mock.close();
}
console.log(echecs ? `\n${echecs} échec(s)` : "\nTous les tests passent.");
process.exit(echecs ? 1 : 0);
