import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site";

/** Logotype. Remplacé automatiquement par site.logo dès qu'il est fourni. */
export function Logo({ light = false, onClick }: { light?: boolean; onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="group flex items-center gap-2.5" aria-label="BTS DÉBARRAT — retour à l'accueil">
      {site.logo ? (
        <Image src={site.logo} alt="BTS DÉBARRAT" width={160} height={40} className="h-9 w-auto" priority />
      ) : (
        <>
          <span
            className={`grid size-9 place-items-center rounded-[0.6rem] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-[-8deg] ${light ? "bg-white text-ink" : "bg-ink text-white"}`}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
              <path d="M4 10.5 12 4l8 6.5V20H4z" />
              <path d="M9 20v-5h6v5" className="text-accent-bright" stroke="currentColor" />
            </svg>
          </span>
          <span className={`font-display text-[1.05rem] font-extrabold leading-none tracking-[-0.02em] ${light ? "text-white" : "text-ink"}`}>
            BTS <span className={light ? "text-accent-bright" : "text-accent"}>DÉBARRAT</span>
          </span>
        </>
      )}
    </Link>
  );
}
