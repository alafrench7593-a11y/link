#!/bin/sh
# Quality check of a final video: streams, loudness, black frames, frozen stretches, and a
# contact sheet of one frame every <step> seconds. qa-video.sh <video.mp4> <sheet.jpg> [step=1.5]
set -e
V="$1"; SHEET="$2"; STEP="${3:-1.5}"
echo "== $V"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration,size -of compact "$V"
ffmpeg -hide_banner -i "$V" -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input Integrated|Input True Peak" || true
echo "black (>=0.3s):"; ffmpeg -hide_banner -i "$V" -vf blackdetect=d=0.3:pix_th=0.06 -an -f null - 2>&1 | grep -o "black_start.*" || echo "  none"
echo "frozen (>=1.5s):"; ffmpeg -hide_banner -i "$V" -vf freezedetect=n=0.002:d=1.5 -an -f null - 2>&1 | grep -o "freeze_\(start\|duration\).*" || echo "  none"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
ROWS=$(python3 -c "import math;print(math.ceil(float('$DUR')/float('$STEP')/10))")
ffmpeg -v error -y -i "$V" -vf "fps=1/$STEP,scale=216:384,tile=10x$ROWS:padding=4:color=black" -frames:v 1 "$SHEET"
echo "sheet $SHEET"
