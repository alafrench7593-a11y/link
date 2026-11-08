"""Identité IRLY reprise de l'application (dépôt alafrench7593-a11y/irly, lecture seule).

- Logotype : la matrice de points de src/brand/dots.ts (lettres I R L Y sur une grille de
  7 rangées + l'accent 2×2 au-dessus du Y), mêmes proportions que IrlyWordmark
  (pas = taille / 6,2, point = 88 % du pas).
- Marque d'app : le « i » en points de markDots().
- Couleurs : IRLY Noir (DESIGN_SYSTEM.md, src/theme/tokens.ts), IRLY Girl (src/features/girl/theme.ts),
  couleurs de catégories (uniquement en point ou en halo, jamais en aplat).
- Typo : Manrope (une seule famille dans l'app) ; Instrument Serif italique pour « Girl ».
"""

from __future__ import annotations

import os
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

FONTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")

# --------------------------------------------------------------- couleurs de l'app
NOIR = {
    "bg": "#050506", "surface": "#0E0F12", "raised": "#16181C", "overlay": "#202227",
    "text": "#FFFFFF", "brand": "#FFFFFF", "on_brand": "#050506", "steel": "#8EA5BF",
    "live": "#FF453A", "positive": "#32D74B", "caution": "#FF9F0A",
}
GIRL = {"brand": "#E83E87", "rose": "#B92B69", "pink": "#F6C5D8", "ink": "#2F1B29", "pearl": "#FFF7FA"}
NETWORK_GIRL = {"violet": "#6A3BEE", "lilac": "#C9B6FF", "plum": "#2D1D54"}
CATEGORY = {
    "sport": "#34C759", "food": "#FF9500", "coffee": "#A2845E", "padel": "#32ADE6", "beach": "#F2B600",
    "nightlife": "#AF52DE", "travel": "#007AFF", "wellness": "#30B0C7", "activities": "#FF2D55",
    "networking": "#5856D6", "events": "#FF3B30",
}

# Accent de chaque univers dans les vidéos : la lumière acier pour IRLY, le rose de
# marque pour IRLY Girl, la couleur de catégorie pour les autres (en point/halo).
UNIVERSE_ACCENT = {
    "mixte": NOIR["steel"], "girl": GIRL["brand"], "network": CATEGORY["networking"],
    "sport": CATEGORY["sport"], "activites": CATEGORY["activities"],
}


def rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# --------------------------------------------------------------- polices
MANROPE = {w: os.path.join(FONTS, f"Manrope-{w}.ttf") for w in ("ExtraBold", "Bold", "SemiBold", "Medium")}
SERIF_ITALIC = os.path.join(FONTS, "InstrumentSerif-Italic.ttf")


def manrope(weight: str = "ExtraBold") -> str:
    path = MANROPE.get(weight, MANROPE["ExtraBold"])
    return path if os.path.exists(path) else os.path.join(FONTS, "InterDisplay-Bold.otf")


@lru_cache(maxsize=32)
def font(path: str, size: int):
    return ImageFont.truetype(path, size)


# --------------------------------------------------------------- logotype en points (dots.ts)
GLYPHS = {
    "I": ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "L": ["#...", "#...", "#...", "#...", "#...", "#...", "####"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
}
ACCENT = [(0, 0), (1, 0), (0, 1), (1, 1)]


def wordmark_dots(text: str = "IRLY", accent: bool = True):
    dots, x = [], 0
    for ch in text:
        g = GLYPHS[ch]
        for row, line in enumerate(g):
            for col, c in enumerate(line):
                if c == "#":
                    dots.append((x + col, row, False))
        x += len(g[0]) + 1
    if not accent:
        return dots, x - 1, 0.0
    for c, r in ACCENT:
        dots.append((x - 0.4 + c, -2.2 + r, True))
    return dots, x + 1.6, -2.2


def mark_dots():
    dots = [(0, row, False) for row in range(2, 8)]
    dots += [(1.6 + c, -0.4 + r, True) for c, r in ACCENT]
    return dots, 3.6, -0.4


def _draw_dots(layout, size: float, color, accent_color, glow: bool = False) -> Image.Image:
    dots, cols, top = layout
    rows = 7 if top < 0 and cols > 4 else 8
    pitch = size / 6.2
    dot = pitch * 0.88
    w, h = int(cols * pitch) + 2, int((rows - top) * pitch) + 2
    ss = 4  # suréchantillonnage pour des points ronds et nets
    img = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for col, row, acc in dots:
        x0 = (col * pitch + (pitch - dot) / 2) * ss
        y0 = ((row - top) * pitch + (pitch - dot) / 2) * ss
        d.ellipse([x0, y0, x0 + dot * ss, y0 + dot * ss], fill=(accent_color if acc else color) + (255,))
    return img.resize((w, h), Image.LANCZOS)


def wordmark(size: float, color="#FFFFFF", accent: str | None = None) -> Image.Image:
    """Le logotype IRLY de l'app ; `size` ≈ hauteur des capitales en pixels."""
    return _draw_dots(wordmark_dots(), size, rgb(color), rgb(accent or color))


def mark(size: float, color="#FFFFFF", accent: str | None = None) -> Image.Image:
    """L'icône d'app : le « i » en points."""
    return _draw_dots(mark_dots(), size, rgb(color), rgb(accent or color))


def girl_logo(size: float, on_dark: bool = True, word: str = "Girl") -> Image.Image:
    """IRLY Girl (GirlLogo.tsx) : IRLY en capitales Manrope espacées, un point rose,
    puis « Girl » en Instrument Serif italique."""
    ink = rgb("#FFFFFF") if on_dark else rgb(GIRL["ink"])
    accent = rgb("#FFFFFF") if on_dark else rgb(GIRL["brand"])
    f1 = font(manrope("ExtraBold"), int(size * 0.62))
    serif = SERIF_ITALIC if os.path.exists(SERIF_ITALIC) else manrope("Medium")
    f2 = font(serif, int(size * 1.05))
    spacing = size * 0.18
    w1 = sum(f1.getlength(c) + spacing for c in "IRLY") - spacing
    stop = size * 0.18
    gap = size * 0.16
    w = int(w1 + gap * 2 + stop + f2.getlength(word)) + 4
    h = int(size * 1.4)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = h * 0.72
    x = 0
    for c in "IRLY":
        d.text((x, base), c, font=f1, fill=ink + (255,), anchor="ls")
        x += f1.getlength(c) + spacing
    x += gap - spacing
    d.ellipse([x, base - size * 0.26, x + stop, base - size * 0.26 + stop], fill=accent + (255,))
    x += stop + gap
    d.text((x, base), word, font=f2, fill=ink + (255,), anchor="ls")
    return img
