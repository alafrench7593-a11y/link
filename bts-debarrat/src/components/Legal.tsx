/** Affiche une valeur de configuration, ou un marqueur visible si elle manque. */
export function V({ v }: { v: string | null | undefined }) {
  return v ? <>{v}</> : <mark className="rounded bg-[#f6d77a] px-1.5 font-semibold text-ink">[À compléter avant publication]</mark>;
}
