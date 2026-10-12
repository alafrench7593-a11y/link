import Image from "next/image";
import { photos, type PhotoId } from "@/config/photos";
import { RoomIllustration } from "./RoomIllustration";
import type { IllustrationKind } from "@/config/services";

const dessin: Record<PhotoId, IllustrationKind> = {
  hero: "appartement", equipe: "appartement", vide: "appartement", maison: "maison", appartement: "appartement", cave: "cave",
  grenier: "grenier", garage: "garage", succession: "maison", bureaux: "bureau", commerce: "commerce", contact: "appartement",
};

/**
 * Affiche la photo de l'emplacement `id`.
 * - Photo de banque d'images : légende « Photo d'illustration » (jamais présentée comme un chantier).
 * - Pas encore de fichier : dessin monochrome + légende « Photo à venir », sans rien simuler.
 * Le parent doit être positionné (relative) et dimensionné.
 */
export function Photo({
  id,
  sizes = "100vw",
  priority = false,
  legende = true,
  className = "",
}: {
  id: PhotoId;
  sizes?: string;
  priority?: boolean;
  legende?: boolean;
  className?: string;
}) {
  const p = photos[id];
  if (p.src) {
    return (
      <>
        <Image src={p.src} alt={p.alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />
        {legende && p.demonstration && (
          <span className="placeholder-tag" title={p.credit ? `${p.credit.auteur} — ${p.credit.licence}` : undefined}>
            Photo d&apos;illustration
          </span>
        )}
      </>
    );
  }
  return (
    <>
      <RoomIllustration kind={dessin[id]} state={id === "vide" || id === "contact" ? "apres" : "avant"} className={`absolute inset-0 size-full ${className}`} title={`Emplacement photo : ${p.sujet}`} />
      {legende && <span className="placeholder-tag">Photo à venir · {p.sujet}</span>}
    </>
  );
}
