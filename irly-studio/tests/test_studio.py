"""Tests du studio IRLY. Lancer : <venv MPT>/bin/python -m pytest tests -q"""

import os
import re
import subprocess

import pytest
from PIL import Image

from irly_studio import catalog, motion, mpt_bridge, pipeline, render, scripts, subtitles, voice

DEMO = os.path.join(os.path.dirname(__file__), "..", "assets", "media", "demo")
VO = os.path.join(DEMO, "vo_solitude_fr.mp3")


# ---------------------------------------------------------------- scripts
@pytest.mark.parametrize("campaign", list(catalog.CAMPAIGNS))
@pytest.mark.parametrize("duration", catalog.DURATIONS)
@pytest.mark.parametrize("variant", list(catalog.VARIANTS))
@pytest.mark.parametrize("language", catalog.TEMPLATE_LANGUAGES)
def test_script_fits_duration(campaign, duration, variant, language):
    sc = scripts.generate(campaign, language=language, duration=duration, variant=variant)
    assert sc.estimated_seconds <= duration
    assert sc.segments[0].part == "hook" and sc.segments[-1].part == "cta"
    assert "@irlyofficial" in sc.segments[-1].text


def test_no_invented_claims():
    """Ni témoignage, ni chiffre d'utilisateurs, ni partenaire dans les textes écrits."""
    text = repr(catalog.CAMPAIGNS)
    assert not re.search(r"\d[\d\s]*\s*(utilisateurs|membres|users|members)", text)
    assert "témoign" not in text.lower() and "partenaire officiel" not in text.lower()


def test_variants_differ():
    texts = [s.text for s in scripts.variants("solitude", duration=30)]
    assert len(set(texts)) == 3


def test_unknown_campaign_and_language():
    with pytest.raises(ValueError):
        scripts.generate("inconnue")
    with pytest.raises(ValueError):
        scripts.generate("solitude", language="de")


def test_llm_prompt_has_rules():
    prompt = scripts.build_llm_prompt("sport", language="de", duration=45, variant="dynamique")
    assert "Deutsch" in prompt and "témoignage" in prompt and "@irlyofficial" in prompt


# ---------------------------------------------------------------- sous-titres
def test_alignment_snaps_to_pauses():
    segs = ["Tu vis à Dubaï… mais tu ne connais presque personne ?",
            "Entre le travail et le quotidien, ce n'est pas toujours évident de rencontrer du monde."]
    spans = subtitles.align_segments(segs, VO)
    assert len(spans) == 2 and spans[0][1] <= spans[1][0]


def test_srt_roundtrip_and_short_chunks():
    cues = subtitles.build_cues([("hook", "Padel, running, brunch, plage… il y a toujours quelqu'un qui partage tes envies.")],
                                [(0.0, 4.0)])
    assert all(len(c.text.split()) <= 5 for c in cues)
    back = subtitles.from_srt(subtitles.to_srt(cues))
    assert [c.text for c in back] == [c.text for c in cues]
    assert abs(back[-1].end - 4.0) < 0.01


def test_tags_removed():
    assert subtitles.clean("[warm] Bonjour [pause] toi") == "Bonjour toi"


# ---------------------------------------------------------------- motion
def _plan(screens=None):
    shots = [motion.Shot(p, i * 2.0, i * 2.0 + 1.8, "Tu vis à Dubaï mais tu ne connais presque personne ?")
             for i, p in enumerate(["hook", "problem", "irly", "feature", "close", "cta"])]
    cues = [subtitles.Cue(2.0, 3.0, "Avec IRLY, découvre"), subtitles.Cue(6.0, 7.0, "Padel, running")]
    return motion.Plan(shots, cues, 12.0, (255, 90, 60), chips=["Padel", "Running"],
                       cta_lines=["IRLY arrive bientôt."], screens=screens or [])


@pytest.mark.parametrize("size", [(1080, 1920), (1920, 1080)])
def test_frames_render_every_scene(size):
    L = motion.Layout(*size)
    plan = _plan()
    for t in [0.5, 2.5, 4.5, 6.5, 8.5, 11.0]:
        img = motion.render_frame(plan, L, t, None)
        assert img.size == size


def test_real_screen_used_on_phone(tmp_path):
    shot = tmp_path / "screen.png"
    Image.new("RGB", (390, 1600), (10, 200, 30)).save(shot)
    face = motion.phone_face(_plan([str(shot)]), 450, 927, 0.0, 0)
    px = face.getpixel((225, 460))
    assert px[1] > 150 and px[0] < 60  # la capture verte est bien à l'écran


def test_text_stays_in_safe_area():
    L = motion.Layout(1080, 1920)
    f, lines = motion.fit_font("Dubaï, c'est incroyable. Seul, beaucoup moins.", motion.DISPLAY_FONT,
                               L.text_w, 4, 104, 44)
    assert all(motion.text_width(f, l) <= L.text_w for l in lines)
    assert L.safe_right <= 0.87 * L.w and L.sub_y < 0.72 * L.h


# ---------------------------------------------------------------- voix et erreurs
def test_elevenlabs_without_key(monkeypatch, tmp_path):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="ELEVENLABS_API_KEY"):
        voice.elevenlabs("Bonjour", str(tmp_path / "v.mp3"))


def test_import_audio(tmp_path):
    out = voice.import_audio(VO, str(tmp_path / "v.mp3"))
    assert abs(subtitles.audio_duration(out) - subtitles.audio_duration(VO)) < 0.2


def test_montage_needs_media():
    with pytest.raises(ValueError):
        mpt_bridge.base_montage([], VO)


def test_music_and_mix(tmp_path):
    music = str(tmp_path / "m.wav")
    render.synth_music(music, 6.0)
    out = str(tmp_path / "mix.m4a")
    render.mix_audio(VO, music, out, 6.0)
    lufs, peak = render.measure_lufs(out)
    assert -15.5 < lufs < -12.5 and peak < -0.5


# ---------------------------------------------------------------- historique
def test_project_history(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "OUTPUT", str(tmp_path))
    p = pipeline.Project("t1")
    p.set_script(scripts.generate("sport", duration=15))
    assert pipeline.Project.history()[0]["id"] == "t1"
    assert pipeline.Project("t1").script.campaign == "sport"


# ---------------------------------------------------------------- avatars parlants
def test_engines_license_flags():
    from irly_studio import talking
    assert talking.ENGINES["wav2lip"]["commercial"] is False
    assert talking.ENGINES["liveportrait"]["commercial"] is False
    assert talking.ENGINES["sadtalker"]["commercial"] is True


def test_engine_missing_gives_clear_error(monkeypatch, tmp_path):
    from irly_studio import talking
    monkeypatch.setattr(talking, "TOOLS", str(tmp_path))
    with pytest.raises(RuntimeError, match="install_talking_heads"):
        talking.talk("sadtalker", "face.png", VO, str(tmp_path / "o.mp4"))
