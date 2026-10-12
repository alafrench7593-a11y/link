import { WordsReveal } from "../motion/WordsReveal";

export function Statement() {
  return (
    <section className="bg-mist py-24 md:py-40" aria-label="Notre métier">
      <div className="container-x">
        <WordsReveal
          className="max-w-5xl font-display text-[clamp(1.75rem,3.6vw,3.25rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-ink"
          texte="Vider une maison après une succession. Libérer un appartement avant une vente. Rendre un local à son propriétaire. Nous organisons le tri, la manutention et l'évacuation — vous décidez de ce qui part et de ce qui reste."
        />
      </div>
    </section>
  );
}
