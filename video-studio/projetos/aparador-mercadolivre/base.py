#!/usr/bin/env python3
"""Barbeador: escolhe tomadas, remove pausas, gera base.mp4 (1080x1920, zooms) + voz.wav + words.json."""
import json, re, subprocess, sys
import cv2
import numpy as np

D = "/tmp/claude-0/-home-user-claude/055c61e1-07f8-51c4-be32-d290dafc9e81/scratchpad/v4"
SRC = "/tmp/claude-0/-home-user-claude/055c61e1-07f8-51c4-be32-d290dafc9e81/scratchpad/v4/in.mp4"
W, H, FPS = 1080, 1920, 30
PAD = 0.07
VEL = 1.15  # aceleração da fala (mantém o tom)

# Tomadas escolhidas (tempo da fonte), na ordem de montagem
TOMADAS = [
    (0.00, 12.95),    # nariz, corpo, verdadeiro negócio + achei no Mercado Livre
    (15.76, 24.15),   # tem me ajudado muito... vale muito a pena
    (35.56, 44.75),   # lâmina de cerâmica, resistente à água... (a tomada "selana" fica de fora)
    (64.03, 71.55),   # acompanha três cabeças + pente de três níveis
    (81.22, 93.30),   # Mercado Livre, frete grátis, link na tela
]


def silencios():
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", SRC, "-af", "silencedetect=noise=-33dB:d=0.3",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return [(a + PAD, b - PAD) for a, b in zip(st, en) if b - a > 0.3]


def trechos():
    sil = silencios()
    out = []
    for a, b in TOMADAS:
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
    M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR)


def main():
    keep = trechos()
    json.dump(keep, open(f"{D}/keep.json", "w"))
    total = sum(b - a for a, b in keep) / VEL
    print(f"{len(keep)} trechos, {total:.1f}s (fonte 136.3s)", file=sys.stderr)


    # áudio
    parts = [f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={b - a - 0.015:.3f}:d=0.015[a{i}]"
             for i, (a, b) in enumerate(keep)]
    fc = ";".join(parts) + ";" + "".join(f"[a{i}]" for i in range(len(keep))) + \
        f"concat=n={len(keep)}:v=0:a=1,atempo={VEL},highpass=f=80,afftdn=nf=-28,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2[out]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-filter_complex", fc, "-map", "[out]",
                    "-ar", "48000", "-ac", "1", f"{D}/voz_raw.wav"], check=True)
    subprocess.run(["ffmpeg-normalize", f"{D}/voz_raw.wav", "-t", "-14", "-tp", "-1.0", "-ar", "48000",
                    "-o", f"{D}/voz.wav", "-f", "-q"], check=True)

    # vídeo: tabela saída -> fonte; zoom alterna a cada corte, push-in lento nos trechos longos
    starts = np.cumsum([0] + [(b - a) / VEL for a, b in keep])
    n_out = int(total * FPS)
    cap = cv2.VideoCapture(SRC)
    frames_t, cur, nxt = None, None, None
    ok, cur = cap.read()
    cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                            "-g", "30", "-pix_fmt", "yuv420p", f"{D}/base.mp4"], stdin=subprocess.PIPE)
    # trechos fora de ordem exigem reabrir/buscar: usa seek quando o alvo está atrás
    for f in range(n_out):
        t = f / FPS
        i = min(int(np.searchsorted(starts, t, side="right") - 1), len(keep) - 1)
        t_in = t - starts[i]
        t_src = keep[i][0] + t_in * VEL
        if t_src + 1e-3 < cur_t or t_src - cur_t > 2.0:
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
        big = cv2.resize(cur, (W, H), interpolation=cv2.INTER_LANCZOS4)
        dur = (keep[i][1] - keep[i][0]) / VEL
        if i == 0:
            z = 1.16 - 0.16 * (1 - (1 - min(t_in / 0.5, 1)) ** 3)
        else:
            z = (1.0 if i % 2 == 0 else 1.12) + (0.04 * t_in / dur if dur > 3 else 0)
        enc.stdin.write(zoom(big, z).tobytes())
        if f % 300 == 0:
            print(f"{f}/{n_out}", file=sys.stderr)
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    main()
