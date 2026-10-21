#!/usr/bin/env python3
"""Render TikTok: cortes + troca de fundo (MediaPipe + plaquinha por cor) + zooms dinâmicos."""
import json, subprocess, sys
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

D = "/tmp/claude-0/-home-user-claude/055c61e1-07f8-51c4-be32-d290dafc9e81/scratchpad/tt"
SRC = f"{D}/in.mp4"
W, H, FPS = 1080, 1920, 30
TOP = 150  # deslocamento do crop vertical (fonte 1080x2400 -> 1920)

FORCE_CUT = [(0, 0.94), (5.51, 12.72), (34.55, 36.95), (63.9, 66.25), (92.54, 999)]
PAD = 0.07


def intervals():
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", SRC, "-af", "silencedetect=noise=-32dB:d=0.3",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    import re
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    cuts = [(a + PAD, b - PAD) for a, b in zip(st, en) if b - a > 0.3] + FORCE_CUT
    cuts.sort()
    keep, t = [], 0.0
    for a, b in cuts:
        if a > t + 0.15:
            keep.append((round(t, 3), round(a, 3)))
        t = max(t, b)
    return keep


def bg_image():
    im = cv2.imread(f"{D}/bg/jitsi2.jpg")  # 2880x1620
    h = im.shape[0]
    w = int(h * W / H)
    x0 = int(im.shape[1] * 0.66 - w / 2)  # centraliza na prateleira com planta
    crop = im[:, x0:x0 + w]
    crop = cv2.resize(crop, (int(W * 1.08), int(H * 1.08)), interpolation=cv2.INTER_CUBIC)
    crop = cv2.GaussianBlur(crop, (0, 0), 5)  # profundidade de campo
    # aproxima a luz da cena gravada: um pouco mais escuro e quente
    crop = np.clip(crop.astype(np.float32) * [0.86, 0.9, 0.95] + [0, 4, 10], 0, 255).astype(np.uint8)
    return crop


def card_mask(frame):
    """Plaquinha: único objeto saturado (azul/arco-íris) da cena -> casco convexo."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    hh, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    sat = (s > 95) & (v > 70) & ~((hh < 22) | (hh > 165))  # exclui tons de pele
    m = cv2.morphologyEx(sat.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    pts = [np.argwhere(lab == i)[:, ::-1] for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 600]
    out = np.zeros(frame.shape[:2], np.float32)
    if pts:
        hull = cv2.convexHull(np.vstack(pts).astype(np.int32))
        cv2.fillConvexPoly(out, hull, 1.0)
        out = cv2.dilate(out, np.ones((7, 7), np.uint8))
    return out


class Matter:
    def __init__(self):
        self.seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
            base_options=BaseOptions(model_asset_path="/opt/models/selfie_segmenter.tflite"),
            output_confidence_masks=True))
        self.prev = None

    def reset(self):
        self.prev = None

    def __call__(self, frame):
        h, w = frame.shape[:2]
        r = self.seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB,
                                      data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
        m = r.confidence_masks[0].numpy_view().reshape(h, w).astype(np.float32)
        m = np.clip((m - 0.25) / 0.3, 0, 1)  # endurece a borda
        m = np.maximum(m, card_mask(frame))
        if self.prev is not None:
            m = 0.65 * m + 0.35 * self.prev  # suaviza tremulação entre frames
        self.prev = m
        return cv2.GaussianBlur(m, (0, 0), 1.5)


def zoom(img, z, cx=0.5, cy=0.4):
    if abs(z - 1) < 1e-3:
        return img
    h, w = img.shape[:2]
    cw, ch = w / z, h / z
    x0 = min(max(cx * w - cw / 2, 0), w - cw)
    y0 = min(max(cy * h - ch / 2, 0), h - ch)
    M = np.float32([[z, 0, -x0 * z], [0, z, -y0 * z]])
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR)


def ease(x):
    x = min(max(x, 0), 1)
    return 1 - (1 - x) ** 3


def zoom_for(i, t_in, dur, t_out):
    """Zoom por trecho: alterna 1.0/1.14 a cada corte; trechos longos ganham push-in lento."""
    if i == 0:  # gancho: entra 'punched' e abre
        return 1.18 - 0.18 * ease(t_in / 0.5)
    base = 1.0 if i % 2 == 0 else 1.14
    if dur > 3:
        base += 0.05 * (t_in / dur)
    return base


def compose(frame, mask, bg, t_out, total):
    big = cv2.resize(frame, (W, int(frame.shape[0] * W / frame.shape[1])), interpolation=cv2.INTER_CUBIC)
    mk = cv2.resize(mask, (big.shape[1], big.shape[0]), interpolation=cv2.INTER_LINEAR)
    big, mk = big[TOP:TOP + H], mk[TOP:TOP + H, :, None]
    # fundo com Ken Burns lento (vida sem distrair)
    k = t_out / max(total, 1)
    bh, bw = bg.shape[:2]
    ox, oy = int((bw - W) * (0.2 + 0.6 * k)), int((bh - H) * 0.5)
    b = bg[oy:oy + H, ox:ox + W]
    return (big * mk + b * (1 - mk)).astype(np.uint8)


def main(preview_times=None):
    keep = intervals()
    total = sum(b - a for a, b in keep)
    json.dump(keep, open(f"{D}/keep.json", "w"))
    print(f"{len(keep)} trechos, {total:.1f}s de {keep[-1][1]:.1f}s", file=sys.stderr)
    bg = bg_image()
    matter = Matter()

    # tabela tempo de saída -> (trecho, tempo na fonte)
    starts = np.cumsum([0] + [b - a for a, b in keep])
    n_out = int(total * FPS)
    want = []
    for f in range(n_out):
        t = f / FPS
        i = min(int(np.searchsorted(starts, t, side="right") - 1), len(keep) - 1)
        want.append((f, i, t - starts[i], keep[i][0] + (t - starts[i])))
    if preview_times:
        want = [w for w in want if any(abs(w[0] / FPS - p) < 0.5 / FPS for p in preview_times)]

    cap = cv2.VideoCapture(SRC)
    ok, cur = cap.read()
    cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
    nxt, nxt_t = None, None
    enc = None
    if not preview_times:
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
                                "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
                                "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", f"{D}/video.mp4"],
                               stdin=subprocess.PIPE)
    last_i = -1
    for f, i, t_in, t_src in want:
        # avança decodificação até o frame mais recente com pts <= t_src
        while True:
            if nxt is None:
                ok2, nxt = cap.read()
                nxt_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000 if ok2 else 1e9
                if not ok2:
                    nxt = None
                    break
            if nxt_t <= t_src + 1e-3:
                cur, cur_t, nxt = nxt, nxt_t, None
            else:
                break
        if i != last_i:
            matter.reset()
            last_i = i
        mask = matter(cur)
        out = compose(cur, mask, bg, f / FPS, total)
        out = zoom(out, zoom_for(i, t_in, keep[i][1] - keep[i][0], f / FPS))
        if enc:
            enc.stdin.write(out.tobytes())
            if f % 150 == 0:
                print(f"{f}/{n_out}", file=sys.stderr)
        else:
            cv2.imwrite(f"{D}/prev_{f / FPS:05.1f}.jpg", out)
    if enc:
        enc.stdin.close()
        enc.wait()


if __name__ == "__main__":
    main([float(x) for x in sys.argv[1:]] or None)
