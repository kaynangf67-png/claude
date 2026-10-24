#!/usr/bin/env python3
"""Passo 2: monta o vídeo-base a partir das tomadas escolhidas.

Lê DIR/in.mp4 e DIR/tomadas.json ([[início, fim, "comentário"], ...] em segundos da fonte, na
ordem de montagem; um 4º campo true mantém a tomada inteira, sem cortar pausas — use quando
uma palavra falada baixo some, ex. "antes que acabe a sua"). Remove pausas > 0,3 s dentro de cada tomada, acelera a fala (tom mantido),
alterna zoom a cada corte e grava:
  DIR/base.mp4  1080x1920, 30 fps, sem áudio (keyframe a cada 1 s, exigido pelo HyperFrames)
  DIR/voz.wav   voz tratada, -14 LUFS
  DIR/keep.json trechos mantidos (fonte)
  DIR/palavras.json palavras no tempo do vídeo final (re-transcritas do áudio cortado)
e imprime a fala final por trecho: CONFIRA que nenhuma palavra sumiu antes de seguir.

Uso: montar.py DIR [--vel 1.15]
"""
import argparse, json, os, re, subprocess, sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palavras import transcrever, texto  # noqa: E402

W, H, FPS = 1080, 1920, 30
PAD = 0.07      # folga deixada em cada borda de pausa cortada
PAUSA = 0.3     # NÃO baixe para 0,2: come palavras faladas baixo ("por", "corta", "antes")


def silencios(src):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", f"silencedetect=noise=-33dB:d={PAUSA}",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return [(a + PAD, b - PAD) for a, b in zip(st, en) if b - a > PAUSA]


def trechos(src, tomadas):
    sil = silencios(src)
    out = []
    for a, b, inteira in tomadas:
        if inteira:
            out.append((round(a, 3), round(b, 3)))
            continue
        t = a
        for s, e in sil:
            if e <= a or s >= b:
                continue
            if s > t + 0.12:
                out.append((round(t, 3), round(min(s, b), 3)))
            t = max(t, e)
        if b > t + 0.12:
            out.append((round(t, 3), round(b, 3)))
    return out


def zoom(img, z, cx=0.5, cy=0.38):
    if abs(z - 1) < 1e-3:
        return img
    h, w = img.shape[:2]
    cw, ch = w / z, h / z
    x0 = min(max(cx * w - cw / 2, 0), w - cw)
    y0 = min(max(cy * h - ch / 2, 0), h - ch)
    return cv2.warpAffine(img, np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]]), (w, h), flags=cv2.INTER_LINEAR)


def encaixar(frame):
    """Preenche 1080x1920: escala pela largura e corta o excesso vertical (ou pela altura, se mais largo)."""
    h, w = frame.shape[:2]
    s = max(W / w, H / h)
    big = cv2.resize(frame, (round(w * s), round(h * s)), interpolation=cv2.INTER_LANCZOS4)
    y0 = int((big.shape[0] - H) * 0.35)
    x0 = (big.shape[1] - W) // 2
    return big[y0:y0 + H, x0:x0 + W]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--vel", type=float, default=1.15)
    a = ap.parse_args()
    D, VEL = a.dir, a.vel
    src = os.path.join(D, "in.mp4")
    tomadas = [(t[0], t[1], len(t) > 3 and t[3] is True) for t in json.load(open(os.path.join(D, "tomadas.json")))]
    keep = trechos(src, tomadas)
    json.dump(keep, open(os.path.join(D, "keep.json"), "w"))
    total = sum(b - a for a, b in keep) / VEL
    print(f"{len(keep)} trechos -> {total:.1f}s", file=sys.stderr)

    # áudio
    parts = [f"[0:a]atrim={x}:{y},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={y - x - 0.015:.3f}:d=0.015[a{i}]"
             for i, (x, y) in enumerate(keep)]
    fc = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(keep))) + \
        f"concat=n={len(keep)}:v=0:a=1,atempo={VEL},highpass=f=80,afftdn=nf=-28," \
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2[out]"
    raw = os.path.join(D, "voz_raw.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[out]",
                    "-ar", "48000", "-ac", "1", raw], check=True)
    subprocess.run(["ffmpeg-normalize", raw, "-t", "-14", "-tp", "-1.0", "-ar", "48000",
                    "-o", os.path.join(D, "voz.wav"), "-f", "-q"], check=True)

    # vídeo
    starts = np.cumsum([0] + [(y - x) / VEL for x, y in keep])
    n_out = int(total * FPS)
    cap = cv2.VideoCapture(src)
    ok, cur = cap.read()
    cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
    nxt, nxt_t = None, None
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                            "-g", "30", "-pix_fmt", "yuv420p", os.path.join(D, "base.mp4")], stdin=subprocess.PIPE)
    for f in range(n_out):
        t = f / FPS
        i = min(int(np.searchsorted(starts, t, side="right") - 1), len(keep) - 1)
        t_in = t - starts[i]
        t_src = keep[i][0] + t_in * VEL
        if t_src + 1e-3 < cur_t or t_src - cur_t > 2.0:  # tomada fora de ordem: busca
            cap.set(cv2.CAP_PROP_POS_MSEC, max(0, (t_src - 0.5) * 1000))
            ok, cur = cap.read()
            cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
            nxt = None
        while True:
            if nxt is None:
                ok2, nxt = cap.read()
                if not ok2:
                    nxt = None
                    break
                nxt_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
            if nxt_t <= t_src + 1e-3:
                cur, cur_t, nxt = nxt, nxt_t, None
            else:
                break
        dur = (keep[i][1] - keep[i][0]) / VEL
        if i == 0:
            z = 1.16 - 0.16 * (1 - (1 - min(t_in / 0.5, 1)) ** 3)  # gancho: entra fechado e abre
        else:
            z = (1.0 if i % 2 == 0 else 1.12) + (0.04 * t_in / dur if dur > 3 else 0)
        enc.stdin.write(zoom(encaixar(cur), z).tobytes())
    enc.stdin.close()
    enc.wait()

    # palavras no tempo final + conferência
    bounds, t = [0.0], 0.0
    for x, y in keep:
        t += (y - x) / VEL
        if t - bounds[-1] >= 6:
            bounds.append(t)
    if bounds[-1] < t:
        bounds.append(t)
    words = transcrever(os.path.join(D, "voz.wav"), list(zip(bounds, bounds[1:])))
    json.dump(words, open(os.path.join(D, "palavras.json"), "w"), ensure_ascii=False, indent=0)
    print(f"\nDURAÇÃO FINAL {total:.1f}s, {len(words)} palavras. FALA FINAL (confira se nada sumiu):\n{texto(words)}")


if __name__ == "__main__":
    main()
