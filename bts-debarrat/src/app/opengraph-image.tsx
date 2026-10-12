import { ImageResponse } from "next/og";

export const alt = "BTS DÉBARRAT — débarras à Paris et en Île-de-France";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#111312", color: "#fff", padding: 80 }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#8fd6b0" }}>DÉBARRAS · PARIS & ÎLE-DE-FRANCE</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 800, lineHeight: 1 }}>
          <span>BTS DÉBARRAT</span>
          <span style={{ fontSize: 48, fontWeight: 500, marginTop: 24, color: "#d8dcda" }}>Votre débarras en toute simplicité</span>
        </div>
        <div style={{ display: "flex", width: 160, height: 8, background: "#1d5a42" }} />
      </div>
    ),
    size,
  );
}
