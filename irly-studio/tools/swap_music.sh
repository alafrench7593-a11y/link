#!/usr/bin/env bash
# Remplace la musique de toutes les vidéos par un morceau fourni, sans refaire l'image.
# Usage : tools/swap_music.sh [film ...]   (sans argument : tous les films déjà rendus)
# Morceau et passage de chaque film : table TRACK plus bas (passages choisis par beats.py ou par le volume).
# Pour chaque film : extrait de la durée du film à partir du début choisi (par défaut 43.03 s, le passage
# déjà utilisé pour « Freaky T »), fondu de sortie, puis mix.mjs (la musique baisse sous la voix, -14 LUFS).
# Les versions avec la musique libre restent dans examples/ ; les nouvelles finissent par _musique_perso.mp4.
set -euo pipefail
cd "$(dirname "$0")/.."
A=assets_music
declare -A TRACK=(
  [irly-launch]="$A/fc888b2d-Rick_Ross_-_Aston_Martin_Music_Instrumental.mp3:179"
  [irly-launch-en]="$A/fc888b2d-Rick_Ross_-_Aston_Martin_Music_Instrumental.mp3:179"
  [irly-preorder]="$A/a40ab248-Instrumental_Pocahontas_-_PLK__Paroles_HD.mp3:79.75"
  [irly-preorder-clean]="$A/a40ab248-Instrumental_Pocahontas_-_PLK__Paroles_HD.mp3:79.75"
  [irly-preorder-15]="$A/c34a16d2-50_Cent_-_Big_Rich_Town_Instrumental.mp3:27.31"
  [irly-photos]="$A/bbeb3e48-Instrumental_Mopao_Aye_-_Triangle_Des_Bermudes__Paroles_HD.mp3:159.9"
  [irly-boxe]="$A/1f4da492-50_Cent_-_Power_Powder_Respect_ft._Lil_Durk_Jeremih_Instrumental.mp3:120.81"
  [irly-boxe-clean]="$A/1f4da492-50_Cent_-_Power_Powder_Respect_ft._Lil_Durk_Jeremih_Instrumental.mp3:120.81"
  [irly-boxe-safe]="$A/1f4da492-50_Cent_-_Power_Powder_Respect_ft._Lil_Durk_Jeremih_Instrumental.mp3:120.81"
  [lg-promo]="$A/c34a16d2-50_Cent_-_Big_Rich_Town_Instrumental.mp3:77"
  [irly-product-demo]="$A/fc888b2d-Rick_Ross_-_Aston_Martin_Music_Instrumental.mp3:77"
)
declare -A OUT=(
  [irly-launch]=irly_lancement_fr_44s_4k [irly-launch-en]=irly_launch_en_44s_4k
  [irly-preorder]=irly_precommande_fr_75s_soustitree [irly-preorder-clean]=irly_precommande_fr_75s [irly-preorder-15]=irly_precommande_fr_15s
  [irly-photos]=irly_dubai_en_vrai_30s
  [irly-boxe]=irly_concours_boxe_40s_4k [irly-boxe-clean]=irly_concours_boxe_40s_sans_soustitres [irly-boxe-safe]=irly_concours_boxe_40s_sans_affiches
  [lg-promo]=irly_loupgarou_tiktok_fr_45s [irly-product-demo]=irly_product_demo_en_72s
)
LIST=("$@"); [ ${#LIST[@]} -eq 0 ] && LIST=("${!OUT[@]}")
for d in "${LIST[@]}"; do
  SRC="${TRACK[$d]%:*}"; START="${TRACK[$d]##*:}"
  V=out/$d/video_9x16.mp4; [ -f "$V" ] || V=out/$d/video_16x9.mp4; [ -f "$V" ] || { echo "skip $d (pas encore rendu)"; continue; }
  dur=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$d/film.json')).duration)")
  [ -f "$d/audio/music.wav" ] && [ ! -f "$d/audio/music_libre.wav" ] && cp "$d/audio/music.wav" "$d/audio/music_libre.wav"
  ffmpeg -v error -y -ss "$START" -t "$dur" -i "$SRC" -af "afade=t=in:d=0.3,afade=t=out:st=$(echo "$dur - 1.5" | bc):d=1.5" -ar 48000 -ac 2 "$d/audio/music.wav"
  # concours : on garde l'ambiance de foule synthétique sous le morceau
  if [[ "$d" == irly-boxe* ]] && [ -f irly-boxe/audio/crowd.wav ]; then ffmpeg -v error -y -i "$d/audio/music.wav" -i irly-boxe/audio/crowd.wav -filter_complex "[0][1]amix=inputs=2:normalize=0:duration=first" -ar 48000 "$d/audio/music_tmp.wav" && mv "$d/audio/music_tmp.wav" "$d/audio/music.wav"; fi
  dsf=""; [[ "${OUT[$d]}" == *4k* ]] && dsf=2
  DSF=$dsf node tools/motion-reel/mix.mjs "$d" | tail -1
  cp "out/$d/final.mp4" "examples/${OUT[$d]}_musique_perso.mp4"
  # la version sans voix de la précommande
  if [ "$d" = irly-preorder-clean ]; then mv "$d/audio/vo.wav" "$d/audio/vo_keep.wav"; node tools/motion-reel/mix.mjs "$d" | tail -1; cp "out/$d/final.mp4" examples/irly_precommande_fr_75s_sans_voix_musique_perso.mp4; mv "$d/audio/vo_keep.wav" "$d/audio/vo.wav"; fi
  cp "$d/audio/music_libre.wav" "$d/audio/music.wav"   # on garde la musique libre comme musique par défaut du projet
done
echo SWAPDONE
