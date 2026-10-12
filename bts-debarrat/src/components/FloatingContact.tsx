"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { IconPhone, IconWhatsApp } from "./Icons";

/**
 * Desktop : bouton WhatsApp flottant. Mobile : barre d'action en bas d'écran
 * (Devis · WhatsApp · Appeler). Le contenu reçoit un espace en bas pour ne rien masquer,
 * et la barre se retire au-dessus du pied de page.
 */
export function FloatingContact({ whatsapp, tel, devisLabel }: { whatsapp: string | null; tel: string | null; devisLabel: string }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [footer, setFooter] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const f = document.querySelector("footer");
    const io = f ? new IntersectionObserver(([e]) => setFooter(e.isIntersecting), { threshold: 0.05 }) : null;
    if (f && io) io.observe(f);
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, [pathname]);

  const surDevis = pathname.startsWith("/devis");
  const montrer = visible && !footer;

  return (
    <>
      <AnimatePresence>
        {montrer && whatsapp && (
          <motion.a
            key="fab"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Envoyer mes photos sur WhatsApp (nouvel onglet)"
            data-track="whatsapp_clic"
            data-track-label="bouton-flottant"
            className="pulse-ring group fixed bottom-6 right-6 z-30 hidden h-14 items-center gap-3 rounded-full bg-wa pl-4 pr-5 text-ink shadow-[0_18px_40px_-14px_rgba(17,19,18,0.55)] md:flex"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.9 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
          >
            <IconWhatsApp className="size-6" />
            <span className="text-sm font-semibold">Photos sur WhatsApp</span>
          </motion.a>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!footer && (
          <motion.div
            key="bar"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl md:hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              {surDevis ? (
                <span className="flex min-h-12 items-center justify-center rounded-full bg-mist px-3 text-sm font-semibold text-muted">Formulaire en cours</span>
              ) : (
                <Link href="/devis/" className="flex min-h-12 items-center justify-center rounded-full bg-ink px-3 text-sm font-semibold text-white">
                  {devisLabel}
                </Link>
              )}
              <a
                href={whatsapp ?? "/espace-pro/#whatsapp"}
                {...(whatsapp ? { target: "_blank", rel: "noopener noreferrer", "data-track": "whatsapp_clic", "data-track-label": "barre-mobile" } : {})}
                className="flex min-h-12 items-center gap-2 rounded-full bg-wa px-4 text-sm font-semibold text-ink"
                aria-label={whatsapp ? "WhatsApp (nouvel onglet)" : "WhatsApp — numéro à configurer"}
              >
                <IconWhatsApp className="size-5" />
                WhatsApp
              </a>
              <a
                href={tel ?? "/espace-pro/#telephone"}
                {...(tel ? { "data-track": "telephone_clic", "data-track-label": "barre-mobile" } : {})}
                className="grid size-12 place-items-center rounded-full border border-line text-ink"
                aria-label={tel ? "Appeler BTS DÉBARRAT" : "Téléphone — numéro à configurer"}
              >
                <IconPhone className="size-5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
