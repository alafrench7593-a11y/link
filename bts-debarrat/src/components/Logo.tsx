import Link from "next/link";

/**
 * Logo BTS DÉBARRAT (fichiers vectoriels dans /public/brand, générés par scripts/logo.mjs).
 * Le premier « A » de DÉBARRAT est un toit ; la porte dessous figure l'espace libéré.
 */
export function Logo({ light = false, onClick, className = "h-[1.15rem]" }: { light?: boolean; onClick?: () => void; className?: string }) {
  return (
    <Link href="/" onClick={onClick} className="inline-flex items-center py-2" aria-label="BTS DÉBARRAT — retour à l'accueil">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light ? "/brand/logo-horizontal-sombre.svg" : "/brand/logo-horizontal.svg"} alt="BTS DÉBARRAT" width={220} height={20} className={`w-auto ${className}`} />
    </Link>
  );
}
