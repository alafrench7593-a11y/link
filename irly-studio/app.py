"""IRLY Studio — interface de production vidéo marketing (Streamlit).

Lancer : ./start.sh  (ou  <venv MoneyPrinterTurbo>/bin/streamlit run app.py)
Rien n'est publié automatiquement : l'export produit un MP4 à télécharger.
"""

import os

import streamlit as st

from irly_studio import catalog, mpt_bridge, pipeline, scripts, subtitles, voice

st.set_page_config(page_title="IRLY Studio", page_icon="🎬", layout="wide")
st.markdown("""<style>
h1, h2, h3 {letter-spacing:-0.02em}
.step {font-size:0.8rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
</style>""", unsafe_allow_html=True)

PAGES = ["Nouvelle vidéo", "Avatar UGC", "Campagnes IRLY", "Bibliothèque de médias", "Historique"]
page = st.sidebar.radio("IRLY Studio", PAGES)
st.sidebar.caption(f"Moteur de montage : MoneyPrinterTurbo {mpt_bridge.version()}"
                   + ("" if mpt_bridge.available() else " (introuvable)"))
st.sidebar.caption("Clé ElevenLabs : " + ("présente" if os.environ.get("ELEVENLABS_API_KEY") else "absente"))


def project() -> pipeline.Project | None:
    pid = st.session_state.get("pid")
    return pipeline.Project(pid) if pid else None


# ============================================================== avatar UGC
if page == "Avatar UGC":
    from irly_studio import talking

    st.title("Avatar UGC")
    st.info("Visage qui parle généré par IA. Ne le présente jamais comme une vraie utilisatrice IRLY, "
            "et active l'étiquette « contenu généré par IA » sur TikTok.")
    faces = pipeline.library_files("photos") + [os.path.join("assets/media/ugc", f)
                                                for f in sorted(os.listdir("assets/media/ugc")) if f.endswith(".png")]
    face = st.selectbox("Visage (photo de face, avec l'accord de la personne, ou illustration IRLY)", faces,
                        format_func=os.path.basename)
    if face:
        st.image(face, width=160)
    text = st.text_area("Texte dit face caméra (une phrase par ligne)", height=170, value=(
        "Les filles qui vivent à Dubaï, j'ai une question.\n"
        "Vous faites comment pour rencontrer de nouvelles copines ?\n"
        "Parce qu'entre le travail, les groupes WhatsApp et les sorties où tu connais personne… c'est pas toujours évident.\n"
        "C'est pour ça qu'IRLY Girl a été créé.\n"
        "Tu peux rejoindre des communautés de filles, proposer des activités et rencontrer du monde dans la vraie vie.\n"
        "Et en plus, c'est gratuit !"))
    vsrc = st.radio("Voix", ["Chatterbox (local, gratuit)", "Fichier importé"], horizontal=True)
    vfile = st.file_uploader("Fichier voix", type=["mp3", "wav", "m4a"]) if vsrc == "Fichier importé" else None
    exag = st.slider("Expressivité (Chatterbox)", 0.25, 1.0, 0.6) if vsrc.startswith("Chatterbox") else 0.5

    def engine_label(k):
        e = talking.ENGINES[k]
        lic = {True: "usage commercial OK", False: "TEST UNIQUEMENT", None: "licence à vérifier"}[e["commercial"]]
        return f"{e['label']} · {lic}" + ("" if talking.installed(k) else " · non installé")

    engine = st.selectbox("Moteur", list(talking.ENGINES), format_func=engine_label)
    st.caption(talking.ENGINES[engine]["note"])
    cta = st.text_input("Carte de fin", "IRLY Girl. Suis @irlyofficial.")
    if st.button("Générer la vidéo UGC", type="primary"):
        p = pipeline.Project()
        try:
            with st.spinner("Voix…"):
                voice_path = p.path("voice_source.mp3")
                if vfile:
                    open(p.path("upload_" + vfile.name), "wb").write(vfile.getvalue())
                    voice.import_audio(p.path("upload_" + vfile.name), voice_path)
                else:
                    talking.chatterbox(" ".join(l.strip() for l in text.splitlines() if l.strip()),
                                       voice_path, exaggeration=exag, log=p.path("chatterbox.log"))
            st.audio(voice_path)
            with st.spinner(f"{talking.ENGINES[engine]['label']} sur processeur : compter 10 à 40 minutes…"):
                info = talking.talk(engine, face, voice_path, p.path("talking.mp4"), log=p.path(f"{engine}.log"))
            with st.spinner("Sous-titres, musique et carte de fin…"):
                out = pipeline.ugc_finish(p.path("talking.mp4"), text, campaign="girl", cta=cta, pid=p.id)
            st.success(f"Vidéo prête en {info['seconds']} s de calcul : {out}")
            st.video(out)
        except Exception as exc:
            st.error(str(exc))

# ============================================================== campagnes
elif page == "Campagnes IRLY":
    st.title("Campagnes IRLY")
    for key, c in catalog.CAMPAIGNS.items():
        u = catalog.UNIVERSES[c["universe"]]
        with st.expander(f"{c['label']}  ·  {u['label']}"):
            st.write(c["brief"])
            st.write("**Accroches disponibles**")
            for h in scripts.hooks_for(key, "fr"):
                st.write("• " + h)
            if c.get("requires_screens"):
                st.warning("Cette campagne montre les vrais écrans de l'app : importe les captures "
                           "(inscription, communautés, recherche, participation, création).")
    st.subheader("Univers")
    cols = st.columns(len(catalog.UNIVERSES))
    for col, u in zip(cols, catalog.UNIVERSES.values()):
        col.markdown(f"**{u['label']}**  \n" + "  \n".join(u["topics"]))

# ============================================================== bibliothèque
elif page == "Bibliothèque de médias":
    st.title("Bibliothèque de médias")
    st.info("Uniquement des médias réels dont IRLY a les droits. Pas de capture d'écran inventée, "
            "pas de photo de personne présentée comme utilisatrice IRLY sans autorisation.")
    labels = {"logo": "Logo officiel (PNG transparent)", "screens": "Captures et enregistrements de l'app",
              "photos": "Photos (activités, Dubaï)", "videos": "Vidéos (activités, Dubaï)",
              "music": "Musiques autorisées"}
    types = {"logo": ["png"], "screens": ["png", "jpg", "jpeg"], "photos": ["jpg", "jpeg", "png", "webp"],
             "videos": ["mp4", "mov"], "music": ["mp3", "wav", "m4a"]}
    for kind, label in labels.items():
        st.subheader(label)
        up = st.file_uploader(label, type=types[kind], accept_multiple_files=True, key=f"up_{kind}",
                              label_visibility="collapsed")
        for f in up or []:
            pipeline.add_to_library(kind, f.name, f.getvalue())
        files = pipeline.library_files(kind)
        st.caption(f"{len(files)} fichier(s)")
        if kind in ("photos", "screens", "logo") and files:
            st.image(files[:8], width=110)

# ============================================================== historique
elif page == "Historique":
    st.title("Historique")
    for item in pipeline.Project.history():
        sc = item.get("script", {})
        label = catalog.CAMPAIGNS.get(sc.get("campaign"), {}).get("label", "—")
        with st.expander(f"{item['created']} · {label} · {sc.get('variant', '')} · étape : {item['status']}"):
            st.code(sc.get("text", ""), language=None)
            if item.get("final") and os.path.exists(item["final"]):
                st.video(item["final"])
            if st.button("Rouvrir ce projet", key=item["id"]):
                st.session_state["pid"] = item["id"]
                st.success("Projet rouvert dans « Nouvelle vidéo ».")

# ============================================================== nouvelle vidéo
else:
    st.title("Nouvelle vidéo")
    p = project()

    st.markdown('<div class="step">1 · Campagne</div>', unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    campaign = c1.selectbox("Campagne", list(catalog.CAMPAIGNS), format_func=lambda k: catalog.CAMPAIGNS[k]["label"])
    variant = c2.selectbox("Version", list(catalog.VARIANTS), format_func=str.capitalize)
    duration = c3.selectbox("Durée", catalog.DURATIONS, index=1, format_func=lambda d: f"{d} s")
    language = c4.selectbox("Langue", list(catalog.LANGUAGES), format_func=catalog.LANGUAGES.get)
    c5, c6, c7 = st.columns([1, 1, 2])
    fmt = c5.selectbox("Format", list(catalog.FORMATS), format_func=lambda k: catalog.FORMATS[k]["label"])
    fps = c6.selectbox("Images/s", [30, 60])
    audience = c7.text_input("Public ciblé", "Francophones de Dubaï")
    theme = st.text_input("Thème précis (facultatif)", "")

    st.markdown('<div class="step">2 · Script</div>', unsafe_allow_html=True)
    engine = st.radio("Moteur", ["Textes IRLY (sans clé)", "LLM configuré dans MoneyPrinterTurbo"],
                      horizontal=True)
    hooks = scripts.hooks_for(campaign, language) if language in catalog.TEMPLATE_LANGUAGES else []
    hook = st.selectbox("Accroche", ["Automatique"] + hooks) if hooks else None
    seed = st.number_input("Version n°", 0, 99, 0, help="Change pour obtenir une autre combinaison de phrases.")
    if st.button("Générer le script", type="primary"):
        try:
            if engine.startswith("Textes"):
                sc = scripts.generate(campaign, language=language, duration=duration, variant=variant,
                                      seed=seed, hook=None if hook in (None, "Automatique") else hook)
            else:
                sc = scripts.generate_with_llm(campaign, language=language, duration=duration,
                                               variant=variant, audience=audience, theme=theme)
            p = pipeline.Project()
            p.meta["format"], p.meta["fps"] = fmt, fps
            p.set_script(sc)
            st.session_state["pid"] = p.id
        except Exception as exc:
            st.error(str(exc))

    if p and p.meta.get("script"):
        sc = p.script
        st.caption(f"Projet {p.id} · environ {sc.estimated_seconds} s de voix pour {sc.duration} s")
        edited = []
        for i, seg in enumerate(sc.segments):
            edited.append(scripts.Segment(seg.part, st.text_area(seg.label, seg.text, key=f"seg{p.id}{i}", height=68)))
        if st.button("Valider le script"):
            sc.segments = edited
            p.set_script(sc, validated=True)
            st.success("Script validé.")

    if p and p.meta.get("script_validated"):
        st.markdown('<div class="step">3 · Médias</div>', unsafe_allow_html=True)
        from irly_studio import app_link
        app_photos = app_link.photos(p.script.campaign, limit=8)
        photos = app_photos + pipeline.library_files("photos") + pipeline.library_files("videos")
        demo = [os.path.join("assets/media/demo", f) for f in sorted(os.listdir("assets/media/demo"))
                if f.endswith((".jpg", ".png", ".mp4"))]
        mats = st.multiselect("Photos et vidéos (dans l'ordre d'apparition)", photos + demo,
                              default=(p.meta.get("media", {}).get("materials") or app_photos[:4]),
                              format_func=os.path.basename)
        st.caption("Photos de l'app : " + " · ".join(app_link.credit_for(m)[:60] for m in mats[:3]))
        screens = st.multiselect("Écrans de l'app IRLY dans le téléphone", app_link.all_screens(p.script.language)
                                 + pipeline.library_files("screens"),
                                 default=app_link.screens(p.script.campaign, p.script.language),
                                 format_func=os.path.basename)
        logos = pipeline.library_files("logo")
        logo = st.selectbox("Logo", ["Logo IRLY de l'app (points)"] + logos, format_func=os.path.basename)
        musics = pipeline.library_files("music")
        music = st.selectbox("Musique", ["Musique générée (sans droits)"] + musics, format_func=os.path.basename)
        if st.button("Valider les médias"):
            p.set_media(photos_videos=mats, screens=screens,
                        logo=None if logo.startswith("Logo IRLY") else logo,
                        music=None if music.startswith("Musique") else music)
            st.success("Médias enregistrés.")

    if p and p.meta.get("media") is not None and p.meta.get("script_validated"):
        st.markdown('<div class="step">4 · Voix off</div>', unsafe_allow_html=True)
        v1, v2, v3 = st.columns(3)
        provider = v1.selectbox("Voix", ["edge", "elevenlabs", "upload"],
                                format_func={"edge": "Microsoft Edge (gratuit)", "elevenlabs": "ElevenLabs",
                                             "upload": "Importer un fichier"}.get)
        gender = v2.selectbox("Genre", ["f", "m"], format_func={"f": "Féminine", "m": "Masculine"}.get)
        tone = v3.selectbox("Ton", list(catalog.TONES), index=list(catalog.TONES).index(catalog.VARIANTS[p.script.variant]),
                            format_func=catalog.TONES.get)
        upload = st.file_uploader("Fichier voix off", type=["mp3", "wav", "m4a"]) if provider == "upload" else None
        if st.button("Générer la voix (préécoute)"):
            try:
                src = None
                if upload:
                    src = p.path("upload_" + upload.name)
                    open(src, "wb").write(upload.getvalue())
                p.make_voice(provider, gender=gender, tone=tone, file=src)
            except Exception as exc:
                st.error(str(exc))
        if os.path.exists(p.path("voice.mp3")):
            st.audio(p.path("voice.mp3"))

    if p and os.path.exists(p.path("voice.mp3")):
        st.markdown('<div class="step">5 · Montage, animations, sous-titres</div>', unsafe_allow_html=True)
        if st.button("Assembler (MoneyPrinterTurbo + motion design)"):
            with st.spinner("Montage MoneyPrinterTurbo… (2 à 3 minutes)"):
                try:
                    p.make_base()
                    p.make_timeline()
                    st.session_state["stills"] = p.preview_stills()
                except Exception as exc:
                    st.error(str(exc))
        if os.path.exists(p.path("subtitles.srt")):
            srt = st.text_area("Sous-titres (modifiables avant l'export)",
                               open(p.path("subtitles.srt"), encoding="utf-8").read(), height=220)
            if st.button("Enregistrer les sous-titres et rafraîchir l'aperçu"):
                p.save_subtitles(srt)
                st.session_state["stills"] = p.preview_stills()
            st.markdown('<div class="step">6 · Prévisualisation</div>', unsafe_allow_html=True)
            stills = st.session_state.get("stills") or [p.path(f) for f in sorted(os.listdir(p.dir))
                                                        if f.startswith("preview_")]
            if stills:
                st.image(stills, width=150)

            st.markdown('<div class="step">7 · Export</div>', unsafe_allow_html=True)
            if st.button("Exporter le MP4", type="primary"):
                bar = st.progress(0.0)
                try:
                    out = p.export(fps=p.meta.get("fps", 30), progress=lambda k: bar.progress(min(k, 1.0)))
                    st.success(f"Vidéo prête : {out}")
                except Exception as exc:
                    st.error(str(exc))
            if p.meta.get("final") and os.path.exists(p.meta["final"]):
                st.video(p.meta["final"])
                st.download_button("Télécharger", open(p.meta["final"], "rb"), file_name=os.path.basename(p.meta["final"]))
                st.caption("Publication : manuelle, après validation. Le studio ne publie jamais seul.")
