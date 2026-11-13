#!/usr/bin/env bash
# Copies the panel from the website (frontend/public) into the extension and makes the zip.
set -euo pipefail
cd "$(dirname "$0")"
cp ../frontend/public/sinais.html ../frontend/public/sinais.js .
rm -f sinal-honesto-extensao.zip
zip -q -r sinal-honesto-extensao.zip manifest.json background.js content.js sinais.html sinais.js icons
echo "ok: $(pwd)/sinal-honesto-extensao.zip"
