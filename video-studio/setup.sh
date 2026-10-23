#!/usr/bin/env bash
# Instala o kit de edição de vídeo no ambiente do Claude Code (Ubuntu). Idempotente:
# o que já estiver instalado é pulado. Rode no começo de cada sessão nova (o ambiente é apagado).
set -uo pipefail
MODELS="${VIDEO_STUDIO_MODELS:-/opt/models}"
SHERPA_REL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"
HF_VER="0.8.185"
log() { echo "[video-studio] $*"; }

if ! command -v melt >/dev/null || ! command -v mediainfo >/dev/null || ! fc-list | grep -qi montserrat; then
  log "apt: ffmpeg, sox, mediainfo, mkvtoolnix, imagemagick, fontes"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg sox libsox-fmt-all mediainfo mkvtoolnix \
    melt frei0r-plugins imagemagick libgles2 libegl1 fonts-noto-core fonts-liberation fonts-dejavu \
    fonts-roboto fonts-open-sans fonts-montserrat >/dev/null
fi

if ! python3 -c "import moviepy, sherpa_onnx, auto_editor, scenedetect, cv2" 2>/dev/null; then
  log "pip: sherpa-onnx, opencv, moviepy, auto-editor, scenedetect, ffmpeg-normalize..."
  pip install -q --break-system-packages sherpa-onnx soundfile opencv-python-headless numpy moviepy \
    auto-editor scenedetect pydub ffmpeg-normalize pillow librosa noisereduce pysubs2
fi

# Modelos via GitHub (o Hugging Face é bloqueado neste ambiente)
mkdir -p "$MODELS"
if [ ! -f "$MODELS/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/encoder.int8.onnx" ]; then
  log "baixando Parakeet v3 (tempo por palavra, ~640 MB)"
  curl -sSL "$SHERPA_REL/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2" | tar xj -C "$MODELS"
fi
if [ ! -f "$MODELS/sherpa-onnx-whisper-turbo/turbo-encoder.int8.onnx" ]; then
  log "baixando Whisper turbo (2ª opinião em palavras duvidosas, ~560 MB)"
  curl -sSL "$SHERPA_REL/sherpa-onnx-whisper-turbo.tar.bz2" | tar xj -C "$MODELS"
fi
[ -f "$MODELS/silero_vad.onnx" ] || curl -sSL -o "$MODELS/silero_vad.onnx" "$SHERPA_REL/silero_vad.onnx"

# HyperFrames (render HTML -> vídeo) usando o Chromium headless já instalado
if [ ! -x /opt/hf-cli/node_modules/.bin/hyperframes ]; then
  log "npm: hyperframes@$HF_VER"
  mkdir -p /opt/hf-cli && (cd /opt/hf-cli && npm init -y >/dev/null && npm install -s --no-audit --no-fund "hyperframes@$HF_VER")
fi
SHELL_BIN="$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)"
cat > /opt/hf-cli/env.sh <<EOF
export PATH=/opt/hf-cli/node_modules/.bin:\$PATH
export PRODUCER_HEADLESS_SHELL_PATH=$SHELL_BIN
export HYPERFRAMES_BROWSER_PATH=$SHELL_BIN
EOF
. /opt/hf-cli/env.sh && hyperframes telemetry disable >/dev/null 2>&1 || true

log "pronto"
