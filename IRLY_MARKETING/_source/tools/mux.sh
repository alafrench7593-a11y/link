#!/bin/sh
# Muxes a silent render with its soundtrack: loudness normalised to -14 LUFS (social platforms), AAC 192k.
# mux.sh <silent.mp4> <music.wav> <out.mp4>
set -e
ffmpeg -v error -y -i "$1" -i "$2" -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$3"
echo "muxed $3"
