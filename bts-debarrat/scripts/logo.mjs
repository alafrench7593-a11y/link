/**
 * Génère le système de logo BTS DÉBARRAT en SVG (texte vectorisé, aucune police requise à l'affichage).
 *   node scripts/logo.mjs
 * Principe : le premier « A » de DÉBARRAT devient un toit ; dessous, une porte ouverte —
 * l'espace libéré. Ce signe, isolé, forme le symbole de la marque.
 */
import opentype from "opentype.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const font = opentype.parse(readFileSync("node_modules/@fontsource/jost/files/jost-latin-500-normal.woff").buffer);
const OUT = "public/brand";
mkdirSync(OUT, { recursive: true });

const INK = "#17181A";
const OCRE = "#B0823E";
const PAPER = "#F4F3EF";

const UPM = 1000; // on travaille à 1000 unités = 1 em
const SIZE = 1000;
const capH = font.charToGlyph("H").getBoundingBox().y2 / font.unitsPerEm * SIZE;
const stem = (() => {
  const b = font.charToGlyph("I").getBoundingBox();
  return ((b.x2 - b.x1) / font.unitsPerEm) * SIZE;
})();
const TRACK = 0.16 * SIZE; // interlettrage large, lisible de loin (véhicule, vêtements)

/**
 * Le signe : toit plein (chevron coupé net à la ligne de base) + porte pleine.
 * x = bord gauche, y = ligne de base, h = hauteur. Renvoie { svg, width }.
 */
function signe(x, y, h, couleurToit, couleurPorte, epaisseur = 1) {
  const w = h * 1.16;
  const t = stem * (h / capH) * epaisseur; // épaisseur du toit, alignée sur le fût des lettres
  const ax = x + w / 2;
  const ay = y - h;
  const pente = h / (w / 2);
  // Décalage horizontal du bord intérieur pour une épaisseur constante perpendiculaire à la pente.
  const dx = t * Math.sqrt(1 + pente * pente) / pente;
  const dy = t * Math.sqrt(1 + 1 / (pente * pente)) * pente / pente;
  const toit = `M${x} ${y} L${ax} ${ay} L${x + w} ${y} H${x + w - dx} L${ax} ${ay + dy * 1.0} L${x + dx} ${y} Z`;
  const pw = w * 0.2;
  const ph = h * 0.4;
  const porte = `M${ax - pw / 2} ${y} V${y - ph} H${ax + pw / 2} V${y} Z`;
  const svg = `<path d="${toit}" fill="${couleurToit}"/><path d="${porte}" fill="${couleurPorte}"/>`;
  return { svg, width: w };
}

/** Texte vectorisé avec interlettrage ; `remplacerA` = index du caractère remplacé par le signe. */
function mot(texte, x, y, couleur, accent, remplacerA = -1, couleurPorte = couleur) {
  let cx = x;
  let svg = "";
  [...texte].forEach((ch, i) => {
    if (ch === " ") {
      cx += SIZE * 0.32 + TRACK;
      return;
    }
    if (i === remplacerA) {
      // Compensation optique : le toit est plus large qu'une capitale, on resserre ses approches.
      const s = signe(cx - SIZE * 0.035, y, capH, accent, couleurPorte, 1.12);
      svg += s.svg;
      cx += s.width - SIZE * 0.07 + TRACK;
      return;
    }
    const g = font.charToGlyph(ch);
    const p = g.getPath(cx, y, SIZE);
    svg += `<path d="${p.toPathData(2)}" fill="${couleur}"/>`;
    cx += (g.advanceWidth / font.unitsPerEm) * SIZE + TRACK;
  });
  return { svg, width: cx - x - TRACK };
}

const fichier = (nom, w, h, contenu, fond) =>
  writeFileSync(
    `${OUT}/${nom}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="BTS DÉBARRAT">${fond ? `<rect width="100%" height="100%" fill="${fond}"/>` : ""}${contenu}</svg>\n`,
  );

const TEXTE = "BTS DÉBARRAT";
const INDEX_A = TEXTE.indexOf("A"); // premier A de DÉBARRAT
const pad = capH * 0.25;

// 1. Horizontale (claire / sombre / monochrome)
for (const [nom, c, a, porte, fond] of [
  ["logo-horizontal", INK, OCRE, INK, null],
  ["logo-horizontal-sombre", "#FFFFFF", OCRE, "#FFFFFF", null],
  ["logo-horizontal-mono-noir", INK, INK, INK, null],
  ["logo-horizontal-mono-blanc", "#FFFFFF", "#FFFFFF", "#FFFFFF", null],
]) {
  const m = mot(TEXTE, pad, pad + capH, c, a, INDEX_A, porte);
  fichier(nom, m.width + pad * 2, capH + pad * 2, m.svg, fond);
}

// 2. Compacte : symbole au-dessus, nom sur deux lignes
for (const [nom, c, a] of [["logo-compact", INK, OCRE], ["logo-compact-sombre", "#FFFFFF", OCRE]]) {
  const hs = capH * 2.4;
  const bts = mot("BTS", 0, 0, c, a);
  const deb = mot("DÉBARRAT", 0, 0, c, a);
  const W = Math.max(bts.width, deb.width) + pad * 2;
  const s = signe(W / 2 - (hs * 1.16) / 2, pad + hs, hs, a, c);
  const y1 = pad + hs + capH * 1.0 + capH;
  const l1 = mot("BTS", W / 2 - bts.width / 2, y1, c, a);
  const l2 = mot("DÉBARRAT", W / 2 - deb.width / 2, y1 + capH * 1.55, c, a);
  fichier(nom, W, y1 + capH * 1.55 + pad, s.svg + l1.svg + l2.svg);
}

// 3. Symbole seul (+ favicon sur fond)
{
  const h = 1000;
  const hs = h * 0.66;
  const x0 = 500 - (hs * 1.16) / 2;
  const s = signe(x0, 500 + hs / 2, hs, OCRE, INK);
  fichier("symbole", 1000, 1000, s.svg, null);
  const hf = 560;
  const sf = signe(500 - (hf * 1.16) / 2, 500 + hf / 2 + 10, hf, OCRE, "#FFFFFF", 1.35);
  fichier("favicon", 1000, 1000, `<rect width="1000" height="1000" rx="220" fill="${INK}"/>` + sf.svg);
  const sm = signe(x0, 500 + hs / 2, hs, INK, INK);
  fichier("symbole-mono-noir", 1000, 1000, sm.svg);
  const sb = signe(x0, 500 + hs / 2, hs, "#FFFFFF", "#FFFFFF");
  fichier("symbole-mono-blanc", 1000, 1000, sb.svg, INK);
  fichier("symbole-sombre", 1000, 1000, signe(x0, 500 + hs / 2, hs, OCRE, "#FFFFFF").svg, INK);
}

// 4. Pistes explorées (pour la page /marque/)
{
  // Piste 2 : monogramme BTS sous un toit
  const b = mot("BTS", 0, 0, INK, OCRE);
  const W = b.width + pad * 4;
  const toitH = capH * 0.7;
  const sw = stem;
  const yB = pad + toitH + capH * 0.35 + capH;
  const l = mot("BTS", W / 2 - b.width / 2, yB, INK, OCRE);
  const toit = `<path d="M${pad} ${pad + toitH} L${W / 2} ${pad} L${W - pad} ${pad + toitH}" fill="none" stroke="${OCRE}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
  fichier("piste-2-monogramme", W, yB + pad, toit + l.svg);

  // Piste 3 : encombré → dégagé (trois volumes à gauche, espace libre à droite, sous un même toit)
  const S = 1000;
  const c = 90;
  const base = 860 - stem * 0.55;
  const boites = [
    [175, base, 170, 170],
    [175, base - 185, 170, 170],
    [360, base, 170, 170],
  ]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${INK}"/>`)
    .join("");
  fichier(
    "piste-3-espace",
    S,
    S,
    `<path d="M${c} 420 L500 ${c + 40} L${S - c} 420 V860 H${c} Z" fill="none" stroke="${INK}" stroke-width="${stem * 1.1}" stroke-linejoin="miter"/>` +
      boites +
      `<rect x="600" y="700" width="230" height="160" fill="${OCRE}" opacity="0"/>`,
  );
}

console.log(`Logos écrits dans ${OUT}/ (hauteur de capitale ${capH.toFixed(0)}, fût ${stem.toFixed(0)})`);
