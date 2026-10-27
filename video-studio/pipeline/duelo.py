#!/usr/bin/env python3
"""Tela dividida para vídeo "duelo" (um personagem de cada lado, como o viral dos fones).

Rode depois do montar.py (usa DIR/in.mp4, tomadas.json, keep.json; a voz e palavras.json ficam como estão).
Lê DIR/duelo.json:
  {
    "falante": ["G", "G", "K", ..., "K!"],   # um por tomada de tomadas.json; "!" = tela cheia (CTA para a câmera)
    "lado": {"K": "esq", "G": "dir"},        # metade da tela de cada personagem
    "reacao": {"G": [[a, b], ...], "K": [...]},  # trechos de in.mp4 com o personagem calado, olhando para o outro
    "mescla": true                            # opcional: os dois no mesmo quadro, sem linha (celular parado nas gravações)
  }
Quem escuta toca o trecho de reação vai-e-volta (2x) antes de passar ao próximo, para não parecer congelado.
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
    mescla = cfg.get("mescla", False)
    if mescla:
        # alinhamento: desloca cada trecho para o fundo bater com o 1º trecho de reação do personagem da direita
        def cinza(t):
            cap_r.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            return cv2.cvtColor(cap_r.read()[1], cv2.COLOR_BGR2GRAY).astype(np.float32)
        ref = cinza(cfg["reacao"][[p for p, l in cfg["lado"].items() if l == "dir"][0]][0][0])
        def desloc(t):
            (dx, dy), _ = cv2.phaseCorrelate(ref[:500], cinza(t)[:500])
            return -dx, -dy
        tom_d = [desloc((t[0] + t[1]) / 2) for t in tomadas]
        fal = [(q, c, tom_d[next(i for i, t in enumerate(tomadas) if t[0] - 0.01 <= x and y <= t[1] + 0.01)])
               for (q, c), (x, y) in zip(fal, keep)]
        reac = {p: [(r0, r1, desloc((r0 + r1) / 2)) for r0, r1, _ in rs] for p, rs in reac.items()}
        xc = {p: np.median([c for q, c, _ in fal if q == p] or [360]) for p in cfg["lado"]}
        esq, dir_ = [p for p, l in cfg["lado"].items() if l == "esq"][0], [p for p, l in cfg["lado"].items() if l == "dir"][0]
        costura = (xc[esq] + xc[dir_]) / 2
        xs = np.arange(720, dtype=np.float32)
        a_esq = np.clip((costura + 40 - xs) / 80, 0, 1)[None, :, None]  # 1 à esquerda da costura, rampa de 80 px

    def alinhar(fr, d):
        return cv2.warpAffine(fr, np.float32([[1, 0, d[0]], [0, 1, d[1]]]), (fr.shape[1], fr.shape[0]), borderMode=cv2.BORDER_REPLICATE)

    def pessoa(fr, lado):
        x = cv2.resize(fr, (320, 320))[:, :, ::-1].astype(np.float32) / 255
        x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        m = _seg.run(None, {_seg.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
        m = cv2.resize((m - m.min()) / (m.max() - m.min() + 1e-6), (fr.shape[1], fr.shape[0]))
        m = cv2.GaussianBlur(np.clip((m - 0.3) / 0.4, 0, 1), (0, 0), 3)
        lim = costura + 140 if lado == "esq" else costura - 140  # cada um só invade um pouco o lado do outro
        m[:, int(lim):] = 0 if lado == "esq" else m[:, int(lim):]
        if lado == "dir":
            m[:, :max(int(lim), 0)] = 0
        return m[..., None]

    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                            "-g", "30", "-pix_fmt", "yuv420p", os.path.join(D, "base.mp4")], stdin=subprocess.PIPE)
    pos = {p: [0, 0] for p in reac}  # trecho de reação atual e quadro dentro dele (vai e volta)
    ultimo = {}
    seg_ant = -1
    for f in range(int(total * FPS)):
        t = f / FPS
        i = min(int(np.searchsorted(starts, t, side="right") - 1), len(keep) - 1)
        quem, cx = fal[i][0], fal[i][1]
        t_src = keep[i][0] + (t - starts[i]) * VEL
        if i != seg_ant:
            cap.set(cv2.CAP_PROP_POS_MSEC, t_src * 1000)
            seg_ant = i
        ok, fr = cap.read()
        if ok:
            ultimo["f"] = fr
        fr = ultimo["f"]
        if quem.endswith("!"):  # tela cheia (ex.: CTA sozinho para a câmera)
            enc.stdin.write(cv2.resize(fr, (W, H), interpolation=cv2.INTER_LANCZOS4).tobytes())
            continue
        quadros = {quem: (fr, cx, fal[i][2] if mescla else None)}
        for p in cfg["lado"]:
            if p == quem:
                continue
            k, n = pos[p]
            r0, r1, rd = reac[p][k]
            L = max(int((r1 - r0) * FPS), 2)
            if n >= 2 * (L - 1) * 2:  # dois vai-e-volta e passa para o próximo trecho
                k, n = (k + 1) % len(reac[p]), 0
                r0, r1, rd = reac[p][k]
                L = max(int((r1 - r0) * FPS), 2)
            j = n % (2 * (L - 1))
            j = j if j < L else 2 * (L - 1) - j
            cap_r.set(cv2.CAP_PROP_POS_MSEC, (r0 + j / FPS) * 1000)
            ok, fr2 = cap_r.read()
            if ok:
                ultimo["r" + p] = fr2
            quadros[p] = (ultimo["r" + p], rd, rd)
            pos[p] = [k, n + 1]
        if mescla:
            A = alinhar(quadros[esq][0], quadros[esq][2]).astype(np.float32)
            B = alinhar(quadros[dir_][0], quadros[dir_][2]).astype(np.float32)
            C = A * a_esq + B * (1 - a_esq)
            mA, mB = pessoa(A.astype(np.uint8), "esq"), pessoa(B.astype(np.uint8), "dir")
            camadas = [(A, mA), (B, mB)] if quem == dir_ else [(B, mB), (A, mA)]  # quem fala fica por cima
            for img, m in camadas:
                C = C * (1 - m) + img * m
            enc.stdin.write(cv2.resize(C.astype(np.uint8), (W, H), interpolation=cv2.INTER_LANCZOS4).tobytes())
            continue
        frame = np.zeros((H, W, 3), np.uint8)
        for p, lado in cfg["lado"].items():
            x0 = 0 if lado == "esq" else 540
            img, c = quadros[p][0], quadros[p][1]
            frame[:, x0:x0 + 540] = metade(img, c)
        frame[:, 538:542] = 0  # linha fina entre as metades
        enc.stdin.write(frame.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"base.mp4 ({'mesclado' if cfg.get('mescla') else 'tela dividida'}): {total:.1f}s")


if __name__ == "__main__":
    main()
