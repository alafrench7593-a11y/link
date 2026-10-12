import { NextResponse } from "next/server";
import { LIMITES, TYPES_PRESTATION, valider, vide, type DonneesDevis } from "@/lib/devis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Réception d'une demande de devis et transmission par e-mail (Resend).
 * Aucune donnée n'est stockée par le site : la demande est envoyée à DEVIS_DESTINATAIRE.
 * Si la transmission n'est pas configurée ou échoue, une erreur est renvoyée —
 * jamais de faux message de succès.
 */

const recents = new Map<string, number>(); // clé d'idempotence → horodatage
const parIp = new Map<string, number[]>();

function limiteDepassee(ip: string) {
  const maintenant = Date.now();
  const liste = (parIp.get(ip) ?? []).filter((t) => maintenant - t < 10 * 60_000);
  liste.push(maintenant);
  parIp.set(ip, liste);
  return liste.length > 5;
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function signatureImage(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

const erreur = (status: number, message: string) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnue";
  if (limiteDepassee(ip)) return erreur(429, "Trop de demandes envoyées en peu de temps. Réessayez dans quelques minutes.");

  const longueur = Number(req.headers.get("content-length") ?? 0);
  if (longueur > LIMITES.octetsTotal + 400_000) return erreur(413, "Les photos sont trop lourdes. Retirez-en une ou envoyez-les sur WhatsApp.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return erreur(400, "Formulaire illisible.");
  }

  // Piège à robots rempli : on répond sans rien transmettre ni prétendre l'avoir fait côté client humain.
  if (String(form.get("site_web") ?? "")) return erreur(400, "Demande refusée.");

  const cle = String(form.get("cle") ?? "").slice(0, 80);
  if (cle && recents.has(cle)) return erreur(409, "Cette demande a déjà été envoyée.");

  const d: DonneesDevis = { ...vide };
  (Object.keys(vide) as (keyof DonneesDevis)[]).forEach((k) => {
    const v = form.get(k);
    if (k === "consentement") d.consentement = v === "true";
    else (d[k] as string) = typeof v === "string" ? v.trim().slice(0, k === "infos" ? LIMITES.texte : 200) : "";
  });
  const erreurs = valider(d, "tout");
  if (Object.keys(erreurs).length) return erreur(422, Object.values(erreurs)[0]!);

  const fichiers = form.getAll("photos").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (fichiers.length > LIMITES.photos) return erreur(422, `${LIMITES.photos} photos maximum.`);
  let total = 0;
  const pieces: { filename: string; content: string }[] = [];
  for (const [i, f] of fichiers.entries()) {
    if (f.size > LIMITES.octetsParPhoto) return erreur(413, "Une photo dépasse la taille autorisée.");
    total += f.size;
    if (total > LIMITES.octetsTotal) return erreur(413, "Le poids total des photos est trop élevé.");
    const octets = new Uint8Array(await f.arrayBuffer());
    const ext = signatureImage(octets);
    if (!ext) return erreur(415, "Un fichier joint n'est pas une image valide.");
    pieces.push({ filename: `photo-${i + 1}.${ext}`, content: Buffer.from(octets).toString("base64") });
  }

  const { RESEND_API_KEY, DEVIS_DESTINATAIRE, DEVIS_EXPEDITEUR } = process.env;
  if (!RESEND_API_KEY || !DEVIS_DESTINATAIRE || !DEVIS_EXPEDITEUR) {
    console.error("[devis] Transmission non configurée : RESEND_API_KEY, DEVIS_DESTINATAIRE ou DEVIS_EXPEDITEUR manquant.");
    return erreur(503, "Le formulaire n'est pas encore relié à notre messagerie.");
  }

  const reference = `BTS-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const type = TYPES_PRESTATION.find((p) => p.id === d.prestation)?.label ?? d.prestation;
  const lignes: [string, string][] = [
    ["Référence", reference],
    ["Prestation", type],
    ["Ville", `${d.ville} (${d.codePostal})`],
    ["Surface", d.surface ? `${d.surface} m²` : "—"],
    ["Volume estimé", d.volume || "—"],
    ["Étage", d.etage || "—"],
    ["Ascenseur", d.ascenseur || "—"],
    ["Encombrement", d.encombrement || "—"],
    ["Date souhaitée", d.date || "—"],
    ["Nom", d.nom],
    ["Téléphone", d.telephone],
    ["E-mail", d.email || "—"],
    ["Contact préféré", d.contact],
    ["Photos jointes", String(pieces.length)],
    ["Consentement", "Oui — recontact au sujet de la demande"],
  ];
  const html = `<h2>Nouvelle demande de devis — ${echapper(reference)}</h2><table cellpadding="6" style="border-collapse:collapse">${lignes
    .map(([k, v]) => `<tr><td style="color:#555"><b>${echapper(k)}</b></td><td>${echapper(v)}</td></tr>`)
    .join("")}</table><h3>Informations complémentaires</h3><p style="white-space:pre-wrap">${echapper(d.infos || "—")}</p>`;
  const text = `${lignes.map(([k, v]) => `${k} : ${v}`).join("\n")}\n\nInformations complémentaires :\n${d.infos || "—"}`;

  try {
    // RESEND_API_URL ne sert qu'aux tests automatisés (serveur factice) ; en production, la laisser vide.
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": cle || reference },
      body: JSON.stringify({
        from: DEVIS_EXPEDITEUR,
        to: DEVIS_DESTINATAIRE.split(",").map((s) => s.trim()),
        reply_to: d.email || undefined,
        subject: `Devis ${type} — ${d.ville} — ${reference}`,
        html,
        text,
        attachments: pieces.length ? pieces : undefined,
      }),
    });
    if (!res.ok) {
      console.error("[devis] Échec Resend", res.status, await res.text().catch(() => ""));
      return erreur(502, "Notre messagerie n'a pas accepté la demande. Réessayez ou contactez-nous directement.");
    }
  } catch (e) {
    console.error("[devis] Erreur réseau Resend", e);
    return erreur(502, "Notre messagerie est momentanément injoignable. Réessayez ou contactez-nous directement.");
  }

  if (cle) {
    recents.set(cle, Date.now());
    if (recents.size > 500) recents.delete(recents.keys().next().value!);
  }
  return NextResponse.json({ ok: true, reference });
}
