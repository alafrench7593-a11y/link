"""Génération de scripts marketing IRLY.

Deux moteurs :
- "templates" : textes écrits à la main dans catalog.py (FR et EN), sans clé d'API.
- "llm" : passe par le fournisseur LLM configuré dans MoneyPrinterTurbo (config.toml),
  en imposant la structure IRLY et les interdits (pas de faux témoignages ni de chiffres).
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field, asdict

from . import catalog

WORDS_PER_SECOND = 2.5  # débit d'une voix off française naturelle, pauses comprises

# Parties du script par durée. 15 s garde l'essentiel : accroche, IRLY, fonctionnalité, CTA.
STRUCTURE_BY_DURATION = {
    15: ["hook", "irly", "feature", "cta"],
    30: ["hook", "problem", "situation", "irly", "feature", "close", "cta"],
    45: ["hook", "problem", "situation", "extra_situation", "irly", "feature", "close", "cta"],
    60: ["hook", "problem", "situation", "extra_situation", "irly", "feature", "extra_feature",
         "close", "cta"],
}

PART_LABELS = {
    "hook": "Accroche", "problem": "Problème", "situation": "Mise en situation",
    "extra_situation": "Mise en situation", "irly": "Présentation d'IRLY",
    "feature": "Fonctionnalité concrète", "extra_feature": "Fonctionnalité concrète",
    "close": "Conclusion", "cta": "Appel à l'action",
}


@dataclass
class Segment:
    part: str
    text: str

    @property
    def label(self) -> str:
        return PART_LABELS.get(self.part, self.part)


@dataclass
class Script:
    campaign: str
    language: str
    duration: int
    variant: str
    segments: list[Segment] = field(default_factory=list)
    engine: str = "templates"

    @property
    def text(self) -> str:
        return "\n".join(s.text for s in self.segments)

    @property
    def word_count(self) -> int:
        return len(re.findall(r"\w+", self.text))

    @property
    def estimated_seconds(self) -> float:
        return round(self.word_count / WORDS_PER_SECOND, 1)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["text"] = self.text
        data["estimated_seconds"] = self.estimated_seconds
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "Script":
        segments = [Segment(**s) for s in data.get("segments", [])]
        return cls(data["campaign"], data["language"], int(data["duration"]), data["variant"],
                   segments, data.get("engine", "templates"))


def hooks_for(campaign: str, language: str = "fr") -> list[str]:
    """Toutes les accroches disponibles d'une campagne, toutes variantes confondues."""
    blocks = catalog.CAMPAIGNS[campaign][language]["hook"]
    return [h for options in blocks.values() for h in options]


def generate(campaign: str, *, language: str = "fr", duration: int = 30,
             variant: str = "emotionnelle", seed: int | None = None,
             cta: str | None = None, hook: str | None = None) -> Script:
    """Construit un script depuis les blocs écrits à la main.

    `seed` change les alternatives choisies, pour produire des versions différentes.
    """
    if campaign not in catalog.CAMPAIGNS:
        raise ValueError(f"Campagne inconnue : {campaign}")
    if language not in catalog.TEMPLATE_LANGUAGES:
        raise ValueError(f"Pas de texte écrit à la main en {language} : utilise le moteur LLM.")
    if duration not in STRUCTURE_BY_DURATION:
        raise ValueError(f"Durée non prise en charge : {duration} s")
    if variant not in catalog.VARIANTS:
        raise ValueError(f"Variante inconnue : {variant}")

    rng = random.Random(f"{campaign}-{language}-{duration}-{variant}-{seed}")
    blocks = catalog.CAMPAIGNS[campaign][language]
    tone = catalog.VARIANTS[variant]
    segments = []
    for part in STRUCTURE_BY_DURATION[duration]:
        if part == "hook":
            text = hook or rng.choice(blocks["hook"].get(tone) or hooks_for(campaign, language))
        elif part == "cta":
            text = cta or (catalog.SHORT_CTA if duration == 15 else catalog.DEFAULT_CTA)[language]
        else:
            text = rng.choice(blocks[part])
        segments.append(Segment(part, text))
    script = Script(campaign, language, duration, variant, segments)
    # Ajuste à la durée : on retire d'abord les parties les moins essentielles,
    # puis on essaie les alternatives plus courtes avant de couper.
    for part in DROP_ORDER + (["irly"] if duration == 15 else []):
        if script.estimated_seconds <= duration:
            break
        shorter = min(blocks.get(part, []), key=len, default=None)
        seg = next((s for s in script.segments if s.part == part), None)
        if seg and shorter and len(shorter) < len(seg.text):
            seg.text = shorter
            if script.estimated_seconds <= duration:
                break
        if seg and (part not in ("hook", "irly", "feature", "cta") or duration == 15):
            script.segments.remove(seg)
    return script


DROP_ORDER = ["extra_feature", "extra_situation", "situation", "close", "problem"]


def build_llm_prompt(campaign: str, *, language: str, duration: int, variant: str,
                     audience: str = "", theme: str = "") -> str:
    """Consigne envoyée au LLM. Elle impose la structure et les interdits IRLY."""
    info = catalog.CAMPAIGNS[campaign]
    words = int(duration * WORDS_PER_SECOND)
    parts = " / ".join(PART_LABELS[p] for p in STRUCTURE_BY_DURATION[duration])
    return (
        f"Écris le texte de voix off d'une publicité TikTok de {duration} secondes "
        f"(environ {words} mots) en {catalog.LANGUAGES[language]} pour IRLY, une app qui aide "
        "à rencontrer du monde dans la vraie vie à Dubaï : communautés, activités, sorties.\n"
        f"Campagne : {info['label']} — {info['brief']}\n"
        f"Thème précis : {theme or info['brief']}\nPublic : {audience or 'francophones de Dubaï'}\n"
        f"Ton : {catalog.TONES[catalog.VARIANTS[variant]]}.\n"
        f"Structure, une phrase courte par ligne, dans cet ordre : {parts}.\n"
        "Tutoiement, phrases parlées, pas de jargon marketing, pas d'emoji.\n"
        "Interdits : témoignage, citation d'utilisateur, chiffre d'utilisateurs, partenaire, "
        "prix, date de lancement, promesse de disponibilité immédiate.\n"
        f"Dernière ligne exactement : {catalog.DEFAULT_CTA.get(language, catalog.DEFAULT_CTA['en'])}\n"
        "Réponds uniquement avec les lignes du texte."
    )


def generate_with_llm(campaign: str, *, language: str, duration: int, variant: str,
                      audience: str = "", theme: str = "") -> Script:
    """Utilise le LLM configuré dans MoneyPrinterTurbo. Lève une erreur claire sinon."""
    from . import mpt_bridge

    prompt = build_llm_prompt(campaign, language=language, duration=duration, variant=variant,
                              audience=audience, theme=theme)
    raw = mpt_bridge.llm_complete(prompt)
    lines = [re.sub(r"^[\-\d\.\)\s]+", "", line).strip() for line in raw.splitlines()]
    lines = [line for line in lines if line]
    parts = STRUCTURE_BY_DURATION[duration]
    segments = []
    for i, line in enumerate(lines):
        part = parts[i] if i < len(parts) else "close"
        segments.append(Segment(part, line))
    return Script(campaign, language, duration, variant, segments, engine="llm")


def variants(campaign: str, *, language: str = "fr", duration: int = 30) -> list[Script]:
    """Les trois versions d'une campagne : émotionnelle, dynamique, explicative."""
    return [generate(campaign, language=language, duration=duration, variant=v, seed=i)
            for i, v in enumerate(catalog.VARIANTS)]
