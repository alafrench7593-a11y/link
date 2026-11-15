#!/usr/bin/env bash
# Remplace la musique de toutes les vidéos par un morceau fourni, sans refaire l'image.
# Usage : tools/swap_music.sh /chemin/vers/morceau.mp3 [début_en_secondes]
# Pour chaque film : extrait de la durée du film à partir du début choisi (par défaut 43.03 s, le passage
# déjà utilisé pour « Freaky T »), fondu de sortie, puis mix.mjs (la musique baisse sous la voix, -14 LUFS).
# Les versions avec la musique libre restent dans examples/ ; les nouvelles finissent par _musique_perso.mp4.
set -euo pipefail
SRC="$1"; START="${2:-43.03}"
cd "$(dirname "$0")/.."
declare -A OUT=(
  [irly-launch]=irly_lancement_fr_44s_4k [irly-launch-en]=irly_launch_en_44s_4k
  [irly-preorder]=irly_precommande_fr_75s_soustitree [irly-preorder-clean]=irly_precommande_fr_75s [irly-preorder-15]=irly_precommande_fr_15s
  [irly-photos]=irly_dubai_en_vrai_30s
  [irly-boxe]=irly_concours_boxe_40s_4k [irly-boxe-clean]=irly_concours_boxe_40s_sans_soustitres [irly-boxe-safe]=irly_concours_boxe_40s_sans_affiches
)
for d in "${!OUT[@]}"; do
  [ -f "out/$d/video_9x16.mp4" ] || { echo "skip $d (pas encore rendu)"; continue; }
  dur=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$d/film.json')).duration)")
  [ -f "$d/audio/music.wav" ] && [ ! -f "$d/audio/music_libre.wav" ] && cp "$d/audio/music.wav" "$d/audio/music_libre.wav"
  ffmpeg -v error -y -ss "$START" -t "$dur" -i "$SRC" -af "afade=t=in:d=0.3,afade=t=out:st=$(echo "$dur - 1.5" | bc):d=1.5" -ar 48000 -ac 2 "$d/audio/music.wav"
  dsf=""; [[ "${OUT[$d]}" == *4k* ]] && dsf=2
  DSF=$dsf node tools/motion-reel/mix.mjs "$d" | tail -1
  cp "out/$d/final.mp4" "examples/${OUT[$d]}_musique_perso.mp4"
  # la version sans voix de la précommande
  if [ "$d" = irly-preorder-clean ]; then mv "$d/audio/vo.wav" /tmp/vo_keep.wav; node tools/motion-reel/mix.mjs "$d" | tail -1; cp "out/$d/final.mp4" examples/irly_precommande_fr_75s_sans_voix_musique_perso.mp4; mv /tmp/vo_keep.wav "$d/audio/vo.wav"; fi
  cp "$d/audio/music_libre.wav" "$d/audio/music.wav"   # on garde la musique libre comme musique par défaut du projet
done
echo SWAPDONE
