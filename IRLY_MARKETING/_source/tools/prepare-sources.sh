#!/bin/sh
# Rebuilds the heavy sources that are not committed (frame folders), from the IRLY repository.
# prepare-sources.sh <path to the irly repository>   (run from IRLY_MARKETING/)
# Needs the demo web build served on :8090 for the screen recordings:
#   (in irly) npm ci --ignore-scripts && EXPO_PUBLIC_DEMO=1 npx expo export --platform web --output-dir dist-demo
#   node _source/tools/serve.mjs <irly>/dist-demo 8090 &
set -e
IRLY="$1"
F=_source/assets/films
for f in dubaiMarina beachClub rooftop dubaiNight; do
  mkdir -p "$F/$f"
  ffmpeg -v error -y -i "$IRLY/site/video/k-$f.mp4" -t 8 -vf "scale=-2:1920:flags=lanczos,crop=1080:1920,fps=30" -q:v 3 -start_number 0 "$F/$f/%05d.jpg"
  echo "film $f"
done
# Real screen recordings of the demo, one spec per clip (see _source/videos/seq/*.json).
for s in _source/videos/seq/[mg]_*.json; do
  node _source/tools/capture-seq.mjs "$s"
done
