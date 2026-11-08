"""Vidéo de démonstration : campagne Solitude, 30 s, français, voix ElevenLabs importée."""
import sys, time
from irly_studio import pipeline, scripts

D = "assets/media/demo/"
seg = [("hook", "Tu vis à Dubaï… mais tu ne connais presque personne ?"),
       ("problem", "Entre le travail et le quotidien, ce n'est pas toujours évident de rencontrer du monde."),
       ("irly", "Avec IRLY, découvre des communautés, rejoins des activités, ou organise toi-même une sortie."),
       ("feature", "Padel, running, brunch, plage… il y a toujours quelqu'un qui partage tes envies."),
       ("close", "Parce que vivre à Dubaï, c'est encore mieux à plusieurs."),
       ("cta", "IRLY arrive bientôt. Suis @irlyofficial.")]
p = pipeline.Project(sys.argv[1] if len(sys.argv) > 1 else "demo-solitude-fr")
sc = scripts.Script("solitude", "fr", 30, "emotionnelle", [scripts.Segment(a, b) for a, b in seg])
p.set_script(sc, validated=True)
p.set_media(photos_videos=[D + "dubai_night_back.jpg", D + "dubai_burj_dusk.jpg", D + "dubai_cafe_blurred.jpg"])
p.make_voice("upload", file=D + "vo_solitude_fr.mp3", tone="emotionnel")
if "--no-base" not in sys.argv and not p.meta.get("base_video"):
    t = time.time(); p.make_base(); print("montage MPT", round(time.time() - t), "s")
p.make_timeline()
print(p.preview_stills())
if "--export" in sys.argv:
    t = time.time(); print(p.export(progress=lambda k: print(f"{k:.0%}", end=" ", flush=True))); print(round(time.time() - t), "s")
