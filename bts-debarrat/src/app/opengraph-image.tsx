import { ImageResponse } from "next/og";

export const alt = "BTS DÉBARRAT — débarras à Paris et en Île-de-France";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f4f3ef", color: "#17181a", padding: 80 }}>
        <svg width="120" height="104" viewBox="0 0 116 100">
          <path d="M0 100 L58 0 L116 100 H96 L58 34 L20 100 Z" fill="#b0823e" />
          <rect x="47" y="60" width="22" height="40" fill="#17181a" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>De la place pour ce qui compte.</span>
          <span style={{ fontSize: 34, marginTop: 28, color: "#5d6063", letterSpacing: 6 }}>BTS DÉBARRAT · PARIS & ÎLE-DE-FRANCE</span>
        </div>
      </div>
    ),
    size,
  );
}
