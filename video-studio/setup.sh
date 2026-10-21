#!/usr/bin/env bash
# Instala o kit de edição de vídeo no ambiente do Claude Code (Ubuntu). Idempotente:
# o que já estiver instalado é pulado. Rode no começo de cada sessão nova.
set -uo pipefail
MODELS="${VIDEO_STUDIO_MODELS:-/opt/models}"
SHERPA_REL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"
log() { echo "[video-studio] $*"; }

if ! command -v melt >/dev/null || ! command -v mediainfo >/dev/null || ! fc-list | grep -qi montserrat; then
  log "apt: ffmpeg, sox, mediainfo, mkvtoolnix, melt (MLT), imagemagick, fontes"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg sox libsox-fmt-all mediainfo mkvtoolnix \
    melt frei0r-plugins imagemagick fonts-noto-core fonts-noto-color-emoji fonts-liberation \
    fonts-dejavu fonts-roboto fonts-open-sans fonts-montserrat >/dev/null
fi

if ! python3 -c "import moviepy, sherpa_onnx, auto_editor, scenedetect" 2>/dev/null; then
  log "pip: moviepy, auto-editor, scenedetect, sherpa-onnx, ffmpeg-normalize, yt-dlp..."
  pip install -q --break-system-packages moviepy auto-editor scenedetect opencv-python-headless pydub \
    yt-dlp ffmpeg-normalize pillow numpy librosa noisereduce pysubs2 sherpa-onnx soundfile
fi

# Whisper large-v3-turbo (int8) + Silero VAD, via GitHub (o Hugging Face é bloqueado aqui)
mkdir -p "$MODELS"
if [ ! -f "$MODELS/sherpa-onnx-whisper-turbo/turbo-encoder.int8.onnx" ]; then
  log "baixando Whisper turbo (~560 MB)"
  curl -sSL "$SHERPA_REL/sherpa-onnx-whisper-turbo.tar.bz2" | tar xj -C "$MODELS"
fi
[ -f "$MODELS/silero_vad.onnx" ] || curl -sSL -o "$MODELS/silero_vad.onnx" "$SHERPA_REL/silero_vad.onnx"

log "pronto"
