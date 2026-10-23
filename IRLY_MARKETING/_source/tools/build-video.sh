#!/bin/sh
# Full build of one film: soundtrack, silent render, mux, QA sheet.
# build-video.sh <name> <seconds> <output-folder>   (run from IRLY_MARKETING/)
set -e
N="$1"; S="$2"; O="$3"
python3 _source/tools/music.py "_source/videos/audio/$N.json" "_source/videos/audio/$N.wav"
node _source/tools/render-video.mjs _source "videos/$N.html" "$S" "_source/videos/renders/${N}_silent.mp4" 30 1
_source/tools/mux.sh "_source/videos/renders/${N}_silent.mp4" "_source/videos/audio/$N.wav" "$O/$N.mp4"
_source/tools/qa-video.sh "$O/$N.mp4" "07_PREVIEWS_AND_REPORT/${N}_contact_sheet.jpg" 1
