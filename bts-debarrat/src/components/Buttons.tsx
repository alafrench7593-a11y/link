import Link from "next/link";
import { IconArrow, IconPhone, IconWhatsApp } from "./Icons";
import { telUrl, whatsappUrl } from "@/lib/whatsapp";
import { site } from "@/config/site";

type Variant = "primary" | "dark" | "light" | "outline" | "outline-light" | "whatsapp";

const styles: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-3",
  dark: "bg-ink text-white hover:bg-ink-3",
  light: "bg-white text-ink hover:bg-mist",
  outline: "text-ink ring-1 ring-inset ring-ink/15 hover:ring-ink/40",
  "outline-light": "text-white ring-1 ring-inset ring-white/30 hover:ring-white/70",
  whatsapp: "bg-white text-ink ring-1 ring-inset ring-ink/12 hover:ring-ink/35",
};

export const btnBase =
  "group relative inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-[0.95rem] font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow,transform] duration-300 ease-[var(--ease-out-expo)] active:scale-[0.98]";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  arrow = true,
  className = "",
  track,
  trackLabel,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  arrow?: boolean;
  className?: string;
  track?: string;
  trackLabel?: string;
}) {
  return (
    <Link href={href} className={`${btnBase} ${styles[variant]} ${className}`} data-track={track} data-track-label={trackLabel}>
      <span>{children}</span>
      {arrow && <IconArrow className="btn-arrow size-4" />}
    </Link>
  );
}

/**
 * Bouton WhatsApp. Si le numéro n'est pas configuré, le bouton reste visible
 * mais mène à l'espace pro avec la mention « numéro à configurer » : aucun numéro n'est inventé.
 */
export function WhatsAppButton({
  message,
  children = "Envoyer mes photos sur WhatsApp",
  emplacement,
  className = "",
  compact = false,
}: {
  message?: string;
  children?: React.ReactNode;
  emplacement: string;
  className?: string;
  compact?: boolean;
}) {
  const url = whatsappUrl(message);
  const cls = `${btnBase} ${styles.whatsapp} ${compact ? "min-h-11 px-4 text-sm" : ""} ${className}`;
  if (!url) {
    return (
      <Link href="/espace-pro/#whatsapp" className={cls} title="Numéro WhatsApp à renseigner dans la configuration">
        <IconWhatsApp className="size-5 text-[#1fa855]" />
        <span>{children}</span>
        <span className="whitespace-nowrap rounded-full bg-mist-2 px-2 py-0.5 text-[0.62rem] font-medium text-muted">à configurer</span>
      </Link>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls} data-track="whatsapp_clic" data-track-label={emplacement}>
      <IconWhatsApp className="size-5 text-[#1fa855]" />
      <span>{children}</span>
      <span className="sr-only">(ouvre WhatsApp dans un nouvel onglet)</span>
    </a>
  );
}

export function PhoneButton({ emplacement, variant = "outline", className = "" }: { emplacement: string; variant?: Variant; className?: string }) {
  const url = telUrl();
  const cls = `${btnBase} ${styles[variant]} ${className}`;
  if (!url || !site.telephone) {
    return (
      <Link href="/espace-pro/#telephone" className={cls} title="Numéro de téléphone à renseigner dans la configuration">
        <IconPhone className="size-5" />
        <span>Appeler</span>
        <span className="whitespace-nowrap rounded-full px-1 text-[0.62rem] font-medium opacity-60">à configurer</span>
      </Link>
    );
  }
  return (
    <a href={url} className={cls} data-track="telephone_clic" data-track-label={emplacement}>
      <IconPhone className="size-5" />
      <span>{site.telephone}</span>
    </a>
  );
}

export const libelleDevis = () => (site.confirmations.devisGratuit ? "Demander un devis gratuit" : "Demander un devis");
