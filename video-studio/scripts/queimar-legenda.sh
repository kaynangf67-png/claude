#!/usr/bin/env bash
# Queima legenda .srt no vídeo em estilo Reels/TikTok (fonte grossa, contorno, centro-baixo).
# Uso: queimar-legenda.sh VIDEO LEGENDA.srt [SAIDA.mp4] [TAMANHO_FONTE=16]
set -euo pipefail
in="$1"; srt="$2"; out="${3:-${in%.*}-legendado.mp4}"; size="${4:-16}"
style="FontName=Montserrat Black,FontSize=${size},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0,Bold=1,Alignment=2,MarginV=60"
ffmpeg -hide_banner -v error -stats -y -i "$in" \
  -vf "subtitles='${srt//\'/\\\'}':force_style='${style}'" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a copy -movflags +faststart "$out"
echo "$out"
