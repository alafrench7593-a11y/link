/** Redimensionne et recompresse une photo dans le navigateur (JPEG, 1600 px max). */
export async function compresserPhoto(fichier: File, max = 1600, qualite = 0.8): Promise<File> {
  if (!fichier.type.startsWith("image/")) throw new Error("format");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    throw new Error("lecture");
  }
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualite));
  if (!blob) throw new Error("encodage");
  const nom = fichier.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${nom.slice(0, 40)}.jpg`, { type: "image/jpeg" });
}
