"""Moteur de motion design IRLY.

Chaque image est une fonction pure du temps : frame(t) ne dépend d'aucun état précédent,
ce qui rend le rendu reproductible image par image. Les couches :

  fond      images du montage MoneyPrinterTurbo (photos/vidéos réelles, zoom lent)
            ou fond de marque quand la scène l'exige
  scène     typographie animée, révélation du logo, iPhone en 3D, cartes d'activités,
            carte de fin
  sous-titres  blocs de 2 à 5 mots, mots-clés en couleur, zone sûre TikTok

Règle : l'écran du téléphone n'affiche que des captures réelles fournies par l'utilisateur.
Sans capture, il affiche le logo IRLY, jamais une interface inventée.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import subtitles as subs

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.path.dirname(HERE), "assets", "fonts")
DISPLAY_FONT = os.path.join(FONTS, "InterDisplay-Bold.otf")
DISPLAY_MED = os.path.join(FONTS, "InterDisplay-SemiBold.otf")
SUB_FONT = os.path.join(FONTS, "TikTokSans-Bold.ttf")

INK = (14, 14, 18)
PAPER = (246, 243, 238)


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- courbes de mouvement

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def spring(t: float, freq: float = 2.2, damping: float = 0.55) -> float:
    """Ressort amorti en forme fermée : 0 à t<=0, tend vers 1 avec un léger rebond."""
    if t <= 0:
        return 0.0
    w = 2 * math.pi * freq
    z = damping
    wd = w * math.sqrt(1 - z * z)
    return 1 - math.exp(-z * w * t) * (math.cos(wd * t) + z * w / wd * math.sin(wd * t))


def ease_out(t: float) -> float:
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t: float) -> float:
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


# ---------------------------------------------------------------- texte

@lru_cache(maxsize=64)
def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def text_width(f, s: str) -> float:
    return f.getlength(s)


def wrap(text: str, f, max_w: float) -> list[str]:
    lines, cur = [], ""
    for w in text.split():
        trial = (cur + " " + w).strip()
        if cur and text_width(f, trial) > max_w:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def fit_font(text: str, path: str, max_w: float, max_lines: int, start: int, minimum: int):
    """Plus grande taille qui tient en max_lines lignes sans couper un mot."""
    size = start
    while size > minimum:
        f = font(path, size)
        lines = wrap(text, f, max_w)
        if len(lines) <= max_lines and all(text_width(f, l) <= max_w for l in lines):
            return f, lines
        size -= 4
    f = font(path, minimum)
    return f, wrap(text, f, max_w)


# ---------------------------------------------------------------- mise en page

@dataclass
class Layout:
    w: int
    h: int

    @property
    def portrait(self) -> bool:
        return self.h > self.w

    @property
    def margin(self) -> int:
        return int(self.w * 0.083)

    @property
    def safe_right(self) -> int:
        # boutons TikTok / Reels sur le bord droit : on garde ~15 % libre
        return int(self.w * (0.86 if self.portrait else 0.94))

    @property
    def text_w(self) -> int:
        return self.safe_right - self.margin

    @property
    def sub_y(self) -> int:
        # au-dessus de la légende et des boutons du bas (environ 22 % de la hauteur)
        return int(self.h * (0.69 if self.portrait else 0.80))

    @property
    def s(self) -> float:
        """Échelle typographique relative à une base 1080 de large en portrait."""
        return (self.w if self.portrait else self.h) / 1080


# ---------------------------------------------------------------- plan de montage

@dataclass
class Shot:
    part: str
    start: float
    end: float
    text: str


@dataclass
class Plan:
    shots: list[Shot]
    cues: list[subs.Cue]
    duration: float
    accent: tuple[int, int, int]
    language: str = "fr"
    tagline: str = "Make friends IRL"
    chips: list[str] = field(default_factory=list)
    cta_lines: list[str] = field(default_factory=list)
    handle: str = "@irlyofficial"
    screens: list[str] = field(default_factory=list)  # captures réelles de l'app
    logo: str | None = None  # logo officiel (PNG transparent) ; sinon logotype texte


# Scènes : quelle partie du script prend quelle mise en scène.
SCENE_OF = {
    "hook": "kinetic", "problem": "media", "situation": "media", "extra_situation": "media",
    "irly": "reveal", "feature": "phone", "extra_feature": "phone", "close": "kinetic",
    "cta": "endcard",
    "ugc": "ugc",  # vidéo UGC importée : on la laisse telle quelle, sous-titres par-dessus
}


def scene_at(plan: Plan, t: float) -> tuple[Shot, str, float]:
    for i, sh in enumerate(plan.shots):
        nxt = plan.shots[i + 1].start if i + 1 < len(plan.shots) else plan.duration + 1
        if t < nxt:
            return sh, SCENE_OF.get(sh.part, "media"), t - sh.start
    sh = plan.shots[-1]
    return sh, SCENE_OF.get(sh.part, "media"), t - sh.start


# ---------------------------------------------------------------- calques

def darken(img: Image.Image, top: float, bottom: float) -> Image.Image:
    """Dégradé sombre vertical pour la lisibilité, plus marqué en haut et en bas."""
    w, h = img.size
    y = np.linspace(0, 1, h)[:, None]
    alpha = np.clip(top * (1 - y / 0.55), 0, 1) + np.clip(bottom * ((y - 0.45) / 0.55), 0, 1)
    alpha = np.clip(alpha, 0, 0.92)
    arr = np.asarray(img).astype(np.float32)
    arr *= (1 - alpha)[..., None]
    return Image.fromarray(arr.astype(np.uint8))


@lru_cache(maxsize=8)
def _grain(w, h, seed):
    rng = np.random.default_rng(seed)
    return rng.normal(0, 3, (h // 2, w // 2)).astype(np.float32)


def grain(img: Image.Image, t: float, fps: int) -> Image.Image:
    w, h = img.size
    n = _grain(w, h, int(t * 12) % 6)
    n = np.kron(n, np.ones((2, 2), dtype=np.float32))[:h, :w]
    arr = np.asarray(img).astype(np.float32) + n[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def brand_bg(L: Layout, t: float, accent) -> Image.Image:
    """Fond encre avec une lueur d'accent qui dérive lentement (pas de dégradé plein écran)."""
    img = Image.new("RGB", (L.w, L.h), INK)
    glow = Image.new("L", (L.w, L.h), 0)
    d = ImageDraw.Draw(glow)
    r = int(L.w * 0.55)
    cx = L.w * (0.5 + 0.12 * math.sin(t * 0.35))
    cy = L.h * (0.42 + 0.05 * math.cos(t * 0.27))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(L.w * 0.18))
    color = Image.new("RGB", (L.w, L.h), accent)
    return Image.composite(color, img, glow)


def kinetic_text(canvas: Image.Image, L: Layout, text: str, local_t: float, *,
                 y: int, size: int, color=PAPER, accent=None, highlight_lang="fr",
                 out_t: float | None = None):
    """Titre mot à mot : chaque mot monte dans un masque avec un ressort, en décalé."""
    f, lines = fit_font(text, DISPLAY_FONT, L.text_w, 4, int(size * L.s), int(44 * L.s))
    lh = int(f.size * 1.08)
    hl_words = {w.lower() for w in subs.catalog.HIGHLIGHT_WORDS.get(highlight_lang, [])}
    d = ImageDraw.Draw(canvas)
    idx = 0
    exit_k = 0.0 if out_t is None else ease_in_out((local_t - out_t) / 0.35)
    for li, line in enumerate(lines):
        x = L.margin
        for word in line.split():
            delay = 0.06 * idx
            k = spring(local_t - delay, freq=1.8, damping=0.62)
            ww = text_width(f, word + " ")
            if k > 0.001:
                dy = (1 - k) * lh * 0.9 + exit_k * -lh * 0.6
                alpha = int(255 * clamp(k * 1.4) * (1 - exit_k))
                bare = word.strip(".,…?!:;").lower()
                col = accent if (accent and bare in hl_words) else color
                # masque : le mot monte dans une boîte de la hauteur de la ligne
                box_h = int(lh * 1.22)
                word_img = Image.new("RGBA", (int(ww) + 8, box_h), (0, 0, 0, 0))
                ImageDraw.Draw(word_img).text((0, dy), word, font=f, fill=col + (alpha,))
                canvas.paste(word_img, (int(x), int(y + li * lh)), word_img)
            x += ww
            idx += 1
    return y + len(lines) * lh


def wordmark(L: Layout, size: float, color=PAPER) -> Image.Image:
    """Logotype texte IRLY, utilisé tant que le logo officiel n'est pas importé."""
    f = font(DISPLAY_FONT, int(size))
    w = int(text_width(f, "IRLY")) + 10
    img = Image.new("RGBA", (w, int(size * 1.2)), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 0), "IRLY", font=f, fill=color + (255,))
    return img


def logo_image(plan: Plan, L: Layout, height: float) -> Image.Image:
    if plan.logo and os.path.exists(plan.logo):
        im = Image.open(plan.logo).convert("RGBA")
        k = height / im.height
        return im.resize((max(1, int(im.width * k)), max(1, int(height))), Image.LANCZOS)
    return wordmark(L, height)


def reveal_scene(canvas, L, plan, lt):
    """Cercle d'accent qui s'ouvre, puis l'encre, puis le logo qui tombe en place."""
    base = brand_bg(L, lt, plan.accent)
    r_max = math.hypot(L.w, L.h)
    r = r_max * ease_out(lt / 0.55)
    mask = Image.new("L", (L.w, L.h), 0)
    ImageDraw.Draw(mask).ellipse([L.w / 2 - r, L.h * 0.45 - r, L.w / 2 + r, L.h * 0.45 + r], fill=255)
    ring_r = r_max * ease_out((lt - 0.08) / 0.6)
    acc = Image.new("RGB", (L.w, L.h), plan.accent)
    inner = Image.new("L", (L.w, L.h), 0)
    ImageDraw.Draw(inner).ellipse([L.w / 2 - ring_r, L.h * 0.45 - ring_r, L.w / 2 + ring_r,
                                   L.h * 0.45 + ring_r], fill=255)
    layer = Image.composite(base, acc, inner)
    canvas.paste(layer, (0, 0), mask)
    if lt > 0.35:
        k = spring(lt - 0.35, freq=1.6, damping=0.5)
        logo = logo_image(plan, L, 230 * L.s)
        sc = 0.6 + 0.4 * k
        lw, lh = max(1, int(logo.width * sc)), max(1, int(logo.height * sc))
        lg = logo.resize((lw, lh), Image.LANCZOS)
        a = clamp((lt - 0.35) / 0.2)
        lg.putalpha(lg.getchannel("A").point(lambda v: int(v * a)))
        canvas.paste(lg, (int(L.w / 2 - lw / 2), int(L.h * 0.40 - lh / 2)), lg)
    if lt > 0.8:
        k = ease_out((lt - 0.8) / 0.5)
        f = font(DISPLAY_MED, int(54 * L.s))
        tw = text_width(f, plan.tagline)
        d = ImageDraw.Draw(canvas)
        y = L.h * 0.40 + 150 * L.s + (1 - k) * 30 * L.s
        d.text((L.w / 2 - tw / 2, y), plan.tagline, font=f, fill=PAPER + (int(255 * k),))


# ---------------------------------------------------------------- iPhone 3D

def _persp_coeffs(src, dst):
    """Coefficients PIL.PERSPECTIVE qui envoient dst (sortie) vers src (entrée)."""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(m, dtype=np.float64)
    b = np.array([c for p in src for c in p], dtype=np.float64)
    return np.linalg.solve(a, b).tolist()


def project(w, h, rot_y, rot_x, dist):
    pts = []
    for x, y in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        z = 0.0
        x1 = x * math.cos(rot_y) + z * math.sin(rot_y)
        z1 = -x * math.sin(rot_y) + z * math.cos(rot_y)
        y1 = y * math.cos(rot_x) - z1 * math.sin(rot_x)
        z2 = y * math.sin(rot_x) + z1 * math.cos(rot_x)
        k = dist / (dist + z2)
        pts.append((x1 * k, y1 * k))
    return pts


@lru_cache(maxsize=16)
def _screen_image(path: str | None, w: int, h: int, accent: tuple, logo: str | None):
    if path and os.path.exists(path):
        im = Image.open(path).convert("RGB")
        k = w / im.width
        im = im.resize((w, max(h, int(im.height * k))), Image.LANCZOS)
        return im  # peut être plus haute que l'écran : on la fait défiler
    img = Image.new("RGB", (w, h), accent)
    plan_stub = Plan([], [], 0, accent, logo=logo)
    lg = logo_image(plan_stub, Layout(w, h * 2), w * 0.3)
    img.paste(lg, (w // 2 - lg.width // 2, h // 2 - lg.height // 2), lg)
    return img


def phone_face(plan: Plan, w: int, h: int, scroll: float, screen_idx: int) -> Image.Image:
    """Le téléphone de face : châssis, écran, Dynamic Island."""
    pad = int(w * 0.045)
    rad = int(w * 0.16)
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle([0, 0, w - 1, h - 1], rad, fill=(28, 28, 32, 255))
    d.rounded_rectangle([2, 2, w - 3, h - 3], rad - 2, outline=(70, 70, 78, 255), width=3)
    sw, sh = w - 2 * pad, h - 2 * pad
    path = plan.screens[screen_idx % len(plan.screens)] if plan.screens else None
    shot = _screen_image(path, sw, sh, plan.accent, plan.logo)
    off = int((shot.height - sh) * clamp(scroll))
    screen = shot.crop((0, off, sw, off + sh))
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], rad - pad, fill=255)
    body.paste(screen, (pad, pad), mask)
    iw, ih = int(w * 0.28), int(w * 0.075)
    d.rounded_rectangle([w / 2 - iw / 2, pad + ih * 0.5, w / 2 + iw / 2, pad + ih * 1.5],
                        ih // 2, fill=(0, 0, 0, 255))
    return body


def phone_scene(canvas, L, plan, lt, span):
    base = brand_bg(L, lt + 3, plan.accent)
    canvas.paste(base, (0, 0))
    pw = int((450 if L.portrait else 360) * L.s)
    ph = int(pw * 2.06)
    enter = spring(lt, freq=1.1, damping=0.7)
    rot_y = math.radians(-28 * (1 - enter) + 10 * math.sin(lt * 0.9))
    rot_x = math.radians(8 * (1 - enter) + 3 * math.sin(lt * 0.6))
    n = max(1, len(plan.screens))
    per = max(span / n, 0.1)
    idx = min(int(lt / per), n - 1)
    scroll = ease_in_out((lt - idx * per) / per) if plan.screens else 0
    face = phone_face(plan, pw, ph, scroll, idx)
    pts = project(pw, ph, rot_y, rot_x, pw * 3.2)
    cx = L.w * (0.5 if L.portrait else 0.36)
    cy = L.h * (0.385 if L.portrait else 0.45) + (1 - enter) * L.h * 0.35 + math.sin(lt * 1.3) * 10 * L.s
    dst = [(cx + x, cy + y) for x, y in pts]
    src = [(0, 0), (pw, 0), (pw, ph), (0, ph)]
    coeffs = _persp_coeffs(src, dst)
    warped = face.transform((L.w, L.h), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    shadow = Image.new("L", (L.w, L.h), 0)
    sd = ImageDraw.Draw(shadow)
    sd.polygon([(x + 30 * L.s, y + 50 * L.s) for x, y in dst], fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(40 * L.s))
    canvas.paste(Image.new("RGB", (L.w, L.h), (0, 0, 0)), (0, 0), shadow)
    canvas.paste(warped, (0, 0), warped)
    chips_scene(canvas, L, plan, lt, cx, cy, pw, ph)


def chips_scene(canvas, L, plan, lt, cx, cy, pw, ph):
    """Cartes d'activités qui se posent autour du téléphone, en décalé."""
    if not plan.chips:
        return
    f = font(DISPLAY_MED, int(40 * L.s))
    slots = [(-0.98, -0.36), (0.60, -0.16), (-0.92, 0.10), (0.58, 0.30)]
    if not L.portrait:
        slots = [(1.2, -0.30), (1.3, -0.05), (1.2, 0.20), (1.3, 0.42)]
    d = ImageDraw.Draw(canvas)
    for i, (label, (sx, sy)) in enumerate(zip(plan.chips, slots)):
        k = spring(lt - 0.5 - i * 0.18, freq=1.7, damping=0.55)
        if k <= 0:
            continue
        tw = text_width(f, label)
        bw, bh = tw + 70 * L.s, 86 * L.s
        x = cx + sx * pw - (0 if sx > 0 else bw * 0.2)
        y = cy + sy * ph + (1 - k) * 60 * L.s
        x = clamp(x, L.margin * 0.5, L.safe_right - bw)
        a = int(255 * clamp(k))
        card = Image.new("RGBA", (int(bw), int(bh)), (0, 0, 0, 0))
        cdraw = ImageDraw.Draw(card)
        cdraw.rounded_rectangle([0, 0, bw - 1, bh - 1], bh / 2, fill=PAPER + (a,))
        cdraw.ellipse([22 * L.s, bh / 2 - 9 * L.s, 40 * L.s, bh / 2 + 9 * L.s], fill=plan.accent + (a,))
        cdraw.text((52 * L.s, bh / 2), label, font=f, fill=INK + (a,), anchor="lm")
        sc = 0.85 + 0.15 * k
        card = card.resize((max(1, int(bw * sc)), max(1, int(bh * sc))), Image.LANCZOS)
        canvas.paste(card, (int(x), int(y)), card)


def endcard_scene(canvas, L, plan, lt):
    base = brand_bg(L, lt + 7, plan.accent)
    canvas.paste(base, (0, 0))
    k = spring(lt, freq=1.4, damping=0.6)
    breathe = 1 + 0.025 * math.sin(lt * 1.1)  # la carte de fin respire, elle ne fige pas
    logo = logo_image(plan, L, 200 * L.s * breathe)
    y0 = int(L.h * 0.30 - (1 - k) * 40 * L.s)
    canvas.paste(logo, (int(L.w / 2 - logo.width / 2), y0), logo)
    d = ImageDraw.Draw(canvas)
    y = y0 + logo.height + int(60 * L.s)
    f = font(DISPLAY_MED, int(50 * L.s))
    for i, line in enumerate(plan.cta_lines):
        kk = ease_out((lt - 0.25 - i * 0.12) / 0.4)
        for sub in wrap(line, f, L.text_w):
            tw = text_width(f, sub)
            d.text((L.w / 2 - tw / 2, y + (1 - kk) * 24 * L.s), sub, font=f,
                   fill=PAPER + (int(255 * kk),))
            y += int(f.size * 1.25)
        y += int(14 * L.s)
    kk = spring(lt - 0.6, freq=1.6, damping=0.55)
    if kk > 0:
        fh = font(DISPLAY_FONT, int(58 * L.s))
        tw = text_width(fh, plan.handle)
        bw, bh = tw + 80 * L.s, 110 * L.s
        x = L.w / 2 - bw / 2
        y += int(40 * L.s)
        pill = Image.new("RGBA", (int(bw), int(bh)), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pill)
        pd.rounded_rectangle([0, 0, bw - 1, bh - 1], bh / 2, fill=plan.accent + (255,))
        pd.text((bw / 2, bh / 2), plan.handle, font=fh, fill=PAPER, anchor="mm")
        sc = 0.7 + 0.3 * kk
        pill = pill.resize((max(1, int(bw * sc)), max(1, int(bh * sc))), Image.LANCZOS)
        canvas.paste(pill, (int(L.w / 2 - pill.width / 2), int(y)), pill)
        y += bh + int(70 * L.s)
    kt = ease_out((lt - 2.4) / 0.6)
    if kt > 0:
        ft = font(DISPLAY_MED, int(46 * L.s))
        tw = text_width(ft, plan.tagline)
        d.text((L.w / 2 - tw / 2, y + (1 - kt) * 20 * L.s), plan.tagline, font=ft,
               fill=plan.accent + (int(255 * kt),))


# ---------------------------------------------------------------- sous-titres

def draw_subtitle(canvas: Image.Image, L: Layout, cue: subs.Cue, t: float, accent, lang, boxed=False):
    f = font(SUB_FONT, int(64 * L.s))
    lines = wrap(cue.text, f, L.text_w)[:2]
    k = spring(t - cue.start, freq=3.0, damping=0.6)
    sc = 0.9 + 0.1 * k
    lh = int(f.size * 1.18)
    block_h = lh * len(lines)
    layer = Image.new("RGBA", (L.w, block_h + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if boxed:  # fond sombre quand le sous-titre passe sur un aplat de couleur
        widest = max(text_width(f, l) for l in lines)
        bx = L.margin + (L.text_w - widest) / 2 - 28 * L.s
        d.rounded_rectangle([bx, 0, bx + widest + 56 * L.s, block_h + 26], 26 * L.s, fill=(10, 10, 14, 200))
    for i, line in enumerate(lines):
        total = text_width(f, line)
        x = L.margin + (L.text_w - total) / 2
        y = i * lh + 10
        for piece, hl in subs.highlight_spans(line, lang):
            col = accent if hl else (255, 255, 255)
            d.text((x, y), piece, font=f, fill=col + (255,),
                   stroke_width=int(7 * L.s), stroke_fill=(0, 0, 0, 230))
            x += text_width(f, piece)
    if sc != 1:
        nw, nh = int(layer.width * sc), int(layer.height * sc)
        layer = layer.resize((nw, nh), Image.LANCZOS)
    alpha = clamp((t - cue.start) / 0.06) * clamp((cue.end + 0.02 - t) / 0.06 + 1)
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.paste(layer, (int(L.w / 2 - layer.width / 2), int(L.sub_y - layer.height / 2)), layer)


# ---------------------------------------------------------------- image complète

def render_frame(plan: Plan, L: Layout, t: float, base: Image.Image | None, fps: int = 30) -> Image.Image:
    shot, scene, lt = scene_at(plan, t)
    span = shot.end - shot.start
    if base is None:
        canvas = brand_bg(L, t, plan.accent)
    else:
        canvas = base.convert("RGB").resize((L.w, L.h)) if base.size != (L.w, L.h) else base.convert("RGB")

    if scene == "ugc":
        pass  # image d'origine, sans assombrissement ni titre
    elif scene in ("media", "kinetic"):
        canvas = darken(canvas, 0.55 if scene == "kinetic" else 0.25, 0.65)
        if scene == "kinetic":
            nxt = next((s for s in plan.shots if s.start > shot.start), None)
            out_t = (nxt.start - shot.start - 0.35) if nxt else None
            kinetic_text(canvas, L, subs.clean(shot.text), lt, y=int(L.h * (0.20 if L.portrait else 0.18)),
                         size=104, accent=plan.accent, highlight_lang=plan.language, out_t=out_t)
    elif scene == "reveal":
        reveal_scene(canvas, L, plan, lt)
    elif scene == "phone":
        first_phone = next(s for s in plan.shots if SCENE_OF.get(s.part) == "phone")
        lt2 = t - first_phone.start
        last_phone = [s for s in plan.shots if SCENE_OF.get(s.part) == "phone"][-1]
        phone_scene(canvas, L, plan, lt2, last_phone.end - first_phone.start)
    elif scene == "endcard":
        endcard_scene(canvas, L, plan, lt)

    # transition « whip » : la scène suivante entre en poussant la précédente vers le haut
    if scene == "media" and lt < 0.4:
        prev = [s for s in plan.shots if s.start < shot.start]
        if prev and SCENE_OF.get(prev[-1].part) in ("phone", "reveal"):
            k = ease_in_out(lt / 0.4)
            old = Image.new("RGB", (L.w, L.h), INK)
            off = int(-k * L.h)
            canvas2 = canvas.copy()
            canvas = Image.new("RGB", (L.w, L.h))
            canvas.paste(old, (0, off))
            canvas.paste(canvas2, (0, off + L.h))

    if scene not in ("endcard", "kinetic"):
        cue = next((c for c in plan.cues if c.start <= t < c.end), None)
        if cue:
            draw_subtitle(canvas, L, cue, t, plan.accent, plan.language, boxed=scene in ("phone", "reveal"))
    return grain(canvas, t, fps)
