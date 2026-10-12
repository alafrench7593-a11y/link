import type { IllustrationKind } from "@/config/services";

/**
 * Illustration vectorielle d'une pièce, encombrée (« avant ») ou vidée (« après »).
 * Ce n'est PAS une photo de chantier : elle sert d'emplacement tant que les
 * vraies photos de BTS DÉBARRAT ne sont pas fournies, et elle est toujours étiquetée comme telle.
 */

const W = 600;
const H = 400;
const BL = { x: 140, y: 78 }; // coin haut-gauche du mur du fond
const BR = { x: 460, y: 78 };
const FL = 262; // ligne de sol du mur du fond

type Palette = { wall: string; side: string; floor: string; ceil: string; line: string; box: string; boxTop: string; boxSide: string; accent: string };

const palettes: Record<"clair" | "sombre", Palette> = {
  clair: { wall: "#ecebe6", side: "#e1dfd8", floor: "#d6d1c6", ceil: "#f4f3ef", line: "#bdb8ad", box: "#b99c76", boxTop: "#cfb38c", boxSide: "#a3875f", accent: "#1d5a42" },
  sombre: { wall: "#4a4d4b", side: "#3d403e", floor: "#343634", ceil: "#565957", line: "#2a2c2b", box: "#8f7656", boxTop: "#a78b66", boxSide: "#76614a", accent: "#8fd6b0" },
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Box({ x, y, w, h, d, p }: { x: number; y: number; w: number; h: number; d: number; p: Palette }) {
  // x,y = coin bas-gauche de la face avant
  return (
    <g>
      <polygon points={`${x},${y - h} ${x + d},${y - h - d * 0.6} ${x + w + d},${y - h - d * 0.6} ${x + w},${y - h}`} fill={p.boxTop} />
      <polygon points={`${x + w},${y} ${x + w},${y - h} ${x + w + d},${y - h - d * 0.6} ${x + w + d},${y - d * 0.6}`} fill={p.boxSide} />
      <rect x={x} y={y - h} width={w} height={h} fill={p.box} />
      <line x1={x + w * 0.5} y1={y - h} x2={x + w * 0.5} y2={y - h * 0.62} stroke={p.boxSide} strokeWidth={Math.max(2, w * 0.06)} />
    </g>
  );
}

function Clutter({ kind, p, seed }: { kind: IllustrationKind; p: Palette; seed: number }) {
  const r = rng(seed);
  const items: React.ReactNode[] = [];
  const n = kind === "cave" || kind === "grenier" ? 16 : 13;
  const pos: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = FL + 18 + r() * (H - FL - 30);
    const t = (y - FL) / (H - FL);
    const xmin = BL.x - t * BL.x + 10;
    const xmax = BR.x + t * (W - BR.x) - 80;
    pos.push({ x: xmin + r() * (xmax - xmin), y, s: 0.55 + t * 0.85 });
  }
  pos.sort((a, b) => a.y - b.y);

  // Meubles caractéristiques, posés au fond
  if (kind === "appartement" || kind === "maison") {
    items.push(
      <g key="sofa">
        <rect x={180} y={206} width={150} height={52} rx={10} fill="#7d8580" />
        <rect x={172} y={226} width={24} height={34} rx={8} fill="#6c746f" />
        <rect x={316} y={226} width={24} height={34} rx={8} fill="#6c746f" />
        <rect x={190} y={190} width={130} height={30} rx={10} fill="#8b938e" />
      </g>,
      <g key="lamp"><line x1={402} y1={262} x2={402} y2={150} stroke="#555" strokeWidth={3} /><path d="M386 150h32l-8-26h-16z" fill="#c9b994" /></g>,
      <g key="shelf"><rect x={350} y={150} width={44} height={110} fill="#9b7f5c" />{[0, 1, 2].map((k) => <rect key={k} x={354} y={158 + k * 34} width={36} height={24} fill="#6b5a44" />)}</g>,
    );
  }
  if (kind === "bureau" || kind === "commerce") {
    items.push(
      <g key="desk"><rect x={170} y={214} width={130} height={10} fill="#8a8f8c" /><rect x={176} y={224} width={6} height={36} fill="#6d726f" /><rect x={288} y={224} width={6} height={36} fill="#6d726f" /><rect x={214} y={186} width={40} height={28} rx={3} fill="#2f3331" /></g>,
      <g key="cab"><rect x={330} y={168} width={56} height={94} fill="#a2a7a4" />{[0, 1, 2].map((k) => <rect key={k} x={336} y={176 + k * 28} width={44} height={22} fill="#8d928f" />)}</g>,
    );
  }
  if (kind === "garage") {
    items.push(
      <g key="rack"><rect x={170} y={140} width={8} height={122} fill="#666" /><rect x={290} y={140} width={8} height={122} fill="#666" />{[0, 1, 2].map((k) => <rect key={k} x={170} y={160 + k * 36} width={128} height={6} fill="#777" />)}</g>,
      <g key="tyres">{[0, 1].map((k) => <ellipse key={k} cx={360} cy={244 - k * 18} rx={30} ry={11} fill="#2b2b2b" stroke="#444" strokeWidth={5} />)}</g>,
      <g key="bike" stroke="#3f4441" strokeWidth={3} fill="none"><circle cx={250} cy={236} r={20} /><circle cx={310} cy={236} r={20} /><path d="M250 236 270 210h26l14 26M270 210l10 26" /></g>,
    );
  }
  if (kind === "cave" || kind === "grenier") {
    items.push(
      <g key="chair"><rect x={330} y={206} width={40} height={8} fill="#8a6e4e" /><rect x={332} y={170} width={6} height={36} fill="#8a6e4e" /><rect x={332} y={214} width={5} height={40} fill="#6e573d" /><rect x={364} y={214} width={5} height={40} fill="#6e573d" /></g>,
      <g key="trunk"><rect x={190} y={222} width={90} height={40} rx={4} fill="#6f5a43" /><rect x={190} y={234} width={90} height={5} fill="#4f3f2e" /></g>,
    );
  }

  pos.forEach((q, i) => {
    const w = (38 + r() * 40) * q.s;
    const h = (26 + r() * 34) * q.s;
    const d = 14 * q.s;
    items.push(<Box key={`b${i}`} x={q.x} y={q.y} w={w} h={h} d={d} p={p} />);
    if (r() > 0.6) items.push(<Box key={`s${i}`} x={q.x + w * 0.12} y={q.y - h} w={w * 0.72} h={h * 0.7} d={d * 0.8} p={p} />);
    if (r() > 0.8) items.push(<ellipse key={`bag${i}`} cx={q.x + w + 20 * q.s} cy={q.y - 12 * q.s} rx={20 * q.s} ry={14 * q.s} fill="#3a3d3b" />);
  });
  return <g>{items}</g>;
}

export function RoomIllustration({
  kind,
  state,
  className = "",
  title,
}: {
  kind: IllustrationKind;
  state: "avant" | "apres";
  className?: string;
  title?: string;
}) {
  const sombre = kind === "cave";
  const p = palettes[sombre ? "sombre" : "clair"];
  const apres = state === "apres";
  const attic = kind === "grenier";
  const seed = { maison: 11, appartement: 23, cave: 37, grenier: 41, garage: 53, bureau: 67, commerce: 79 }[kind];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={title ?? `Illustration : ${kind} ${apres ? "après" : "avant"} débarras`} preserveAspectRatio="xMidYMid slice">
      {/* plafond / murs */}
      <polygon points={`0,0 ${W},0 ${BR.x},${BR.y} ${BL.x},${BL.y}`} fill={p.ceil} />
      <polygon points={`0,0 ${BL.x},${BL.y} ${BL.x},${FL} 0,${H}`} fill={p.side} />
      <polygon points={`${W},0 ${BR.x},${BR.y} ${BR.x},${FL} ${W},${H}`} fill={p.side} />
      <rect x={BL.x} y={BL.y} width={BR.x - BL.x} height={FL - BL.y} fill={p.wall} />
      <polygon points={`0,${H} ${W},${H} ${BR.x},${FL} ${BL.x},${FL}`} fill={p.floor} />

      {attic && (
        <g>
          <polygon points={`0,0 ${W / 2},0 ${BL.x},${BL.y + 60}`} fill={p.side} opacity={0.9} />
          <polygon points={`${W},0 ${W / 2},0 ${BR.x},${BR.y + 60}`} fill={p.side} opacity={0.9} />
          <polygon points={`${BL.x},${BL.y} ${W / 2},${BL.y - 40} ${BR.x},${BR.y}`} fill={p.ceil} />
          <line x1={W / 2} y1={0} x2={W / 2} y2={BL.y - 40} stroke={p.line} strokeWidth={6} />
          <polygon points="250,20 330,20 320,58 258,58" fill="#cfe3ef" />
        </g>
      )}

      {/* lignes de sol */}
      {Array.from({ length: 9 }).map((_, i) => {
        const t = i / 8;
        const xb = BL.x + t * (BR.x - BL.x);
        const xf = t * W;
        return <line key={i} x1={xb} y1={FL} x2={xf} y2={H} stroke={p.line} strokeWidth={1} opacity={0.55} />;
      })}

      {/* éléments propres au lieu */}
      {(kind === "appartement" || kind === "maison") && (
        <g>
          <rect x={232} y={98} width={86} height={120} fill="#cfe3ef" stroke={p.line} strokeWidth={4} />
          <line x1={275} y1={98} x2={275} y2={218} stroke={p.line} strokeWidth={3} />
          <polygon points={`40,${FL + 40} 104,${FL - 4} 104,${BL.y + 40} 40,${BL.y + 20}`} fill={kind === "maison" ? "#c8b79b" : p.wall} opacity={0.9} />
        </g>
      )}
      {(kind === "bureau" || kind === "commerce") && (
        <g>
          {[0, 1, 2].map((k) => <rect key={k} x={170 + k * 98} y={96} width={86} height={104} fill="#cfe3ef" stroke={p.line} strokeWidth={3} />)}
          {[0, 1].map((k) => <rect key={k} x={180 + k * 160} y={10 + k * 0} width={80} height={10} fill="#fff" opacity={0.85} />)}
        </g>
      )}
      {kind === "garage" && (
        <g>
          <rect x={180} y={96} width={240} height={166} fill="#c9c6bd" />
          {Array.from({ length: 10 }).map((_, i) => <line key={i} x1={180} y1={112 + i * 16} x2={420} y2={112 + i * 16} stroke={p.line} strokeWidth={2} />)}
        </g>
      )}
      {kind === "cave" && (
        <g>
          {Array.from({ length: 8 }).map((_, i) => <line key={i} x1={BL.x} y1={BL.y + 22 * (i + 1)} x2={BR.x} y2={BL.y + 22 * (i + 1)} stroke={p.line} strokeWidth={1.5} />)}
          <line x1={W / 2} y1={0} x2={W / 2} y2={46} stroke="#222" strokeWidth={2} />
          <circle cx={W / 2} cy={52} r={8} fill="#f3d58b" />
          <rect x={268} y={96} width={64} height={22} fill="#2a2c2b" />
        </g>
      )}

      {apres ? (
        <g>
          {/* lumière au sol : l'espace est libéré */}
          <polygon points={`232,${FL} 318,${FL} 380,${H} 160,${H}`} fill="#ffffff" opacity={sombre ? 0.08 : 0.35} />
          <line x1={BL.x} y1={FL} x2={BR.x} y2={FL} stroke={p.line} strokeWidth={3} />
          <circle cx={W - 64} cy={H - 54} r={22} fill={p.accent} opacity={0.95} />
          <path d={`M${W - 74} ${H - 54} l7 7 13 -14`} stroke={sombre ? "#111312" : "#fff"} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : (
        <Clutter kind={kind} p={p} seed={seed} />
      )}
    </svg>
  );
}
