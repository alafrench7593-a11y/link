import type { Metadata } from "next";

export const metadata: Metadata = { title: "Identité BTS DÉBARRAT", robots: { index: false, follow: false } };

const Bloc = ({ titre, fichier, fond = "bg-white", h = "h-16" }: { titre: string; fichier: string; fond?: string; h?: string }) => (
  <figure>
    <div className={`grid min-h-48 place-items-center rounded-2xl p-10 ${fond}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${fichier}`} alt={titre} className={`${h} w-auto max-w-full`} />
    </div>
    <figcaption className="mt-3 flex justify-between text-[0.85rem] text-muted">
      <span>{titre}</span>
      <a href={`/brand/${fichier}`} download className="underline">SVG</a>
    </figcaption>
  </figure>
);

/** Planche d'identité (non indexée) : logo, déclinaisons, couleurs, pistes explorées. */
export default function Marque() {
  return (
    <div className="bg-mist pb-24 pt-28">
      <div className="container-x">
        <p className="text-[0.92rem] text-muted">Page interne · non indexée</p>
        <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,4rem)] font-semibold tracking-[-0.045em]">Identité BTS DÉBARRAT</h1>
        <p className="mt-5 max-w-2xl leading-relaxed text-muted">
          Le premier « A » de DÉBARRAT devient un toit ; dessous, une porte ouverte : l&apos;espace libéré. Ce signe isolé forme le symbole, lisible du favicon (16 px) au flanc d&apos;un utilitaire. Lettres vectorisées (Jost), aucune police requise.
        </p>

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-[-0.03em]">Logo retenu</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Bloc titre="Horizontal — fond clair" fichier="logo-horizontal.svg" h="h-10" />
          <Bloc titre="Horizontal — fond sombre" fichier="logo-horizontal-sombre.svg" fond="bg-ink" h="h-10" />
          <Bloc titre="Compact" fichier="logo-compact.svg" h="h-40" />
          <Bloc titre="Compact — fond sombre" fichier="logo-compact-sombre.svg" fond="bg-ink" h="h-40" />
          <Bloc titre="Symbole" fichier="symbole.svg" h="h-32" />
          <Bloc titre="Favicon / icône d'application" fichier="favicon.svg" h="h-24" />
          <Bloc titre="Monochrome noir (gravure, tampon, broderie)" fichier="logo-horizontal-mono-noir.svg" h="h-10" />
          <Bloc titre="Monochrome blanc (vêtements foncés, véhicule)" fichier="logo-horizontal-mono-blanc.svg" fond="bg-ink" h="h-10" />
        </div>

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-[-0.03em]">Couleurs</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[["Anthracite", "#17181A"], ["Blanc cassé", "#F4F3EF"], ["Gris minéral", "#8C8F91"], ["Ocre (logo)", "#B0823E"], ["Ocre texte", "#8A6428"]].map(([n, c]) => (
            <li key={c}>
              <div className="h-24 rounded-xl ring-1 ring-ink/10" style={{ background: c }} />
              <p className="mt-2 text-[0.85rem]">{n} <span className="text-muted">{c}</span></p>
            </li>
          ))}
        </ul>

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-[-0.03em]">Pistes explorées</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <Bloc titre="1 · Maison et porte ouverte (retenue)" fichier="symbole.svg" h="h-28" />
          <Bloc titre="2 · Monogramme BTS sous un toit" fichier="piste-2-monogramme.svg" h="h-28" />
          <Bloc titre="3 · Encombré → dégagé" fichier="piste-3-espace.svg" h="h-28" />
        </div>
        <p className="mt-4 max-w-2xl text-[0.92rem] leading-relaxed text-muted">
          La piste 2 dépend d&apos;un sigle peu connu du public ; la piste 3 perd ses détails sous 32 px. La piste 1 reste lisible partout et relie directement le nom au métier.
        </p>
      </div>
    </div>
  );
}
