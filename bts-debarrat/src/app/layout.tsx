import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingContact } from "@/components/FloatingContact";
import { MotionProviders } from "@/components/MotionProviders";
import { Analytics } from "@/components/Analytics";
import { ConfigBanner } from "@/components/ConfigBanner";
import { JsonLd } from "@/components/JsonLd";
import { site, siteUrl } from "@/config/site";
import { servicesAvecPage } from "@/config/services";
import { whatsappUrl, telUrl } from "@/lib/whatsapp";
import { localBusinessJsonLd } from "@/lib/seo";
import { libelleDevis } from "@/components/Buttons";

const display = localFont({
  src: "../../node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2",
  variable: "--font-display-face",
  weight: "100 900",
  display: "swap",
  preload: true,
});

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Entreprise de débarras en Île-de-France | BTS DÉBARRAT", template: "%s | BTS DÉBARRAT" },
  description:
    "Besoin de vider une maison, un appartement, une cave ou un local ? Présentez votre projet à BTS DÉBARRAT et demandez un devis.",
  applicationName: site.nom,
  formatDetection: { telephone: false },
  verification: site.googleSiteVerification ? { google: site.googleSiteVerification } : undefined,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f4f3ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const services = servicesAvecPage().map(({ slug, nomMenu, carte }) => ({ slug, nomMenu, carte }));
  return (
    <html lang="fr" className={`${display.variable} ${inter.variable}`}>
      <body className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <MotionProviders>
          <Header services={services} whatsapp={whatsappUrl()} devisLabel={libelleDevis()} banner={<ConfigBanner />} />
          <main id="contenu">{children}</main>
          <Footer />
          <FloatingContact whatsapp={whatsappUrl()} tel={telUrl()} devisLabel={libelleDevis()} />
        </MotionProviders>
        <Analytics fournisseur={site.analytics.fournisseur} identifiant={site.analytics.identifiant} />
        <JsonLd data={localBusinessJsonLd()} />
      </body>
    </html>
  );
}
