import Image from "next/image";
import { RoomIllustration } from "./RoomIllustration";
import type { IllustrationKind } from "@/config/services";

/** Photo réelle si fournie, sinon illustration étiquetée « Photo à fournir ». */
export function Visual({
  photo,
  alt,
  kind,
  state = "avant",
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
  tag = "Illustration — photo réelle à fournir",
  className = "",
}: {
  photo: string | null;
  alt: string | null;
  kind: IllustrationKind;
  state?: "avant" | "apres";
  sizes?: string;
  priority?: boolean;
  tag?: string | null;
  className?: string;
}) {
  if (photo) {
    return <Image src={photo} alt={alt ?? ""} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
  }
  return (
    <>
      <RoomIllustration kind={kind} state={state} className={`absolute inset-0 size-full ${className}`} />
      {tag && <span className="placeholder-tag">{tag}</span>}
    </>
  );
}
