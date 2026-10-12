"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/track";
import { compresserPhoto } from "@/lib/compression";
import {
  ASCENSEUR, CONTACT_PREFERE, ENCOMBREMENT, ETAGES, LIMITES, TYPES_PRESTATION, VOLUMES,
  codePostalIdf, valider, vide, type DonneesDevis, type Erreurs,
} from "@/lib/devis";
import { IconArrow, IconCamera, IconCheck, IconWhatsApp } from "./Icons";

const ETAPES = ["Prestation", "Chantier", "Photos", "Coordonnées"] as const;
const BROUILLON = "bts-devis-brouillon";

type Photo = { id: string; file: File; url: string };
type Envoi = { etat: "repos" } | { etat: "envoi" } | { etat: "ok"; reference: string } | { etat: "erreur"; message: string };

export function QuoteForm({ prestationInitiale, whatsappNumero, telephone }: { prestationInitiale?: string; whatsappNumero: string | null; telephone: string | null }) {
  const [etape, setEtape] = useState(0);
  const [sens, setSens] = useState(1);
  const [d, setD] = useState<DonneesDevis>(vide);
  const [err, setErr] = useState<Erreurs>({});
  const [touche, setTouche] = useState<Partial<Record<keyof DonneesDevis, boolean>>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [traitement, setTraitement] = useState(false);
  const [envoi, setEnvoi] = useState<Envoi>({ etat: "repos" });
  const [honeypot, setHoneypot] = useState("");
  const commence = useRef(false);
  const enCours = useRef(false);
  const cle = useRef<string>("");
  const titre = useRef<HTMLHeadingElement>(null);
  const uid = useId();

  useEffect(() => {
    cle.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    track("devis_ouverture");
    let base = vide;
    try {
      const b = sessionStorage.getItem(BROUILLON);
      if (b) base = { ...vide, ...JSON.parse(b), consentement: false };
    } catch {}
    if (prestationInitiale && TYPES_PRESTATION.some((p) => p.id === prestationInitiale)) base = { ...base, prestation: prestationInitiale };
    setD(base);
  }, [prestationInitiale]);

  useEffect(() => {
    try {
      const { consentement: _c, ...reste } = d;
      sessionStorage.setItem(BROUILLON, JSON.stringify(reste));
    } catch {}
  }, [d]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = <K extends keyof DonneesDevis>(k: K, v: DonneesDevis[K]) => {
    if (!commence.current) {
      commence.current = true;
      track("devis_debut");
    }
    const next = { ...d, [k]: v };
    setD(next);
    // Une erreur affichée disparaît dès que la saisie devient correcte.
    if (err[k]) setErr((x) => ({ ...x, [k]: valider(next, "tout")[k] }));
  };

  const blur = (k: keyof DonneesDevis) => {
    setTouche((t) => ({ ...t, [k]: true }));
    const num = etape === 0 ? 1 : etape === 1 ? 2 : 4;
    const e = valider(d, num as 1 | 2 | 4);
    setErr((x) => ({ ...x, [k]: e[k] }));
  };

  const aller = (n: number) => {
    setSens(n > etape ? 1 : -1);
    setEtape(n);
    requestAnimationFrame(() => titre.current?.focus({ preventScroll: true }));
    document.getElementById("formulaire-devis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const suivant = () => {
    const num = etape === 0 ? 1 : etape === 1 ? 2 : etape === 3 ? 4 : null;
    if (num) {
      const e = valider(d, num as 1 | 2 | 4);
      setErr(e);
      const premier = Object.keys(e)[0];
      if (premier) {
        setTouche((t) => ({ ...t, ...Object.fromEntries(Object.keys(e).map((k) => [k, true])) }));
        requestAnimationFrame(() => document.getElementById(`${uid}-${premier}`)?.focus());
        return false;
      }
    }
    return true;
  };

  const ajouterPhotos = async (liste: FileList | null) => {
    if (!liste?.length) return;
    setPhotoMsg(null);
    const place = LIMITES.photos - photos.length;
    const fichiers = Array.from(liste).slice(0, Math.max(0, place));
    if (liste.length > place) setPhotoMsg(`${LIMITES.photos} photos maximum. Vous pourrez envoyer les autres sur WhatsApp.`);
    setTraitement(true);
    const ajout: Photo[] = [];
    for (const f of fichiers) {
      if (!f.type.startsWith("image/")) {
        setPhotoMsg(`« ${f.name} » n'est pas une image.`);
        continue;
      }
      try {
        const c = await compresserPhoto(f);
        ajout.push({ id: `${Date.now()}-${Math.random()}`, file: c, url: URL.createObjectURL(c) });
      } catch {
        setPhotoMsg(`« ${f.name} » n'a pas pu être lue. Essayez une photo au format JPEG ou PNG.`);
      }
    }
    setPhotos((p) => {
      const tout = [...p, ...ajout];
      let total = 0;
      const gardees: Photo[] = [];
      for (const ph of tout) {
        if (total + ph.file.size > LIMITES.octetsTotal) {
          URL.revokeObjectURL(ph.url);
          setPhotoMsg("Taille totale atteinte : envoyez les photos supplémentaires sur WhatsApp après votre demande.");
          continue;
        }
        total += ph.file.size;
        gardees.push(ph);
      }
      return gardees;
    });
    setTraitement(false);
  };

  const retirer = (id: string) =>
    setPhotos((p) => {
      const x = p.find((ph) => ph.id === id);
      if (x) URL.revokeObjectURL(x.url);
      return p.filter((ph) => ph.id !== id);
    });

  const envoyer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (enCours.current || envoi.etat === "ok") return; // protection contre la double soumission
    if (etape < 3) {
      if (suivant()) aller(etape + 1);
      return;
    }
    const e = valider(d, "tout");
    if (Object.keys(e).length) {
      setErr(e);
      setTouche(Object.fromEntries(Object.keys(e).map((k) => [k, true])));
      const premier = Object.keys(e)[0] as keyof DonneesDevis;
      const etapeErreur = premier === "prestation" ? 0 : ["ville", "codePostal", "surface", "infos", "date"].includes(premier) ? 1 : 3;
      if (etapeErreur !== etape) aller(etapeErreur);
      else requestAnimationFrame(() => document.getElementById(`${uid}-${premier}`)?.focus());
      return;
    }
    enCours.current = true;
    setEnvoi({ etat: "envoi" });
    const fd = new FormData();
    Object.entries(d).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("site_web", honeypot);
    fd.append("cle", cle.current);
    photos.forEach((p) => fd.append("photos", p.file, p.file.name));
    try {
      const res = await fetch("/api/devis/", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string; message?: string };
      if (res.ok && json.ok && json.reference) {
        setEnvoi({ etat: "ok", reference: json.reference });
        track("devis_transmis", { prestation: d.prestation });
        try {
          sessionStorage.removeItem(BROUILLON);
        } catch {}
        requestAnimationFrame(() => document.getElementById("confirmation-devis")?.focus());
      } else {
        setEnvoi({ etat: "erreur", message: json.message ?? "La demande n'a pas pu être transmise." });
      }
    } catch {
      setEnvoi({ etat: "erreur", message: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
    } finally {
      enCours.current = false;
    }
  };

  const lienWa = (reference?: string) => {
    if (!whatsappNumero) return null;
    const type = TYPES_PRESTATION.find((p) => p.id === d.prestation)?.label.toLowerCase() ?? "[type de bien]";
    const msg = reference
      ? `Bonjour BTS DÉBARRAT, je viens d'envoyer une demande de devis (référence ${reference}) pour un débarras (${type}) à ${d.ville || "[ville]"}. Je vous envoie mes photos ici.`
      : `Bonjour BTS DÉBARRAT, je souhaite obtenir un devis pour un débarras. Le type de bien est ${type} et la ville est ${d.ville || "[ville]"}. Pouvez-vous m'indiquer les informations nécessaires ?`;
    return `https://wa.me/${whatsappNumero}?text=${encodeURIComponent(msg)}`;
  };

  const champ = (k: keyof DonneesDevis) => ({
    id: `${uid}-${k}`,
    "aria-invalid": touche[k] && err[k] ? true : undefined,
    "aria-describedby": touche[k] && err[k] ? `${uid}-${k}-err` : undefined,
    onBlur: () => blur(k),
  });
  const erreur = (k: keyof DonneesDevis) =>
    touche[k] && err[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1.5 text-sm font-medium text-danger" role="alert">
        {err[k]}
      </p>
    ) : null;
  const input = "mt-2 block min-h-12 w-full rounded-xl border border-line bg-white px-4 text-[1rem] text-ink transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 aria-[invalid]:border-danger";
  const label = "block text-[0.92rem] font-semibold text-ink";

  if (envoi.etat === "ok") {
    const wa = lienWa(envoi.reference);
    return (
      <motion.div
        id="confirmation-devis"
        tabIndex={-1}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.5rem] border border-line bg-white p-8 text-center outline-none md:p-12"
        role="status"
      >
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }} className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-white">
          <IconCheck className="size-8" />
        </motion.span>
        <h2 className="mt-6 text-3xl font-extrabold">Demande transmise</h2>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
          Votre demande a bien été reçue par BTS DÉBARRAT{photos.length ? `, avec ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}. Référence : <strong className="text-ink">{envoi.reference}</strong>.
          Nous revenons vers vous par {d.contact.toLowerCase()}.
        </p>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" data-track="whatsapp_clic" data-track-label="confirmation-devis" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-wa px-6 font-semibold text-ink">
            <IconWhatsApp className="size-5" /> Poursuivre sur WhatsApp
          </a>
        )}
        <p className="mt-6 text-sm text-muted">
          <Link href="/" className="underline">Retour à l&apos;accueil</Link>
        </p>
      </motion.div>
    );
  }

  const progression = ((etape + 1) / ETAPES.length) * 100;

  return (
    <form id="formulaire-devis" noValidate onSubmit={envoyer} className="relative scroll-mt-28 overflow-hidden rounded-[1.5rem] border border-line bg-white shadow-[0_40px_80px_-50px_rgba(17,19,18,0.45)]">
      {/* progression */}
      <div className="border-b border-line p-5 md:px-8">
        <ol className="flex items-center justify-between gap-2" aria-label="Étapes du formulaire">
          {ETAPES.map((nom, i) => (
            <li key={nom} className="flex items-center gap-2 text-[0.8rem] font-semibold" aria-current={i === etape ? "step" : undefined}>
              <motion.span
                className="grid size-7 place-items-center rounded-full text-xs"
                animate={{ backgroundColor: i <= etape ? "#1d5a42" : "#f3f2ef", color: i <= etape ? "#ffffff" : "#555b58", scale: i === etape ? 1.1 : 1 }}
              >
                {i < etape ? <IconCheck className="size-3.5" /> : i + 1}
              </motion.span>
              <span className={`hidden sm:inline ${i === etape ? "text-ink" : "text-muted"}`}>{nom}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-mist" role="progressbar" aria-label="Progression" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression)}>
          <motion.div className="h-full origin-left rounded-full bg-accent" initial={false} animate={{ scaleX: progression / 100 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      </div>

      {/* piège à robots : invisible pour les humains */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Ne pas remplir
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="site_web" />
        </label>
      </div>

      <div className="relative p-5 md:p-8">
        <AnimatePresence mode="wait" initial={false} custom={sens}>
          <motion.fieldset
            key={etape}
            custom={sens}
            initial={{ opacity: 0, x: sens * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: sens * -40, transition: { duration: 0.2 } }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0"
          >
            <legend className="sr-only">{ETAPES[etape]}</legend>
            <h2 ref={titre} tabIndex={-1} className="text-[1.6rem] font-extrabold leading-tight outline-none">
              {["Quel lieu faut-il débarrasser ?", "Parlez-nous du chantier", "Ajoutez des photos (facultatif)", "Comment vous recontacter ?"][etape]}
            </h2>
            <p className="mt-1 text-sm text-muted">Étape {etape + 1} sur {ETAPES.length}</p>

            {etape === 0 && (
              <div className="mt-6">
                <div role="radiogroup" aria-labelledby={`${uid}-prestation-lbl`} id={`${uid}-prestation`} tabIndex={-1} className="grid grid-cols-2 gap-3 outline-none sm:grid-cols-4">
                  <span id={`${uid}-prestation-lbl`} className="sr-only">Type de prestation</span>
                  {TYPES_PRESTATION.map((p) => {
                    const sel = d.prestation === p.id;
                    return (
                      <label key={p.id} className={`relative flex min-h-16 cursor-pointer items-center justify-center rounded-xl border px-3 text-center text-[0.95rem] font-semibold transition-all duration-300 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${sel ? "border-accent bg-accent-soft text-accent-strong" : "border-line hover:border-ink/30"}`}>
                        <input type="radio" name="prestation" value={p.id} checked={sel} onChange={() => maj("prestation", p.id)} className="sr-only" />
                        {sel && <motion.span layoutId="choix-prestation" className="absolute inset-0 rounded-xl ring-2 ring-accent" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                        <span className="relative">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
                {err.prestation && <p className="mt-3 text-sm font-medium text-danger" role="alert">{err.prestation}</p>}
              </div>
            )}

            {etape === 1 && (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${uid}-ville`} className={label}>Ville *</label>
                  <input {...champ("ville")} className={input} value={d.ville} onChange={(e) => maj("ville", e.target.value)} autoComplete="address-level2" placeholder="ex. Montreuil" />
                  {erreur("ville")}
                </div>
                <div>
                  <label htmlFor={`${uid}-codePostal`} className={label}>Code postal *</label>
                  <input {...champ("codePostal")} className={input} value={d.codePostal} onChange={(e) => maj("codePostal", e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" autoComplete="postal-code" placeholder="ex. 93100" />
                  {erreur("codePostal")}
                  {/^\d{5}$/.test(d.codePostal) && !codePostalIdf(d.codePostal) && (
                    <p className="mt-1.5 text-sm text-muted">Ce code postal est hors Île-de-France : nous vous dirons si une intervention est envisageable.</p>
                  )}
                </div>
                <div>
                  <label htmlFor={`${uid}-surface`} className={label}>Surface approximative (m²)</label>
                  <input {...champ("surface")} className={input} value={d.surface} onChange={(e) => maj("surface", e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="ex. 45" />
                  {erreur("surface")}
                </div>
                <div>
                  <label htmlFor={`${uid}-volume`} className={label}>Volume estimé</label>
                  <select {...champ("volume")} className={input} value={d.volume} onChange={(e) => maj("volume", e.target.value)}>
                    <option value="">Choisir…</option>
                    {VOLUMES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-etage`} className={label}>Étage</label>
                  <select {...champ("etage")} className={input} value={d.etage} onChange={(e) => maj("etage", e.target.value)}>
                    <option value="">Choisir…</option>
                    {ETAGES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-ascenseur`} className={label}>Ascenseur</label>
                  <select {...champ("ascenseur")} className={input} value={d.ascenseur} onChange={(e) => maj("ascenseur", e.target.value)}>
                    <option value="">Choisir…</option>
                    {ASCENSEUR.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-encombrement`} className={label}>Niveau d&apos;encombrement</label>
                  <select {...champ("encombrement")} className={input} value={d.encombrement} onChange={(e) => maj("encombrement", e.target.value)}>
                    <option value="">Choisir…</option>
                    {ENCOMBREMENT.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${uid}-date`} className={label}>Date souhaitée</label>
                  <input {...champ("date")} type="date" className={input} value={d.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => maj("date", e.target.value)} />
                  <p className="mt-1.5 text-xs text-muted">Indicative : la date est confirmée avec le devis.</p>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${uid}-infos`} className={label}>Informations complémentaires</label>
                  <textarea {...champ("infos")} rows={4} className={`${input} py-3`} value={d.infos} onChange={(e) => maj("infos", e.target.value)} maxLength={LIMITES.texte} placeholder="Accès, stationnement, objets à conserver, contraintes de date…" />
                  {erreur("infos")}
                </div>
              </div>
            )}

            {etape === 2 && (
              <div className="mt-6">
                <label htmlFor={`${uid}-photos`} className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-mist/60 px-6 py-10 text-center transition-colors hover:border-accent hover:bg-accent-soft/50 has-[:focus-visible]:border-accent">
                  <span className="grid size-14 place-items-center rounded-full bg-white text-accent shadow-sm transition-transform duration-500 group-hover:-translate-y-1"><IconCamera className="size-7" /></span>
                  <span className="font-semibold">Ajouter des photos</span>
                  <span className="text-sm text-muted">Jusqu&apos;à {LIMITES.photos} photos · JPEG, PNG, WebP ou HEIC · réduites automatiquement avant envoi</span>
                  <input id={`${uid}-photos`} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { ajouterPhotos(e.target.files); e.target.value = ""; }} disabled={traitement || photos.length >= LIMITES.photos} />
                </label>
                <div aria-live="polite" className="mt-3 text-sm">
                  {traitement && <p className="text-muted">Préparation des photos…</p>}
                  {photoMsg && <p className="text-danger">{photoMsg}</p>}
                </div>
                {photos.length > 0 && (
                  <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    <AnimatePresence>
                      {photos.map((p, i) => (
                        <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="relative aspect-square overflow-hidden rounded-xl bg-mist">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={`Photo ${i + 1} sélectionnée`} className="size-full object-cover" />
                          <button type="button" onClick={() => retirer(p.id)} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink/80 text-white" aria-label={`Retirer la photo ${i + 1}`}>
                            <span aria-hidden>×</span>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
                <p className="mt-5 text-sm leading-relaxed text-muted">
                  Pas de photo sous la main ? Passez cette étape : vous pourrez les envoyer sur WhatsApp ensuite.
                </p>
              </div>
            )}

            {etape === 3 && (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${uid}-nom`} className={label}>Nom *</label>
                  <input {...champ("nom")} className={input} value={d.nom} onChange={(e) => maj("nom", e.target.value)} autoComplete="name" />
                  {erreur("nom")}
                </div>
                <div>
                  <label htmlFor={`${uid}-telephone`} className={label}>Téléphone *</label>
                  <input {...champ("telephone")} type="tel" className={input} value={d.telephone} onChange={(e) => maj("telephone", e.target.value)} autoComplete="tel" inputMode="tel" placeholder="06 12 34 56 78" />
                  {erreur("telephone")}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`${uid}-email`} className={label}>E-mail {d.contact === "E-mail" ? "*" : <span className="font-normal text-muted">(facultatif)</span>}</label>
                  <input {...champ("email")} type="email" className={input} value={d.email} onChange={(e) => maj("email", e.target.value)} autoComplete="email" />
                  {erreur("email")}
                </div>
                <fieldset className="sm:col-span-2">
                  <legend className={label}>Moyen de contact préféré</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CONTACT_PREFERE.map((c) => (
                      <label key={c} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${d.contact === c ? "border-ink bg-ink text-white" : "border-line hover:border-ink/40"}`}>
                        <input type="radio" name="contact" value={c} checked={d.contact === c} onChange={() => maj("contact", c)} className="sr-only" />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer gap-3 rounded-xl bg-mist p-4 text-[0.9rem] leading-relaxed">
                    <input
                      {...champ("consentement")}
                      type="checkbox"
                      checked={d.consentement}
                      onChange={(e) => maj("consentement", e.target.checked)}
                      className="mt-1 size-5 shrink-0 accent-[#1d5a42]"
                    />
                    <span>
                      J&apos;accepte que BTS DÉBARRAT utilise ces informations pour me recontacter au sujet de ma demande de devis. Elles ne sont ni revendues ni utilisées à d&apos;autres fins.{" "}
                      <Link href="/politique-de-confidentialite/" className="underline" target="_blank">Politique de confidentialité</Link>
                    </span>
                  </label>
                  {erreur("consentement")}
                </div>
              </div>
            )}
          </motion.fieldset>
        </AnimatePresence>

        {envoi.etat === "erreur" && (
          <div role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm leading-relaxed text-ink">
            <strong className="text-danger">Votre demande n&apos;a pas été transmise.</strong> {envoi.message}
            {(lienWa() || telephone) && <> Vous pouvez aussi nous joindre directement{lienWa() && <> sur <a className="font-semibold underline" href={lienWa()!} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}{telephone && <> au <a className="font-semibold underline" href={`tel:${telephone}`}>{telephone}</a></>}.</>}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {etape > 0 ? (
            <button type="button" onClick={() => aller(etape - 1)} className="min-h-12 rounded-full px-5 text-sm font-semibold text-muted hover:text-ink">
              ← Retour
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            {etape === 2 && photos.length === 0 && (
              <button type="button" onClick={() => aller(3)} className="min-h-12 rounded-full border border-line px-5 text-sm font-semibold hover:border-ink">
                Passer cette étape
              </button>
            )}
            <button
              type="submit"
              disabled={envoi.etat === "envoi" || traitement}
              className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 font-semibold text-white transition-[background-color,transform] hover:bg-accent-strong active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
            >
              {envoi.etat === "envoi" ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                  Transmission en cours…
                </>
              ) : etape < 3 ? (
                <>Continuer <IconArrow className="btn-arrow size-4" /></>
              ) : (
                <>Envoyer ma demande <IconArrow className="btn-arrow size-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
