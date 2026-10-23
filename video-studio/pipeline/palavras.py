"""Transcrição com tempo por palavra (Parakeet v3, offline, entende português).

Uso como módulo:  from palavras import transcrever
    words = transcrever("audio.wav", cortes=[...])  # [{"text", "start", "end"}]
"""
import os
import subprocess

import numpy as np
import sherpa_onnx

MODELOS = os.environ.get("VIDEO_STUDIO_MODELS", "/opt/models")
PARAKEET = os.path.join(MODELOS, "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8")
SR = 16000
_rec = None


def _reconhecedor():
    global _rec
    if _rec is None:
        _rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=f"{PARAKEET}/encoder.int8.onnx", decoder=f"{PARAKEET}/decoder.int8.onnx",
            joiner=f"{PARAKEET}/joiner.int8.onnx", tokens=f"{PARAKEET}/tokens.txt",
            model_type="nemo_transducer", num_threads=len(os.sched_getaffinity(0)))
    return _rec


def carregar(caminho):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", caminho, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def _fronteiras(audio, alvo=20.0):
    """Blocos de ~alvo s, cortados no ponto mais silencioso dos últimos 3 s (nunca no meio da palavra)."""
    n = len(audio) / SR
    out, t0 = [], 0.0
    while t0 < n - 0.2:
        t1 = min(n, t0 + alvo)
        if t1 < n:
            w = audio[int((t1 - 3) * SR):int(t1 * SR)]
            e = np.convolve(w ** 2, np.ones(1600) / 1600, "same")
            t1 = t1 - 3 + np.argmin(e) / SR
        out.append((t0, t1))
        t0 = t1
    return out


def transcrever(caminho, blocos=None):
    """Retorna palavras com início/fim em segundos. `blocos` = [(t0, t1), ...] opcional."""
    audio = carregar(caminho)
    rec = _reconhecedor()
    words = []
    for t0, t1 in (blocos or _fronteiras(audio)):
        seg = audio[int(t0 * SR):int(t1 * SR)]
        s = rec.create_stream()
        s.accept_waveform(SR, np.concatenate([np.zeros(1600, np.float32), seg, np.zeros(4800, np.float32)]))
        rec.decode_stream(s)
        cur, sw = None, []
        for tok, ts in zip(s.result.tokens, s.result.timestamps):
            tt = max(t0, t0 + ts - 0.1)  # 0.1 s = silêncio inserido antes do bloco
            if tok.startswith(" ") or cur is None:
                if cur:
                    sw.append(cur)
                cur = {"text": tok.strip(), "start": round(tt, 3)}
            else:
                cur["text"] += tok
        if cur:
            sw.append(cur)
        for i, w in enumerate(sw):
            nxt = sw[i + 1]["start"] if i + 1 < len(sw) else t1
            w["end"] = round(min(nxt, w["start"] + 0.7, t1), 3)
        words += [w for w in sw if w["text"]]
    return words


def texto(words):
    return " ".join(w["text"] for w in words)
