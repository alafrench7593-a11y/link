import Link from "next/link";
import { pointsBloquantsManquants } from "@/config/checklist";

/** Signale les informations obligatoires manquantes avant la mise en ligne. */
export function ConfigBanner() {
  const manquants = pointsBloquantsManquants();
  if (!manquants.length) return null;
  return (
    <div className="relative z-[60] bg-[#f6d77a] text-ink">
      <div className="container-x flex items-center justify-between gap-4 py-1.5 text-[0.78rem] font-medium">
        <p className="truncate">
          <strong>Préparation :</strong> {manquants.length} info{manquants.length > 1 ? "s" : ""} obligatoire{manquants.length > 1 ? "s" : ""} à fournir<span className="hidden sm:inline"> avant la mise en ligne</span>
        </p>
        <Link href="/espace-pro/" className="shrink-0 underline underline-offset-2">Voir</Link>
      </div>
    </div>
  );
}
