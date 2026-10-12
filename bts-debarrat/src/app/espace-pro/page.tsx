import type { Metadata } from "next";
import { checklist } from "@/config/checklist";
import { CopyMessage } from "@/components/CopyMessage";
import { Testimonials } from "@/components/Testimonials";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Espace pro — préparation de la mise en ligne", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const messageAvis = (lien: string | null) =>
  `Bonjour, nous espérons que notre intervention vous a apporté satisfaction. Si vous avez quelques instants, votre retour nous aiderait à améliorer nos services et à faire connaître BTS DÉBARRAT. Vous pouvez partager votre expérience ici : ${lien ?? "[LIEN_AVIS_GOOGLE]"}. Merci pour votre confiance.`;

export default function EspacePro() {
  const points = checklist();
  const bloquants = points.filter((p) => p.bloquant && !p.ok).length;
  return (
    <div className="bg-mist pb-24 pt-32">
      <div className="container-x max-w-4xl">
        <p className="eyebrow text-accent">Page interne · non indexée</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] font-display">Préparation de la mise en ligne</h1>
        <p className="mt-3 text-muted">
          {bloquants ? `${bloquants} point(s) bloquant(s) restent à compléter avant publication.` : "Tous les points bloquants sont renseignés."} Les valeurs se modifient dans <code>src/config/</code> et dans les variables d&apos;environnement.
        </p>

        <ul className="mt-10 divide-y divide-line overflow-hidden rounded-2xl bg-white">
          {points.map((p) => (
            <li key={p.id} id={p.id} className="flex scroll-mt-32 items-start gap-4 p-5">
              <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${p.ok ? "bg-accent text-white" : p.bloquant ? "bg-danger text-white" : "bg-[#f6d77a]"}`} aria-hidden>
                {p.ok ? "✓" : "!"}
              </span>
              <div>
                <p className="font-semibold">
                  {p.libelle} {!p.ok && <span className="text-sm font-normal text-muted">— {p.bloquant ? "obligatoire" : "recommandé"}</span>}
                  <span className="sr-only">{p.ok ? " (renseigné)" : " (manquant)"}</span>
                </p>
                <p className="mt-1 text-sm text-muted">{p.aide}</p>
              </div>
            </li>
          ))}
        </ul>

        <h2 className="mt-16 text-2xl font-semibold tracking-[-0.03em] font-display">Message de demande d&apos;avis</h2>
        <p className="mt-2 text-sm text-muted">
          À envoyer à chaque client après l&apos;intervention, quel que soit son niveau de satisfaction. Ne jamais proposer de contrepartie ni solliciter uniquement les clients satisfaits.
        </p>
        <div className="mt-5"><CopyMessage texte={messageAvis(site.lienAvisGoogle)} /></div>

        <h2 className="mt-16 text-2xl font-semibold tracking-[-0.03em] font-display">Aperçu du bloc « avis » (données fictives)</h2>
        <p className="mt-2 text-sm text-muted">Visible uniquement ici, pour juger de la mise en page. Ce contenu n&apos;apparaît sur aucune page publique.</p>
        <div className="mt-6">
          <Testimonials
            exemple
            avis={[1, 2, 3].map((n) => ({
              auteur: `Prénom ${n}`,
              note: 5,
              texte: "Texte d'exemple : ici s'affichera le témoignage réel du client, tel qu'il l'a rédigé.",
              prestation: "Type de prestation",
              ville: "Ville",
              date: "2026-01-01",
              source: "Source de l'avis",
              lienSource: null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
