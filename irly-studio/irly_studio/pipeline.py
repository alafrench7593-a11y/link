"""Projet vidéo IRLY : de la campagne au MP4, avec historique sur disque.

Étapes : script -> validation -> médias -> voix -> montage (MoneyPrinterTurbo)
-> motion design -> sous-titres -> prévisualisation -> export. Chaque étape écrit
son résultat dans output/<id>/ ; rien n'est publié automatiquement.
"""

from __future__ import annotations

import json
import subprocess
import os
import shutil
import time
import uuid

from . import catalog, motion, mpt_bridge, render, scripts, subtitles, voice

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "output")
LIBRARY = os.path.join(ROOT, "library")  # bibliothèque de médias importés
MEDIA_KINDS = ("logo", "screens", "videos", "photos", "music")

CHIPS = {
    "solitude": {"fr": ["Padel", "Running", "Brunch", "Plage"], "en": ["Padel", "Running", "Brunch", "Beach"]},
    "girl": {"fr": ["Girl Trip", "Girl Sport", "Girl Expat", "Networking"],
             "en": ["Girl Trip", "Girl Sport", "Girl Expat", "Networking"]},
    "network": {"fr": ["Entrepreneurs", "Freelances", "Startups", "Afterwork"],
                "en": ["Founders", "Freelancers", "Startups", "Afterwork"]},
    "sport": {"fr": ["Running club", "Padel", "Football", "Fitness"],
              "en": ["Running club", "Padel", "Football", "Fitness"]},
    "activites": {"fr": ["Beach club", "Restaurants", "Excursions", "Week-ends"],
                  "en": ["Beach clubs", "Restaurants", "Day trips", "Weekends"]},
    "tutoriel": {"fr": ["Inscription", "Communautés", "Activités", "Créer"],
                 "en": ["Sign up", "Communities", "Activities", "Create"]},
}


def library_files(kind: str) -> list[str]:
    folder = os.path.join(LIBRARY, kind)
    if not os.path.isdir(folder):
        return []
    return sorted(os.path.join(folder, f) for f in os.listdir(folder) if not f.startswith("."))


def add_to_library(kind: str, name: str, data: bytes) -> str:
    if kind not in MEDIA_KINDS:
        raise ValueError(kind)
    folder = os.path.join(LIBRARY, kind)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, os.path.basename(name))
    with open(path, "wb") as f:
        f.write(data)
    return path


class Project:
    def __init__(self, pid: str | None = None):
        self.id = pid or time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
        self.dir = os.path.join(OUTPUT, self.id)
        os.makedirs(self.dir, exist_ok=True)
        self.meta_path = os.path.join(self.dir, "project.json")
        self.meta = json.load(open(self.meta_path)) if os.path.exists(self.meta_path) else {
            "id": self.id, "created": time.strftime("%Y-%m-%d %H:%M"), "status": "brouillon",
            "steps": {}, "format": "tiktok", "fps": 30}

    # ------------------------------------------------------------ persistance
    def save(self):
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(self.meta, f, ensure_ascii=False, indent=2)

    def path(self, name: str) -> str:
        return os.path.join(self.dir, name)

    def step(self, name: str, **info):
        self.meta["steps"][name] = {"at": time.strftime("%H:%M:%S"), **info}
        self.meta["status"] = name
        self.save()

    @staticmethod
    def history() -> list[dict]:
        if not os.path.isdir(OUTPUT):
            return []
        items = []
        for pid in sorted(os.listdir(OUTPUT), reverse=True):
            p = os.path.join(OUTPUT, pid, "project.json")
            if os.path.exists(p):
                items.append(json.load(open(p, encoding="utf-8")))
        return items

    # ------------------------------------------------------------ 1-3 script
    def set_script(self, script: scripts.Script, *, validated: bool = False):
        self.meta["script"] = script.to_dict()
        self.meta["script_validated"] = validated
        self.step("script", engine=script.engine, words=script.word_count)

    @property
    def script(self) -> scripts.Script:
        return scripts.Script.from_dict(self.meta["script"])

    # ------------------------------------------------------------ 4 médias
    def set_media(self, *, photos_videos: list[str], screens: list[str] | None = None,
                  logo: str | None = None, music: str | None = None):
        self.meta["media"] = {"materials": photos_videos, "screens": screens or [], "logo": logo,
                              "music": music}
        self.step("medias", count=len(photos_videos), screens=len(screens or []))

    # ------------------------------------------------------------ 5 voix
    def make_voice(self, provider: str, *, gender="f", tone="naturel", file: str | None = None,
                   voice_id: str | None = None) -> str:
        out = self.path("voice.mp3")
        sc = self.script
        voice.synthesize(provider, sc.text, out, language=sc.language, gender=gender, tone=tone,
                         file=file, voice_id=voice_id)
        self.meta["voice"] = {"provider": provider, "gender": gender, "tone": tone}
        self.step("voix", duration=round(subtitles.audio_duration(out), 2))
        return out

    # ------------------------------------------------------------ 6 montage
    def make_base(self) -> str | None:
        mats = self.meta.get("media", {}).get("materials") or []
        if not mats:
            self.meta["base_video"] = None
            self.step("montage", base="fond de marque (aucun média)")
            return None
        fmt = catalog.FORMATS[self.meta["format"]]
        aspect = "16:9" if fmt["size"][0] > fmt["size"][1] else "9:16"
        combined = mpt_bridge.base_montage(mats, self.path("voice.mp3"), aspect=aspect,
                                           log_path=self.path("mpt.log"))
        base = self.path("base.mp4")
        shutil.copy(combined, base)
        self.meta["base_video"] = base
        self.step("montage", base="MoneyPrinterTurbo", source=combined)
        return base

    # ------------------------------------------------------------ 7-8 animations + sous-titres
    def make_timeline(self) -> list[subtitles.Cue]:
        sc = self.script
        spans = subtitles.align_segments([s.text for s in sc.segments], self.path("voice.mp3"))
        cues = subtitles.build_cues([(s.part, s.text) for s in sc.segments], spans)
        self.meta["spans"] = spans
        with open(self.path("subtitles.srt"), "w", encoding="utf-8") as f:
            f.write(subtitles.to_srt(cues))
        self.step("sous-titres", cues=len(cues))
        return cues

    def save_subtitles(self, srt: str):
        """Sous-titres modifiés à la main avant l'export."""
        with open(self.path("subtitles.srt"), "w", encoding="utf-8") as f:
            f.write(srt)
        self.step("sous-titres", edited=True)

    def plan(self) -> motion.Plan:
        sc = self.script
        info = catalog.CAMPAIGNS[sc.campaign]
        accent = motion.hex_rgb(catalog.UNIVERSES[info["universe"]]["accent"])
        spans = self.meta["spans"]
        duration = self.duration()
        shots = [motion.Shot(seg.part, a, b, seg.text) for seg, (a, b) in zip(sc.segments, spans)]
        # la carte de fin tient jusqu'au bout, et commence au début de l'appel à l'action
        cues = subtitles.from_srt(open(self.path("subtitles.srt"), encoding="utf-8").read())
        media = self.meta.get("media", {})
        cta = next((s.text for s in sc.segments if s.part == "cta"), catalog.DEFAULT_CTA[sc.language])
        cta_lines = [cta.split(". ")[0].rstrip(".") + "."] if "@" in cta else [cta]
        return motion.Plan(shots=shots, cues=cues, duration=duration, accent=accent,
                           language=sc.language, chips=CHIPS.get(sc.campaign, {}).get(sc.language, []),
                           cta_lines=cta_lines, screens=media.get("screens") or [],
                           logo=media.get("logo"))

    def duration(self) -> float:
        """Durée finale : la durée cible de la campagne, jamais moins que la voix + 0,6 s.
        Le temps restant prolonge la carte de fin."""
        voice_len = subtitles.audio_duration(self.path("voice.mp3")) + 0.6
        return max(voice_len, float(self.meta.get("script", {}).get("duration", 0)))

    def make_music(self) -> str:
        custom = self.meta.get("media", {}).get("music")
        dur = self.duration()
        if custom:
            return custom
        out = self.path("music.wav")
        mood = "bright" if self.meta.get("script", {}).get("variant") == "dynamique" else "warm"
        render.synth_music(out, dur + 1, bpm=104 if mood == "bright" else 92, mood=mood)
        return out

    # ------------------------------------------------------------ 9 prévisualisation
    def preview_stills(self, times: list[float] | None = None) -> list[str]:
        plan = self.plan()
        size = catalog.FORMATS[self.meta["format"]]["size"]
        times = times or [min(s.start + 1.2, s.end) for s in plan.shots]
        outs = []
        for i, t in enumerate(times):
            outs.append(render.still(plan, size, self.meta.get("base_video"), t,
                                     self.path(f"preview_{i:02}.png")))
        return outs

    # ------------------------------------------------------------ 10 export
    def export(self, *, fps: int | None = None, progress=None) -> str:
        fps = fps or self.meta.get("fps", 30)
        plan = self.plan()
        music = self.make_music()
        mix = self.path("mix.m4a")
        render.mix_audio(self.path("voice.mp3"), music, mix, plan.duration)
        size = catalog.FORMATS[self.meta["format"]]["size"]
        out = self.path(f"irly_{self.meta['script']['campaign']}_{self.meta['format']}.mp4")
        render.render(plan, size=size, base_video=self.meta.get("base_video"), audio=mix,
                      out_path=out, fps=fps, progress=progress)
        render.still(plan, size, self.meta.get("base_video"), plan.shots[0].start + 1.0,
                     self.path("poster.png"))
        self.meta["final"] = out
        self.step("export", file=os.path.basename(out), fps=fps)
        return out


def ugc_finish(video: str, script_text: str, *, campaign: str = "girl", language: str = "fr",
               cta: str | None = None, endcard_seconds: float = 3.0, pid: str | None = None,
               fmt: str = "tiktok", fps: int = 30) -> str:
    """Mode UGC : une vidéo d'avatar qui parle (HeyGen, Vidnoz, Kling, SadTalker…)
    garde sa propre voix ; on ajoute sous-titres, musique discrète et carte de fin IRLY."""
    p = Project(pid)
    text_lines = [l.strip() for l in script_text.splitlines() if l.strip()]
    cta = cta or catalog.SHORT_CTA[language]
    voice_path = p.path("voice.mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "44100",
                    "-b:a", "192k", voice_path], check=True)
    clip_len = subtitles.audio_duration(voice_path)
    spans = subtitles.align_segments(text_lines, voice_path)
    cues = subtitles.build_cues([("ugc", t) for t in text_lines], spans)
    with open(p.path("subtitles.srt"), "w", encoding="utf-8") as f:
        f.write(subtitles.to_srt(cues))
    accent = motion.hex_rgb(catalog.UNIVERSES[catalog.CAMPAIGNS[campaign]["universe"]]["accent"])
    duration = clip_len + endcard_seconds
    plan = motion.Plan(shots=[motion.Shot("ugc", 0, clip_len, ""), motion.Shot("cta", clip_len, duration, cta)],
                       cues=cues, duration=duration, accent=accent, language=language,
                       cta_lines=[cta.split(". ")[0].rstrip(".") + "."])
    music = p.path("music.wav")
    render.synth_music(music, duration + 1, bpm=96, mood="bright")
    mix = p.path("mix.m4a")
    render.mix_audio(voice_path, music, mix, duration, music_db=-20)
    size = catalog.FORMATS[fmt]["size"]
    out = p.path(f"irly_ugc_{campaign}_{fmt}.mp4")
    render.render(plan, size=size, base_video=video, audio=mix, out_path=out, fps=fps)
    p.meta.update({"mode": "ugc", "source_video": video, "final": out,
                   "script": {"campaign": campaign, "language": language, "duration": round(duration),
                              "variant": "ugc", "text": script_text, "segments": []}})
    p.step("export", file=os.path.basename(out))
    return out
