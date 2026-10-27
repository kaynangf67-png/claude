#!/usr/bin/env python3
"""Tela dividida para vídeo "duelo" (um personagem de cada lado, como o viral dos fones).

Rode depois do montar.py (usa DIR/in.mp4, tomadas.json, keep.json; a voz e palavras.json ficam como estão).
Lê DIR/duelo.json:
  {
    "falante": ["G", "G", "K", ..., "K!"],   # um por tomada de tomadas.json; "!" = tela cheia (CTA para a câmera)
    "lado": {"K": "esq", "G": "dir"},        # metade da tela de cada personagem
    "reacao": {"G": [[a, b], ...], "K": [...]}   # trechos de in.mp4 com o personagem calado (sem pegar o celular)
  }
Quem fala aparece na sua metade com o trecho da fala; o outro fica na metade dele com os trechos de reação
em sequência. Cada metade é um recorte 360x1280 centrado na pessoa (segmentação u2net). Regrava DIR/base.mp4.
Para os nomes no topo, ponha "rotulos": {"esq": "...", "dir": "..."} no edicao.json.

Uso: duelo.py DIR [--vel 1.15]
"""
import argparse, json, os, subprocess

import cv2
import numpy as np
import onnxruntime as ort

W, H, FPS = 1080, 1920, 30
_seg = ort.InferenceSession("/opt/models/u2net_human_seg.onnx")


def centro_x(cap, a, b):
    """Posição horizontal (px da fonte) da pessoa entre a e b s: média da máscara na parte de cima do quadro."""
    xs = []
    for t in np.linspace(a, b, 4):
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        if not ok:
            continue
        x = cv2.resize(fr, (320, 320))[:, :, ::-1].astype(np.float32) / 255
        x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        m = _seg.run(None, {_seg.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0][:110]
        col = m.sum(0)
        if col.sum() > 5:
            xs.append(float((col * np.arange(320)).sum() / col.sum() * fr.shape[1] / 320))
    return float(np.median(xs)) if xs else None


def metade(fr, cx):
    h, w = fr.shape[:2]
    cw = h * 540 / H  # largura do recorte na fonte para encher 540x1920
    x0 = int(min(max(cx - cw / 2, 0), w - cw))
    return cv2.resize(fr[:, x0:x0 + int(cw)], (540, H), interpolation=cv2.INTER_LANCZOS4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--vel", type=float, default=1.15)
    a = ap.parse_args()
    D, VEL = a.dir, a.vel
    cfg = json.load(open(os.path.join(D, "duelo.json")))
    tomadas = json.load(open(os.path.join(D, "tomadas.json")))
    keep = json.load(open(os.path.join(D, "keep.json")))
    src = os.path.join(D, "in.mp4")
    cap, cap_r = cv2.VideoCapture(src), cv2.VideoCapture(src)

    # falante e centro de cada trecho mantido
    tom_c = [centro_x(cap, t[0], t[1]) for t in tomadas]
    fal = []
    for x, y in keep:
        i = next(i for i, t in enumerate(tomadas) if t[0] - 0.01 <= x and y <= t[1] + 0.01)
        fal.append((cfg["falante"][i], tom_c[i] or 360))
    reac = {p: [(r0, r1, centro_x(cap, r0, r1) or 360) for r0, r1 in rs] for p, rs in cfg["reacao"].items()}

    starts = np.cumsum([0] + [(y - x) / VEL for x, y in keep])
    total = starts[-1]
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                            "-g", "30", "-pix_fmt", "yuv420p", os.path.join(D, "base.mp4")], stdin=subprocess.PIPE)
    pos = {p: [0, rs[0][0]] for p, rs in reac.items()}  # índice do trecho de reação e tempo atual
    ultimo = {}
    seg_ant = -1
    for f in range(int(total * FPS)):
        t = f / FPS
        i = min(int(np.searchsorted(starts, t, side="right") - 1), len(keep) - 1)
        quem, cx = fal[i]
        t_src = keep[i][0] + (t - starts[i]) * VEL
        if i != seg_ant:
            cap.set(cv2.CAP_PROP_POS_MSEC, t_src * 1000)
            seg_ant = i
        ok, fr = cap.read()
        if quem.endswith("!"):  # tela cheia (ex.: CTA sozinho para a câmera)
            if ok:
                ultimo[quem] = cv2.resize(fr, (W, H), interpolation=cv2.INTER_LANCZOS4)
            enc.stdin.write(ultimo[quem].tobytes())
            continue
        if ok:
            ultimo[quem] = metade(fr, cx)
        frame = np.zeros((H, W, 3), np.uint8)
        for p, lado in cfg["lado"].items():
            x0 = 0 if lado == "esq" else 540
            if p == quem:
                frame[:, x0:x0 + 540] = ultimo[quem]
                continue
            k, tr = pos[p]
            r0, r1, rc = reac[p][k]
            if tr >= r1 or tr < r0:
                k = (k + 1) % len(reac[p]) if tr >= r1 else k
                r0, r1, rc = reac[p][k]
                tr = r0
            cap_r.set(cv2.CAP_PROP_POS_MSEC, tr * 1000)  # busca exata: poucos trechos, custo aceitável
            ok, fr2 = cap_r.read()
            if ok:
                ultimo["r" + p] = metade(fr2, rc)
            frame[:, x0:x0 + 540] = ultimo.get("r" + p, 0)
            pos[p] = [k, tr + 1 / FPS]
        frame[:, 538:542] = 0  # linha fina entre as metades
        enc.stdin.write(frame.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"base.mp4 em tela dividida: {total:.1f}s")


if __name__ == "__main__":
    main()
