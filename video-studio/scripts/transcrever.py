#!/usr/bin/env python3
"""Transcreve o áudio de um vídeo e gera legenda .srt (Whisper large-v3-turbo, offline).

Uso: transcrever.py VIDEO [--lingua pt] [--saida legenda.srt] [--max-palavras 7]
"""
import argparse
import os
import subprocess
import sys

import numpy as np
import sherpa_onnx

MODELOS = os.environ.get("VIDEO_STUDIO_MODELS", "/opt/models")
WHISPER = os.path.join(MODELOS, "sherpa-onnx-whisper-turbo")
VAD = os.path.join(MODELOS, "silero_vad.onnx")
SR = 16000


def carregar_audio(caminho):
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", caminho, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def ts(seg):
    ms = int(round(seg * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def quebrar(texto, inicio, fim, max_palavras):
    """Divide um trecho longo em blocos curtos, distribuindo o tempo pelo nº de caracteres."""
    palavras = texto.split()
    blocos = [" ".join(palavras[i:i + max_palavras]) for i in range(0, len(palavras), max_palavras)]
    total = sum(len(b) for b in blocos) or 1
    t = inicio
    for b in blocos:
        dur = (fim - inicio) * len(b) / total
        yield t, t + dur, b
        t += dur


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--lingua", default="pt")
    ap.add_argument("--saida")
    ap.add_argument("--max-palavras", type=int, default=7)
    a = ap.parse_args()
    saida = a.saida or os.path.splitext(a.video)[0] + ".srt"

    rec = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=f"{WHISPER}/turbo-encoder.int8.onnx",
        decoder=f"{WHISPER}/turbo-decoder.int8.onnx",
        tokens=f"{WHISPER}/turbo-tokens.txt",
        language=a.lingua, task="transcribe", num_threads=len(os.sched_getaffinity(0)),
    )
    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = VAD
    cfg.silero_vad.min_silence_duration = 0.4
    cfg.silero_vad.max_speech_duration = 25  # Whisper processa no máx. 30 s por vez
    cfg.sample_rate = SR
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=60)

    audio = carregar_audio(a.video)
    janela = cfg.silero_vad.window_size
    segmentos = []  # (início em s, amostras); copia antes do pop(), que libera a memória do segmento

    def drenar():
        while not vad.empty():
            segmentos.append((vad.front.start / SR, np.array(vad.front.samples, dtype=np.float32)))
            vad.pop()

    for i in range(0, len(audio), janela):
        vad.accept_waveform(audio[i:i + janela])
        drenar()
    vad.flush()
    drenar()

    n = 0
    with open(saida, "w", encoding="utf-8") as f:
        for k, (ini, amostras) in enumerate(segmentos, 1):
            s = rec.create_stream()
            s.accept_waveform(SR, amostras)
            rec.decode_stream(s)
            texto = s.result.text.strip()
            fim = ini + len(amostras) / SR
            print(f"[{k}/{len(segmentos)}] {ts(ini)} {texto}", file=sys.stderr)
            if not texto:
                continue
            for bi, bf, bt in quebrar(texto, ini, fim, a.max_palavras):
                n += 1
                f.write(f"{n}\n{ts(bi)} --> {ts(bf)}\n{bt}\n\n")
    print(saida)


if __name__ == "__main__":
    main()
