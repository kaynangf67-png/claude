#!/usr/bin/env bash
# Passo 3 e 4: projeto HyperFrames a partir do que o montar.py gerou.
#
#   projeto.sh gerar  DIR "t1,t2,..."   copia o modelo para DIR/hf, gera, valida (lint) e tira snapshots
#                                       nos tempos pedidos -> DIR/hf/snaps/contact-sheet.jpg (OLHE antes de renderizar)
#   projeto.sh render DIR NOME          renderiza, normaliza para -14 LUFS e grava video-studio/saida/NOME.mp4;
#                                       salva o projeto (sem vídeo/voz) em video-studio/projetos/NOME
#
# DIR precisa ter: base.mp4, voz.wav, palavras.json, edicao.json, (in.mp4, tomadas.json, keep.json)
set -euo pipefail
VS="$(cd "$(dirname "$0")/.." && pwd)"
. /opt/hf-cli/env.sh
export HYPERFRAMES_SKIP_SKILLS=1
cmd="$1"; D="$(cd "$2" && pwd)"; H="$D/hf"

case "$cmd" in
  gerar)
    rm -rf "$H"; mkdir -p "$H/assets"
    cp -r "$VS/template/." "$H/"
    cp "$D/base.mp4" "$D/voz.wav" "$H/assets/"
    cp "$D/palavras.json" "$D/edicao.json" "$H/"
    (cd "$H" && python3 gen.py)
    (cd "$H" && hyperframes lint --json 2>/dev/null | python3 -c "
import json,sys; d=json.load(sys.stdin); print('lint: erros', d['errorCount'], 'avisos', d['warningCount'])
for f in d['findings']: print(' -', f.get('severity'), f.get('code'), (f.get('message') or '')[:160])")
    if [ -n "${3:-}" ]; then
      (cd "$H" && rm -rf snaps && timeout 900 hyperframes snapshot --at "$3" --no-end --describe false -o snaps >/dev/null 2>&1 || true)
      echo "snapshots: $H/snaps/contact-sheet.jpg"
    fi
    ;;
  render)
    NOME="$3"; OUT="$VS/saida/$NOME.mp4"; mkdir -p "$VS/saida"
    (cd "$H" && hyperframes render -o renders/final.mp4 -f 30 -q looks --workers 3 --quiet > render.log 2>&1)
    ffmpeg-normalize "$H/renders/final.mp4" -t -14 -tp -1.0 -c:a aac -b:a 192k \
      -e="-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart" -o "$OUT" -f -q
    ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
    ffmpeg -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2
    P="$VS/projetos/$NOME"; mkdir -p "$P"
    (cd "$H" && tar cf - --exclude=assets/base.mp4 --exclude=assets/voz.wav --exclude=renders --exclude='snaps*' \
      --exclude=.hyperframes --exclude=render.log . | tar xf - -C "$P")
    for f in tomadas.json keep.json palavras.json edicao.json mapa.txt; do [ -f "$D/$f" ] && cp "$D/$f" "$P/"; done
    echo "vídeo: $OUT"; echo "projeto: $P"
    ;;
  *) echo "uso: projeto.sh gerar DIR [tempos] | projeto.sh render DIR NOME"; exit 1 ;;
esac
