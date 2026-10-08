#!/usr/bin/env python3
"""
LUMIA — gerador da mídia demonstrativa ORIGINAL.

Tudo aqui é criado do zero, sem material de terceiros:
  * "A Ligação" — curta original (53 s) usado na demonstração principal.
  * "Manifesto LUMIA" — filme institucional curto (18 s).
  * Loop silencioso para o Hero da home.
  * Pôsteres e imagens de fundo abstratos para os títulos fictícios do catálogo.

Imagem: desenhada quadro a quadro com Pillow + NumPy.
Som: sintetizado com NumPy (chuva, passos, porta, telefone, batidas, trilha).
As "vozes" são prosódia sintetizada SEM palavras — o diálogo existe apenas
nas legendas WebVTT, que são a fonte de verdade da transcrição.

Uso:  python3 scripts/generate_media.py            (gera tudo)
      python3 scripts/generate_media.py posters    (só pôsteres)
Requer: python3, numpy, pillow, ffmpeg no PATH.
"""
from __future__ import annotations

import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
MEDIA = os.path.join(PUBLIC, "media")
POSTERS = os.path.join(PUBLIC, "posters")

W, H = 1920, 1080
FPS = 24
SR = 48000

FONT_DIR = "/usr/share/fonts/opentype/inter"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
    except OSError:
        return ImageFont.load_default()


# ----------------------------------------------------------------------------
# helpers de imagem
# ----------------------------------------------------------------------------

def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(x):
    return max(0.0, min(1.0, x))


def smooth(t):
    t = clamp01(t)
    return t * t * (3 - 2 * t)


def hexrgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def vgradient(w, h, top, bottom) -> np.ndarray:
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    return (hexrgb(top) * (1 - t) + hexrgb(bottom) * t) * np.ones((1, w, 1), np.float32)


def radial(w, h, cx, cy, r, power=2.0) -> np.ndarray:
    y, x = np.ogrid[0:h, 0:w]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    return np.clip(1 - d, 0, 1) ** power


def mask_from(draw_fn, w=W, h=H, blur=1.2) -> np.ndarray:
    m = Image.new("L", (w, h), 0)
    draw_fn(ImageDraw.Draw(m))
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m, dtype=np.float32)[:, :, None] / 255.0


def paint(frame, mask, color):
    c = hexrgb(color) if isinstance(color, str) else color
    frame *= 1 - mask
    frame += mask * c


def add_glow(frame, glow, color, strength=1.0):
    frame += glow[:, :, None] * hexrgb(color) * strength


VIGNETTE = None
GRAIN = None


def finish(frame: np.ndarray, grain=True) -> np.ndarray:
    global VIGNETTE, GRAIN
    if VIGNETTE is None:
        y, x = np.ogrid[0:H, 0:W]
        d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        VIGNETTE = (1 - 0.42 * np.clip(d - 0.35, 0, 1) ** 1.4).astype(np.float32)[:, :, None]
        rng = np.random.default_rng(7)
        GRAIN = [rng.normal(0, 3.2, (H // 2, W // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1) for _ in range(3)]
    out = frame * VIGNETTE
    if grain:
        out = out + GRAIN[int(finish.counter) % 3]
        finish.counter += 1
    return np.clip(out, 0, 255).astype(np.uint8)


finish.counter = 0


# ----------------------------------------------------------------------------
# cenário: apartamento à noite (plano geral)
# ----------------------------------------------------------------------------

WIN = (1180, 170, 1770, 700)  # janela
DOOR = (190, 330, 420, 830)   # porta
FLOOR_Y = 830


def build_room() -> dict:
    rng = np.random.default_rng(42)
    base = vgradient(W, H, "#0a101c", "#111a29")
    # chão
    floor = vgradient(W, H - FLOOR_Y, "#0c121d", "#06090f")
    base[FLOOR_Y:] = floor
    # rodapé
    base[FLOOR_Y - 6:FLOOR_Y] = hexrgb("#070b12")

    # janela: céu + cidade com bokeh
    x0, y0, x1, y1 = WIN
    ww, wh = x1 - x0, y1 - y0
    sky = vgradient(ww, wh, "#0b1630", "#2a2350")
    city = Image.new("RGB", (ww, wh), (0, 0, 0))
    d = ImageDraw.Draw(city)
    for _ in range(26):  # prédios
        bx = rng.integers(-40, ww)
        bw = rng.integers(40, 120)
        bh = rng.integers(90, 300)
        d.rectangle([bx, wh - bh, bx + bw, wh], fill=(8, 10, 22))
        for wy in range(wh - bh + 10, wh - 8, 16):
            for wx in range(bx + 6, bx + bw - 6, 14):
                if rng.random() < 0.28:
                    c = (255, 196, 120) if rng.random() < 0.7 else (170, 220, 255)
                    d.rectangle([wx, wy, wx + 5, wy + 7], fill=c)
    city = city.filter(ImageFilter.GaussianBlur(2.2))
    bok = Image.new("RGB", (ww, wh), (0, 0, 0))
    d = ImageDraw.Draw(bok)
    for _ in range(90):
        r = int(rng.integers(5, 20))
        cx = int(rng.integers(0, ww))
        cy = int(rng.integers(int(wh * 0.45), wh))
        c = [(255, 170, 90), (255, 220, 160), (120, 200, 255), (255, 90, 120)][int(rng.integers(0, 4))]
        a = rng.uniform(0.25, 0.7)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(v * a) for v in c))
    bok = bok.filter(ImageFilter.GaussianBlur(5))
    win = sky + np.asarray(city, np.float32) * 0.9 + np.asarray(bok, np.float32)
    base[y0:y1, x0:x1] = win
    # caixilhos
    fr = hexrgb("#05070b")
    base[y0 - 14:y0, x0 - 14:x1 + 14] = fr
    base[y1:y1 + 22, x0 - 20:x1 + 20] = hexrgb("#0a0e15")
    base[y0:y1, x0 - 14:x0] = fr
    base[y0:y1, x1:x1 + 14] = fr
    base[y0:y1, (x0 + x1) // 2 - 5:(x0 + x1) // 2 + 5] = fr
    base[(y0 + y1) // 2 - 4:(y0 + y1) // 2 + 4, x0:x1] = fr

    # luz da janela no chão e parede
    lightpool = mask_from(lambda dr: dr.polygon([(x0 + 40, FLOOR_Y), (x1 - 30, FLOOR_Y), (x1 - 360, H), (x0 - 520, H)], fill=255), blur=40)
    base += lightpool * hexrgb("#1c2c4a") * 0.9
    base += radial(W, H, (x0 + x1) / 2, (y0 + y1) / 2, 900, 2.2)[:, :, None] * hexrgb("#1a2440") * 0.8

    # mesa
    def table(dr):
        dr.rounded_rectangle([600, 740, 1040, 762], 6, fill=255)
        dr.rectangle([630, 760, 646, FLOOR_Y + 40], fill=255)
        dr.rectangle([994, 760, 1010, FLOOR_Y + 40], fill=255)
    paint(base, mask_from(table), "#06080d")
    # reflexo azul na borda da mesa
    base += mask_from(lambda dr: dr.line([(640, 741), (1040, 741)], fill=255, width=2), blur=1.5) * hexrgb("#3a5a8a") * 0.8

    # poltrona / estante
    def shelf(dr):
        dr.rectangle([1500, 330, 1520, 330], fill=255)
        dr.rounded_rectangle([1360, 760, 1640, 840], 26, fill=255)
        dr.rounded_rectangle([1350, 690, 1420, 840], 20, fill=255)
        dr.rounded_rectangle([1580, 690, 1650, 840], 20, fill=255)
    paint(base, mask_from(shelf, blur=2), "#05070c")

    # luminária pendente apagada
    paint(base, mask_from(lambda dr: (dr.line([(820, 0), (820, 300)], fill=255, width=3), dr.chord([770, 280, 870, 360], 180, 360, fill=255)), blur=1), "#04060a")

    # batente da porta
    dx0, dy0, dx1, dy1 = DOOR
    paint(base, mask_from(lambda dr: dr.rectangle([dx0 - 18, dy0 - 18, dx1 + 18, dy1], fill=255), blur=0.8), "#080b11")
    return {"base": base}


def door_layer(frame, open_amt: float, light=1.0):
    """open_amt 0..1. Porta abre para dentro (para a direita)."""
    dx0, dy0, dx1, dy1 = DOOR
    dw = dx1 - dx0
    if open_amt > 0.001:
        # corredor quente
        hall = vgradient(dw, dy1 - dy0, "#ffcf8a", "#c9772f") * (0.55 + 0.45 * light)
        frame[dy0:dy1, dx0:dx1] = hall
        # facho de luz no chão
        spread = open_amt
        spill = mask_from(lambda dr: dr.polygon([(dx0, dy1), (dx0 + dw * spread, dy1), (dx0 + dw * spread + 420 * spread, H), (dx0 - 60, H)], fill=255), blur=26)
        frame += spill * hexrgb("#ffb35c") * 0.55 * light * open_amt
        frame += radial(W, H, dx0 + dw / 2, dy0 + 200, 700, 2.4)[:, :, None] * hexrgb("#ff9a3c") * 0.35 * open_amt * light
    # folha da porta (projeção em perspectiva simples)
    leaf_w = dw * (1 - open_amt * 0.86)
    skew = 70 * open_amt
    xr = dx0 + leaf_w
    pts = [(dx0, dy0), (xr + skew * 0.35, dy0 - skew * 0.5), (xr + skew * 0.35, dy1 + skew * 0.5), (dx0, dy1)]
    paint(frame, mask_from(lambda dr: dr.polygon(pts, fill=255), blur=0.8), "#151b26" if open_amt < 0.05 else "#0d1119")
    if open_amt < 0.05:
        # maçaneta e frestas
        paint(frame, mask_from(lambda dr: dr.ellipse([dx1 - 34, 590, dx1 - 22, 602], fill=255), blur=0.6), "#3d4658")


def draw_person(dr: ImageDraw.ImageDraw, x: float, floor: float, h: float, phase: float, facing: int,
                walking: float, head_back: float = 0.0, flinch: float = 0.0, arm_up: float = 0.0):
    u = h / 8.0
    top = floor - h - flinch * u * 0.15
    f = facing
    sw = math.sin(phase) * walking
    # cabelo (atrás)
    hx = x + f * 0.05 * u - f * head_back * 0.25 * u
    dr.polygon([(hx - f * 0.1 * u, top + 0.05 * u), (hx - f * 0.62 * u, top + 0.5 * u), (hx - f * 0.7 * u, top + 2.0 * u),
                (hx - f * 0.1 * u, top + 2.1 * u), (hx + f * 0.35 * u, top + 0.6 * u)], fill=255)
    # cabeça
    dr.ellipse([hx - 0.42 * u, top, hx + 0.42 * u, top + 1.04 * u], fill=255)
    # nariz (indica direção do olhar)
    nose_dir = f * (1 - 2 * head_back)
    dr.polygon([(hx + nose_dir * 0.38 * u, top + 0.45 * u), (hx + nose_dir * 0.52 * u, top + 0.62 * u), (hx + nose_dir * 0.36 * u, top + 0.66 * u)], fill=255)
    # pescoço
    dr.rectangle([x - 0.16 * u, top + 0.9 * u, x + 0.16 * u, top + 1.4 * u], fill=255)
    # casaco
    sh = top + 1.35 * u + flinch * 0.12 * u
    dr.polygon([(x - 0.78 * u, sh + 0.2 * u), (x - 0.5 * u, sh), (x + 0.5 * u, sh), (x + 0.78 * u, sh + 0.2 * u),
                (x + 0.62 * u, top + 3.6 * u), (x + 0.8 * u, top + 4.8 * u), (x - 0.8 * u, top + 4.8 * u), (x - 0.62 * u, top + 3.6 * u)], fill=255)
    # pernas
    hip = top + 4.5 * u
    for side, s in ((-1, sw), (1, -sw)):
        lx = x + side * 0.22 * u
        fx = lx + s * 1.1 * u
        dr.polygon([(lx - 0.18 * u, hip), (lx + 0.18 * u, hip), (fx + 0.13 * u, floor - 0.25 * u), (fx - 0.13 * u, floor - 0.25 * u)], fill=255)
        dr.polygon([(fx - 0.13 * u, floor - 0.28 * u), (fx + 0.13 * u, floor - 0.28 * u), (fx + f * 0.42 * u, floor), (fx - 0.15 * u, floor)], fill=255)
    # braços
    for side, s in ((-1, -sw), (1, sw)):
        ax = x + side * 0.7 * u
        if side == f and arm_up > 0:
            ex = ax + f * 0.25 * u
            ey = lerp(sh + 1.6 * u, sh + 0.9 * u, arm_up)
            hx2 = lerp(ax + s * 0.6 * u, x + f * 0.35 * u, arm_up)
            hy2 = lerp(sh + 3.0 * u, top + 0.55 * u, arm_up)
            dr.line([(ax, sh + 0.2 * u), (ex, ey), (hx2, hy2)], fill=255, width=int(0.32 * u), joint="curve")
        else:
            hx2 = ax + s * 0.7 * u
            dr.line([(ax, sh + 0.2 * u), (ax + s * 0.3 * u, sh + 1.6 * u), (hx2, sh + 3.0 * u)], fill=255, width=int(0.3 * u), joint="curve")


RAIN_DROPS = np.random.default_rng(3).uniform(0, 1, (160, 3))


def rain(frame, t, amount=1.0, region=WIN):
    if amount <= 0:
        return
    x0, y0, x1, y1 = region
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    for (rx, ry, sp) in RAIN_DROPS:
        x = x0 + rx * (x1 - x0)
        y = y0 + ((ry + t * (0.9 + sp)) % 1.0) * (y1 - y0)
        d.line([(x, y), (x - 6, y + 34)], fill=int(90 + 80 * sp), width=1)
    # gotas escorrendo no vidro
    for i in range(14):
        gx = x0 + 30 + i * (x1 - x0 - 60) / 14
        gy = y0 + ((i * 0.37 + t * 0.06 * (1 + i % 3)) % 1.0) * (y1 - y0)
        d.ellipse([gx - 3, gy - 4, gx + 3, gy + 4], fill=160)
    arr = np.asarray(m.filter(ImageFilter.GaussianBlur(0.8)), np.float32)[:, :, None] / 255.0
    frame += arr * hexrgb("#9fb8e0") * 0.55 * amount


def phone_on_table(frame, t, ringing: bool, present=True):
    if not present:
        return
    jitter = (math.sin(t * 90) * 2.2) if ringing else 0
    px, py = 860 + jitter, 734
    paint(frame, mask_from(lambda dr: dr.rounded_rectangle([px - 30, py - 5, px + 30, py + 6], 4, fill=255), blur=0.6), "#0b0f16")
    if ringing:
        pulse = 0.6 + 0.4 * math.sin(t * 9)
        paint(frame, mask_from(lambda dr: dr.rounded_rectangle([px - 26, py - 4, px + 26, py + 2], 3, fill=255), blur=0.6), "#dfe9ff")
        add_glow(frame, radial(W, H, px, py - 10, 380, 2.0), "#8fb4ff", 0.9 * pulse)
        add_glow(frame, radial(W, H, px, py, 90, 1.6), "#e8f0ff", 0.8 * pulse)


# ----------------------------------------------------------------------------
# primeiro plano de perfil
# ----------------------------------------------------------------------------

PROFILE = [(0.05, 0.45), (0.02, 0.30), (0.08, 0.15), (0.20, 0.05), (0.35, 0.0), (0.50, 0.0), (0.62, 0.04), (0.70, 0.12),
           (0.74, 0.25), (0.75, 0.36), (0.77, 0.40), (0.76, 0.45), (0.86, 0.58), (0.84, 0.61), (0.78, 0.63), (0.79, 0.68),
           (0.81, 0.71), (0.78, 0.735), (0.80, 0.76), (0.77, 0.80), (0.79, 0.88), (0.74, 0.95), (0.62, 0.98), (0.58, 1.05),
           (0.56, 1.4), (0.70, 1.6), (1.25, 1.8), (1.35, 2.4), (-0.4, 2.4), (-0.25, 1.7), (0.12, 1.2), (0.10, 0.85), (0.08, 0.65)]
HAIR = [(0.40, -0.04), (0.64, 0.02), (0.72, 0.14), (0.60, 0.12), (0.40, 0.10), (0.24, 0.20), (0.18, 0.50), (0.22, 0.80),
        (0.18, 1.25), (0.05, 1.75), (-0.32, 1.75), (-0.16, 1.2), (-0.06, 0.6), (0.0, 0.25), (0.15, 0.05)]


def profile_pts(pts, ox, oy, s, facing=1, mouth=0.0, tilt=0.0):
    out = []
    piv = (0.5, 1.1)
    ca, sa = math.cos(tilt), math.sin(tilt)
    for i, (x, y) in enumerate(pts):
        if pts is PROFILE and i in (18, 19, 20, 21, 22):  # lábio inferior / queixo
            y += mouth * 0.035
        if y < 1.25:
            dx, dy = x - piv[0], y - piv[1]
            x, y = piv[0] + dx * ca - dy * sa, piv[1] + dx * sa + dy * ca
        out.append((ox + facing * (x - 0.5) * s, oy + y * s))
    return out


def draw_closeup(frame, t, facing=1, phone_at_ear=True, mouth=0.0, tilt=0.0, light="#6f9bff", phone_glow=1.0, push=0.0):
    s = 640 * (1 + push)
    ox = W * (0.46 if facing == 1 else 0.56)
    oy = 180 - push * 120
    pts = profile_pts(PROFILE, ox, oy, s, facing, mouth, tilt)
    hair = profile_pts(HAIR, ox, oy, s, facing, 0, tilt)
    rim = [(x + facing * 7, y - 2) for x, y in pts]
    paint(frame, mask_from(lambda dr: dr.polygon(rim, fill=255), blur=3), light)
    paint(frame, mask_from(lambda dr: dr.polygon(pts, fill=255), blur=1.4), "#070a10")
    paint(frame, mask_from(lambda dr: dr.polygon(hair, fill=255), blur=1.6), "#04060a")
    # olho: brilho úmido
    ex, ey = profile_pts([(0.66, 0.43)], ox, oy, s, facing, 0, tilt)[0]
    add_glow(frame, radial(W, H, ex, ey, 9, 1.0), "#cfe0ff", 0.9)
    if phone_at_ear:
        px, py = profile_pts([(0.36, 0.58)], ox, oy, s, facing, 0, tilt)[0]
        def ph(dr):
            dr.rounded_rectangle([px - 42, py - 120, px + 42, py + 110], 20, fill=255)
            # mão segurando
            dr.ellipse([px - 70, py + 20, px + 50, py + 180], fill=255)
            dr.rounded_rectangle([px - 60, py + 130, px + 40, py + 420], 40, fill=255)
        rimph = mask_from(ph, blur=4)
        paint(frame, rimph * 0.6, "#2a3f66")
        paint(frame, mask_from(ph, blur=1.5), "#06080d")
        # luz fria da tela iluminando a bochecha
        cx_, cy_ = profile_pts([(0.62, 0.62)], ox, oy, s, facing, 0, tilt)[0]
        add_glow(frame, radial(W, H, cx_, cy_, 150, 2.4), "#7d9fe0", 0.22 * phone_glow)


def build_closeup_bg(warm=False):
    bg = vgradient(W, H, "#0a1222", "#05080f")
    bg += radial(W, H, W * 0.85, H * 0.35, 1200, 1.8)[:, :, None] * hexrgb("#24406e")
    # bokeh desfocado da janela
    rng = np.random.default_rng(11)
    b = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(b)
    for _ in range(40):
        r = int(rng.integers(24, 70))
        cx, cy = int(rng.integers(int(W * 0.55), W)), int(rng.integers(0, H))
        c = [(255, 170, 90), (120, 190, 255), (255, 220, 170)][int(rng.integers(0, 3))]
        a = rng.uniform(0.08, 0.28)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(v * a) for v in c))
    bg += np.asarray(b.filter(ImageFilter.GaussianBlur(14)), np.float32)
    if warm:
        bg += radial(W, H, 0, H * 0.6, 1300, 2.0)[:, :, None] * hexrgb("#5a3418")
    return bg


# ----------------------------------------------------------------------------
# A LIGAÇÃO — roteiro de imagem
# ----------------------------------------------------------------------------

LIGACAO_DUR = 53.0
RING_TIMES = [12.5, 14.5, 16.5, 18.5, 20.5]
# falas: (início, fim, personagem) — usadas para animar a boca e as vozes
LINES = [(23.6, 24.8, "M"), (25.5, 30.4, "D"), (31.3, 33.3, "M"), (34.0, 38.0, "D"), (45.8, 48.0, "Mw")]


def ringing_at(t):
    return any(r <= t < r + 1.0 for r in RING_TIMES) and t < 22.4


def syllable_env(t, start, end, rate=5.2):
    if not (start <= t <= end):
        return 0.0
    ph = (t - start) * rate
    return max(0.0, math.sin(ph * math.pi)) ** 0.7 * smooth((t - start) / 0.1) * smooth((end - t) / 0.1)


def mouth_for(t, who):
    v = 0.0
    for s, e, w in LINES:
        if w.startswith(who):
            v = max(v, syllable_env(t, s, e))
    return v


class Ligacao:
    def __init__(self):
        self.room = build_room()["base"]
        self.close_bg = build_closeup_bg()
        self.close_bg_warm = build_closeup_bg(True)
        self.door_bg = self.build_door_bg()
        self.phone_bg = self.build_phone_bg()
        self.title_font = font("InterDisplay-Light.otf", 120)
        self.small_font = font("Inter-Medium.otf", 30)
        self.tiny_font = font("Inter-Regular.otf", 26)

    def build_door_bg(self):
        bg = vgradient(W, H, "#0b111c", "#06090f")
        def d(dr):
            dr.rectangle([700, 80, 1220, 1000], fill=255)
        paint(bg, mask_from(d, blur=0.8), "#0a0e15")
        def leaf(dr):
            dr.rectangle([730, 100, 1190, 985], fill=255)
        paint(bg, mask_from(leaf, blur=0.8), "#141a25")
        for (a, b) in ((780, 160), (780, 560)):
            paint(bg, mask_from(lambda dr: dr.rectangle([a, b, 1140, b + 340], outline=255, width=4), blur=1), "#1b2230")
        paint(bg, mask_from(lambda dr: dr.ellipse([1130, 560, 1158, 588], fill=255), blur=0.8), "#4a5568")
        bg[1000:] = hexrgb("#05070b")
        return bg

    def build_phone_bg(self):
        bg = vgradient(W, H, "#0d1420", "#070b12")
        # tampo de madeira escura com veios
        rng = np.random.default_rng(5)
        m = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(m)
        for i in range(60):
            y = int(rng.integers(0, H))
            d.line([(0, y), (W, y + int(rng.integers(-40, 40)))], fill=int(rng.integers(10, 40)), width=int(rng.integers(1, 4)))
        bg += np.asarray(m.filter(ImageFilter.GaussianBlur(2)), np.float32)[:, :, None] / 255.0 * hexrgb("#3a4a66")
        return bg

    # ---- planos -------------------------------------------------------------
    def wide(self, t):
        f = self.room.copy()
        # porta
        if t < 4.5:
            op = 0.0
        elif t < 5.6:
            op = smooth((t - 4.5) / 1.1)
        elif t < 10.0:
            op = 1.0
        elif t < 10.25:
            op = 1 - smooth((t - 10.0) / 0.25)
        else:
            op = 0.0
        door_layer(f, op)
        rain_amt = 1.0 if t < 38.6 else 0.0
        rain(f, t, rain_amt)
        ring = ringing_at(t)
        phone_on_table(f, t, ring, present=t < 22.4)
        # personagem
        floor = FLOOR_Y + 40
        if t >= 5.2:
            if t < 9.6:
                k = smooth((t - 5.2) / 4.4)
                x = lerp(300, 760, k)
                walking = 1.0 if t < 9.3 else 0.3
                facing = 1
            elif t < 14.0:
                x, walking, facing = 760, 0.0, 1
            elif t < 16.4:
                k = smooth((t - 14.0) / 2.4)
                x, walking, facing = lerp(760, 940, k), 1.0, 1
            else:
                x, walking, facing = 940, 0.0, -1
            head_back = 0.0
            flinch = 0.0
            if 10.2 <= t < 12.8:  # porta bate: ela olha para trás assustada
                head_back = smooth((t - 10.25) / 0.25) * (1 - smooth((t - 12.2) / 0.6))
                flinch = math.exp(-(t - 10.2) * 4) * 1.0
            arm_up = 0.0
            if t >= 22.4:
                arm_up = 1.0
            phase = t * 6.0
            h = 470
            m = mask_from(lambda dr: draw_person(dr, x, floor, h, phase, facing, walking, head_back, flinch, arm_up), blur=1.3)
            rimm = mask_from(lambda dr: draw_person(dr, x + 4, floor - 2, h, phase, facing, walking, head_back, flinch, arm_up), blur=2.5)
            paint(f, rimm, "#3d5f99")
            if 5.2 <= t < 10.2:
                paint(f, mask_from(lambda dr: draw_person(dr, x - 4, floor - 2, h, phase, facing, walking, head_back, flinch, arm_up), blur=2.5) * 0.7, "#a8692c")
            paint(f, m, "#05070c")
        return f

    def phone_close(self, t):
        f = self.phone_bg.copy()
        lift = smooth((t - 22.0) / 0.5)
        jitter = math.sin(t * 95) * 4 if ringing_at(t) else 0
        cx, cy = 960 + jitter + lift * 520, 560 - lift * 700
        ang = -12 + lift * 30
        ph = Image.new("RGBA", (360, 700), (0, 0, 0, 0))
        d = ImageDraw.Draw(ph)
        d.rounded_rectangle([0, 0, 359, 699], 52, fill=(10, 12, 18, 255))
        glow = 1.0 if t < 22.4 else 0.6
        d.rounded_rectangle([14, 14, 345, 685], 42, fill=(int(26 * glow), int(38 * glow), int(66 * glow), 255))
        d.text((180, 190), "Chamada recebida", font=self.tiny_font, fill=(170, 190, 230), anchor="mm")
        d.text((180, 250), "NÚMERO", font=self.small_font, fill=(240, 244, 255), anchor="mm")
        d.text((180, 292), "DESCONHECIDO", font=self.small_font, fill=(240, 244, 255), anchor="mm")
        d.ellipse([60, 560, 140, 640], fill=(220, 70, 80))
        d.ellipse([220, 560, 300, 640], fill=(60, 200, 120))
        ph = ph.rotate(ang, expand=True, resample=Image.BICUBIC)
        # anéis de vibração
        if ringing_at(t):
            r = ((t * 1.4) % 1.0)
            ring = Image.new("L", (W, H), 0)
            dr = ImageDraw.Draw(ring)
            for k in range(3):
                rr = 260 + ((r + k / 3) % 1.0) * 420
                a = int(120 * (1 - ((r + k / 3) % 1.0)))
                dr.ellipse([cx - rr, cy - rr * 0.8, cx + rr, cy + rr * 0.8], outline=a, width=3)
            f += np.asarray(ring.filter(ImageFilter.GaussianBlur(2)), np.float32)[:, :, None] / 255.0 * hexrgb("#9cc0ff")
        add_glow(f, radial(W, H, cx, cy, 700, 2.0), "#5f86d8", 0.8 * (1 - lift))
        img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8))
        img.paste(ph, (int(cx - ph.width / 2), int(cy - ph.height / 2)), ph)
        # mão entrando
        if t >= 21.4:
            k = smooth((t - 21.4) / 0.6)
            hx = lerp(W + 200, cx + 120, k) + lift * 0
            hy = lerp(H + 100, cy + 120, k)
            m = Image.new("L", (W, H), 0)
            d2 = ImageDraw.Draw(m)
            d2.rounded_rectangle([hx - 60, hy - 40, hx + 220, hy + 110], 60, fill=255)
            d2.polygon([(hx + 180, hy), (hx + 700, hy + 300), (hx + 700, hy + 600), (hx + 120, hy + 110)], fill=255)
            for i in range(4):
                d2.rounded_rectangle([hx - 150 + i * 6, hy - 40 + i * 34, hx + 20, hy - 10 + i * 34], 16, fill=255)
            m = m.filter(ImageFilter.GaussianBlur(2))
            arr = np.asarray(img, np.float32)
            mm = np.asarray(m, np.float32)[:, :, None] / 255.0
            arr = arr * (1 - mm) + mm * hexrgb("#0a0d14")
            return arr
        return np.asarray(img, np.float32)

    def door_close(self, t):
        f = self.door_bg.copy()
        # fresta iluminada sob a porta
        strip = np.zeros((H, W), np.float32)
        strip[984:996, 735:1185] = 1.0
        # sombra dos pés
        if t >= 41.3:
            k = smooth((t - 41.3) / 1.0)
            fx = lerp(620, 880, k)
            for off in (0, 140):
                x0 = int(fx + off)
                strip[984:996, max(735, x0):min(1185, x0 + 90)] = 0.08
        knock = 0.0
        for kt in (42.5, 42.78, 43.06, 43.9, 44.15):
            if kt <= t < kt + 0.12:
                knock = 1 - (t - kt) / 0.12
        add_glow(f, strip, "#ffd29a", 1.0)
        g = Image.fromarray(np.clip(strip * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))
        add_glow(f, np.asarray(g, np.float32) / 255.0, "#ff9f4a", 1.4)
        if knock > 0:
            shift = int(3 * knock)
            f = np.roll(f, shift, axis=1)
        return f

    def title(self, t, dur):
        f = np.zeros((H, W, 3), np.float32) + hexrgb("#030407")
        a = smooth(t / 1.0) * (1 - smooth((t - (dur - 0.8)) / 0.8))
        img = Image.fromarray(f.astype(np.uint8))
        d = ImageDraw.Draw(img)
        c = int(235 * a)
        d.text((W / 2, H / 2 - 120), "UM CURTA ORIGINAL LUMIA", font=self.small_font, fill=(int(150 * a), int(160 * a), int(190 * a)), anchor="mm")
        d.text((W / 2, H / 2), "A  L I G A Ç Ã O", font=self.title_font, fill=(c, c, c), anchor="mm")
        d.text((W / 2, H / 2 + 120), "Criado para demonstrar interpretação em Libras por IA", font=self.tiny_font, fill=(int(120 * a), int(130 * a), int(150 * a)), anchor="mm")
        return np.asarray(img, np.float32)

    def ending(self, t):
        f = np.zeros((H, W, 3), np.float32) + hexrgb("#030407")
        a = smooth((t - 50.0) / 1.0)
        img = Image.fromarray(f.astype(np.uint8))
        d = ImageDraw.Draw(img)
        c = int(225 * a)
        d.text((W / 2, H / 2 - 30), "C O N T I N U A …", font=font("InterDisplay-Light.otf", 72), fill=(c, c, c), anchor="mm")
        d.text((W / 2, H / 2 + 70), "Personagens e cenas fictícios, desenhados por computador. Sem atores reais.", font=self.tiny_font, fill=(int(110 * a), int(118 * a), int(140 * a)), anchor="mm")
        return np.asarray(img, np.float32)

    def frame(self, t):
        if t < 4.0:
            f = self.title(t, 4.0)
        elif t < 19.0:
            f = self.wide(t)
        elif t < 23.0:
            f = self.phone_close(t)
        elif t < 31.0:
            tilt = 0.0 if t < 26.5 else -0.05 * smooth((t - 26.5) / 2)
            f = self.close_bg.copy()
            rain(f, t, 0.5, (1100, 0, W, H))
            draw_closeup(f, t, 1, True, mouth_for(t, "M"), tilt, push=0.02 * (t - 23) / 8)
        elif t < 38.5:
            f = self.close_bg.copy()
            rain(f, t, 0.5, (1100, 0, W, H))
            tilt = -0.05 - 0.04 * smooth((t - 34) / 3)
            draw_closeup(f, t, 1, True, mouth_for(t, "M"), tilt, push=0.04 + 0.06 * smooth((t - 31) / 7))
        elif t < 41.0:
            # silêncio repentino — a chuva para; ela parada com o telefone
            f = self.wide(t)
            k = (t - 38.5) / 2.5
            img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8))
            s = 1 + 0.06 * k
            cw, ch = W / s, H / s
            img = img.crop((int(860 - cw / 2 + 120), int(560 - ch / 2), int(860 + cw / 2 + 120), int(560 + ch / 2))).resize((W, H), Image.BILINEAR)
            f = np.asarray(img, np.float32) * 0.85
        elif t < 45.0:
            f = self.door_close(t)
        elif t < 49.5:
            f = self.close_bg_warm.copy()
            turn = smooth((t - 45.0) / 0.6)
            draw_closeup(f, t, -1, False, mouth_for(t, "M") * 0.5, 0.04 * turn, light="#d9944f", push=0.08)
        else:
            f = self.ending(t)
        # cortes com mergulho rápido no preto
        for cut in (4.0, 19.0, 23.0, 31.0, 38.5, 41.0, 45.0, 49.5):
            dt = abs(t - cut)
            if dt < 0.12 and cut not in (31.0,):
                f = f * (dt / 0.12)
        return f


# ----------------------------------------------------------------------------
# MANIFESTO
# ----------------------------------------------------------------------------

def draw_logo(d: ImageDraw.ImageDraw, cx, cy, s, a, word_font):
    col = (int(244 * a), int(238 * a), int(230 * a))
    acc = (int(255 * a), int(184 * a), int(108 * a))
    r = s
    d.arc([cx - r - s * 0.34, cy - r, cx + r - s * 0.34, cy + r], 120, 240, fill=col, width=max(2, int(s * 0.12)))
    d.arc([cx - r + s * 0.34, cy - r, cx + r + s * 0.34, cy + r], -60, 60, fill=col, width=max(2, int(s * 0.12)))
    d.ellipse([cx - s * 0.2, cy - s * 0.2, cx + s * 0.2, cy + s * 0.2], fill=acc)
    if word_font:
        d.text((cx, cy + s * 2.0), "L U M I A", font=word_font, fill=col, anchor="mm")


class Manifesto:
    DUR = 18.0
    LINES = [(0.6, 2.6, "N"), (3.2, 5.0, "N"), (6.0, 7.8, "N"), (8.6, 11.8, "N"), (13.0, 16.4, "N")]

    def __init__(self):
        self.word = font("InterDisplay-Medium.otf", 64)
        y, x = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
        self.x, self.y = x, y

    def frame(self, t):
        x, y = self.x, self.y
        f = np.zeros((H // 4, W // 4, 3), np.float32)
        for i, (c, sp, amp, off) in enumerate([("#ff9e5a", 0.35, 38, 0), ("#7c6cff", 0.27, 52, 1.7), ("#47c2ff", 0.22, 30, 3.1)]):
            cy = H / 8 + amp * np.sin(x / (90 + i * 25) + t * sp * 2 + off) + 10 * np.sin(x / 31 + t * 1.3 + i)
            d = np.abs(y - cy)
            f += (np.exp(-d / (7 + 3 * math.sin(t + i)))[:, :, None]) * hexrgb(c) * 0.75
        f = np.asarray(Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6)), np.float32)
        f += radial(W, H, W / 2, H / 2, 1300, 2.0)[:, :, None] * hexrgb("#141026")
        fade = smooth(t / 1.0) * (1 - smooth((t - 17.2) / 0.8))
        logo_a = smooth((t - 12.6) / 1.2)
        f *= fade * (1 - 0.55 * logo_a)
        if logo_a > 0:
            img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8))
            draw_logo(ImageDraw.Draw(img), W / 2, H / 2 - 50, 70, logo_a * fade, self.word)
            f = np.asarray(img, np.float32)
        return f


# ----------------------------------------------------------------------------
# áudio
# ----------------------------------------------------------------------------

def fft_filter(sig, lo=None, hi=None):
    n = len(sig)
    F = np.fft.rfft(sig)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(freqs)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(freqs, 1)) ** 4)
    if hi:
        g *= 1 / (1 + (freqs / hi) ** 4)
    return np.fft.irfft(F * g, n)


def env_at(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def place(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    buf[i:i + len(sig), 0] += sig * gain * l
    buf[i:i + len(sig), 1] += sig * gain * r


def reverb(sig, decay=1.2, mix=0.25):
    rng = np.random.default_rng(1)
    n = int(SR * decay)
    ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (SR * decay / 5))
    ir = fft_filter(ir, hi=5000)
    ir /= np.abs(ir).sum() / 8
    m = len(sig) + n
    wet = np.fft.irfft(np.fft.rfft(sig, m) * np.fft.rfft(ir, m), m)[: len(sig)]
    return sig * (1 - mix) + wet * mix


VOWELS = [(800, 1200), (400, 2000), (300, 2300), (500, 900), (350, 800), (650, 1700)]


def voice(dur, f0, rate=5.2, phone=False, whisper=False, seed=0):
    """Prosódia sintetizada sem palavras (fonte-filtro). Não é fala real."""
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    pitch = f0 * (1 + 0.08 * np.sin(2 * np.pi * 0.7 * t) - 0.06 * t / dur)
    phase = np.cumsum(pitch / SR)
    src = 2 * (phase % 1.0) - 1  # dente de serra ~ pulso glotal
    if whisper:
        src = rng.normal(0, 0.6, n)
    out = np.zeros(n)
    syl = int(dur * rate) + 1
    seg = n // syl
    for k in range(syl):
        a, b = k * seg, min(n, (k + 1) * seg + seg // 3)
        f1, f2 = VOWELS[int(rng.integers(0, len(VOWELS)))]
        piece = src[a:b]
        y = fft_filter(piece, lo=f1 * 0.7, hi=f1 * 1.3) * 1.0 + fft_filter(piece, lo=f2 * 0.8, hi=f2 * 1.2) * 0.5
        w = np.sin(np.linspace(0, np.pi, b - a)) ** 1.2
        out[a:b] += y * w
    out *= 0.6 + 0.4 * np.sin(2 * np.pi * 1.1 * t + 1)
    if phone:
        out = fft_filter(out, lo=350, hi=3200)
        out = np.tanh(out * 3) / 3
    out /= np.max(np.abs(out)) + 1e-9
    fade = np.minimum(1, np.minimum(t / 0.05, (dur - t) / 0.08))
    return out * fade


def ligacao_audio():
    n = int(LIGACAO_DUR * SR)
    buf = np.zeros((n, 2))
    rng = np.random.default_rng(9)
    t = np.arange(n) / SR
    # chuva (corta em 38.6 — silêncio repentino)
    rainL = fft_filter(rng.normal(0, 1, n), lo=400, hi=7000)
    rainR = fft_filter(rng.normal(0, 1, n), lo=400, hi=7000)
    gate = np.clip((t - 4.0) / 1.5, 0, 1) * (t < 38.6)
    gate = np.convolve(gate, np.ones(200) / 200, mode="same")
    buf[:, 0] += rainL * 0.05 * gate
    buf[:, 1] += rainR * 0.05 * gate
    # drone / trilha
    drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.4 * t + 1) + 0.3 * np.sin(2 * np.pi * 110.3 * t)) * 0.06
    tension = np.clip((t - 4) / 4, 0, 1) * (1 + 1.2 * np.clip((t - 25) / 13, 0, 1)) * (t < 38.6)
    tension = np.convolve(tension, np.ones(400) / 400, mode="same")
    buf += (drone * tension)[:, None]
    # porta abrindo (rangido)
    cd = int(1.1 * SR)
    ct = np.arange(cd) / SR
    creak = np.sign(np.sin(2 * np.pi * np.cumsum(180 + 140 * ct + 30 * np.sin(ct * 40)) / SR)) * (0.5 + 0.5 * np.sin(ct * 70))
    creak = fft_filter(creak, lo=300, hi=2500) * np.sin(np.linspace(0, np.pi, cd))
    place(buf, creak, 4.5, 0.12, -0.7)
    # passos
    for k, st in enumerate(np.arange(5.5, 9.4, 0.52)):
        step = fft_filter(rng.normal(0, 1, int(0.12 * SR)), hi=900) * env_at(int(0.12 * SR), 0.003, 0.03)
        place(buf, step, st, 0.5, -0.6 + 0.12 * k)
    for st in np.arange(14.1, 16.4, 0.52):
        step = fft_filter(rng.normal(0, 1, int(0.12 * SR)), hi=900) * env_at(int(0.12 * SR), 0.003, 0.03)
        place(buf, step, st, 0.45, 0.1)
    # porta batendo (10.2)
    sl = int(1.6 * SR)
    st_ = np.arange(sl) / SR
    slam = np.sin(2 * np.pi * 52 * st_) * np.exp(-st_ * 7) * 1.2 + fft_filter(rng.normal(0, 1, sl), hi=2500) * np.exp(-st_ * 18)
    place(buf, reverb(slam, 1.4, 0.35), 10.2, 0.9, -0.7)
    # telefone: vibração + toque
    for rt in RING_TIMES:
        dur = 1.0 if rt < 20.5 else 22.4 - 20.5 - 0.6
        if dur <= 0:
            continue
        nn = int(dur * SR)
        tt = np.arange(nn) / SR
        buzz = np.sign(np.sin(2 * np.pi * 160 * tt)) * (np.sin(2 * np.pi * 9 * tt) > -0.2)
        buzz = fft_filter(buzz, hi=1200) * 0.25
        mel = np.zeros(nn)
        for j, fr in enumerate([1318.5, 987.8, 1568.0, 1318.5]):
            a = int(j * 0.22 * SR)
            if a >= nn:
                break
            m = min(nn - a, int(0.5 * SR))
            tm = np.arange(m) / SR
            mel[a:a + m] += (np.sin(2 * np.pi * fr * tm) + 0.3 * np.sin(2 * np.pi * fr * 2 * tm)) * np.exp(-tm * 7)
        place(buf, reverb(buzz + mel * 0.35, 0.8, 0.2), rt, 0.55, 0.15)
    # atender (clique)
    click = rng.normal(0, 1, 600) * np.exp(-np.arange(600) / 80)
    place(buf, click, 22.45, 0.4)
    # vozes (prosódia sem palavras)
    place(buf, voice(1.2, 215, seed=1), 23.6, 0.32, -0.05)
    place(buf, voice(4.9, 118, phone=True, seed=2), 25.5, 0.22, 0.25)
    place(buf, voice(2.0, 230, rate=5.8, seed=3), 31.3, 0.34, -0.05)
    place(buf, voice(4.0, 112, phone=True, rate=5.6, seed=4), 34.0, 0.24, 0.25)
    place(buf, voice(2.2, 200, whisper=True, rate=4.6, seed=5), 45.8, 0.16, 0.0)
    # batidas na porta
    for kt, g in ((42.5, 0.8), (42.78, 0.8), (43.06, 0.85), (43.9, 1.0), (44.15, 1.0)):
        kn = int(0.5 * SR)
        kt_ = np.arange(kn) / SR
        knock = np.sin(2 * np.pi * 95 * kt_) * np.exp(-kt_ * 22) + fft_filter(rng.normal(0, 1, kn), hi=1800) * np.exp(-kt_ * 45) * 0.6
        place(buf, reverb(knock, 0.9, 0.3), kt, g * 0.8, -0.3)
    # pulsação grave após as batidas
    for k, ht in enumerate(np.arange(44.8, 49.3, 0.9)):
        hn = int(0.4 * SR)
        ht_ = np.arange(hn) / SR
        place(buf, np.sin(2 * np.pi * 48 * ht_) * np.exp(-ht_ * 9), ht, 0.35 + 0.05 * k)
    # impacto final
    imp = int(3.2 * SR)
    it = np.arange(imp) / SR
    place(buf, reverb(np.sin(2 * np.pi * 41 * it) * np.exp(-it * 1.2) + fft_filter(rng.normal(0, 1, imp), hi=400) * np.exp(-it * 2) * 0.4, 2.0, 0.4), 49.5, 0.6)
    return buf


def manifesto_audio():
    n = int(Manifesto.DUR * SR)
    t = np.arange(n) / SR
    buf = np.zeros((n, 2))
    pad = np.zeros(n)
    for fr in (130.8, 196.0, 261.6, 329.6, 392.0):
        pad += np.sin(2 * np.pi * fr * t + np.sin(t * 0.3 + fr)) * (0.5 + 0.5 * np.sin(t * 0.21 + fr))
    pad = fft_filter(pad, hi=1800) * 0.04
    env = np.clip(t / 2, 0, 1) * np.clip((Manifesto.DUR - t) / 1.5, 0, 1)
    buf[:, 0] += pad * env
    buf[:, 1] += np.roll(pad, 900) * env
    for i, (s, e, _) in enumerate(Manifesto.LINES):
        place(buf, voice(e - s, 170, rate=4.4, seed=20 + i), s, 0.28)
    return buf


def write_wav(path, buf):
    buf = buf / (np.max(np.abs(buf)) + 1e-9) * 0.89
    data = (buf * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ----------------------------------------------------------------------------
# encode
# ----------------------------------------------------------------------------

def render(film, dur, out_dir, name, audio_buf=None, renditions=((1280, 720, 24), (640, 360, 28)), keep_frames=()):
    os.makedirs(out_dir, exist_ok=True)
    wav = os.path.join(out_dir, f".{name}.wav")
    if audio_buf is not None:
        write_wav(wav, audio_buf)
    procs = []
    for (w, h, crf) in renditions:
        out = os.path.join(out_dir, f"{name}-{h}p.mp4")
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
        if audio_buf is not None:
            cmd += ["-i", wav, "-c:a", "aac", "-b:a", "128k" if h >= 720 else "96k"]
        else:
            cmd += ["-an"]
        cmd += ["-vf", f"scale={w}:{h}:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
                "-g", "48", "-movflags", "+faststart", "-tune", "film", out]
        procs.append(subprocess.Popen(cmd, stdin=subprocess.PIPE))
    nframes = int(dur * FPS)
    stills = {}
    for i in range(nframes):
        t = i / FPS
        fr = finish(film.frame(t))
        b = fr.tobytes()
        for p in procs:
            p.stdin.write(b)
        for kt in keep_frames:
            if abs(t - kt) < 0.5 / FPS:
                stills[kt] = Image.fromarray(fr)
        if i % 96 == 0:
            print(f"  {name}: {t:5.1f}s / {dur:.0f}s", flush=True)
    for p in procs:
        p.stdin.close()
        p.wait()
    if os.path.exists(wav):
        os.remove(wav)
    return stills


def save_webp(img: Image.Image, path, size=None, q=82):
    if size:
        img = img.resize(size, Image.LANCZOS)
    img.save(path, "WEBP", quality=q, method=6)


def poster_crop(img: Image.Image, cx_frac=0.5):
    w, h = img.size
    pw = int(h * 2 / 3)
    x0 = int(min(max(0, cx_frac * w - pw / 2), w - pw))
    return img.crop((x0, 0, x0 + pw, h))


# ----------------------------------------------------------------------------
# pôsteres abstratos para títulos fictícios
# ----------------------------------------------------------------------------

POSTER_SPECS = {
    "mare-baixa": ("#0d2a3a", "#e7a46b", "sea"),
    "chuva-em-shinjuku": ("#1a0f2e", "#ff4f8b", "city"),
    "o-ultimo-farol": ("#0b1424", "#ffd27a", "beam"),
    "horizonte-de-vidro": ("#06121f", "#6fe3ff", "planet"),
    "sal-e-silencio": ("#2a1a12", "#f2d1a8", "dunes"),
    "linha-de-fuga": ("#120c0c", "#ff6a3d", "lines"),
    "a-menina-que-desenhava-sons": ("#16123a", "#ffcf5c", "waves"),
    "rua-das-maos": ("#1b1410", "#ff9f5a", "street"),
    "distrito-azul": ("#071a2e", "#4fa8ff", "city"),
    "frequencia": ("#0b0b12", "#b18cff", "rings"),
    "vale-do-vento": ("#0f1d16", "#9be38a", "mountains"),
    "maos-que-contam-historias": ("#1a1310", "#ffc38a", "hands"),
    "oceano-interior": ("#031820", "#5fe0c8", "sea"),
    "cidades-que-escutam": ("#0e0f1a", "#ffd166", "rings"),
    "a-luz-do-sertao": ("#2b160b", "#ffb347", "sun"),
    "noite-de-estreia": ("#140b14", "#ff7aa8", "beam"),
}


def abstract_art(w, h, bg, acc, motif, seed):
    rng = np.random.default_rng(seed)
    f = vgradient(w, h, bg, "#030407")
    f += radial(w, h, w * rng.uniform(0.3, 0.7), h * rng.uniform(0.25, 0.5), max(w, h) * 0.9, 2.2)[:, :, None] * hexrgb(acc) * 0.35
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    A = hexrgb(acc)
    if motif == "sea":
        for i in range(26):
            y = h * 0.55 + i * h * 0.018
            d.line([(x, y + 8 * math.sin(x / 40 + i)) for x in range(0, w + 10, 10)], fill=int(200 - i * 6), width=2)
        d.ellipse([w * 0.6, h * 0.2, w * 0.6 + w * 0.18, h * 0.2 + w * 0.18], fill=255)
    elif motif == "city":
        for i in range(30):
            bx = rng.uniform(-0.1, 1) * w
            bw = rng.uniform(0.05, 0.14) * w
            bh = rng.uniform(0.2, 0.6) * h
            d.rectangle([bx, h - bh, bx + bw, h], outline=int(rng.uniform(60, 200)), width=2)
        for _ in range(120):
            x, y = rng.uniform(0, w), rng.uniform(0, h)
            d.line([(x, y), (x - 4, y + 24)], fill=90, width=1)
    elif motif == "beam":
        d.polygon([(w * 0.5, h * 0.4), (w * 1.1, h * 0.15), (w * 1.1, h * 0.55)], fill=120)
        d.rectangle([w * 0.46, h * 0.4, w * 0.54, h * 0.9], fill=230)
        d.ellipse([w * 0.44, h * 0.36, w * 0.56, h * 0.44], fill=255)
    elif motif == "planet":
        d.ellipse([w * 0.1, h * 0.55, w * 1.6, h * 1.6], outline=255, width=3)
        d.ellipse([w * 0.6, h * 0.18, w * 0.75, h * 0.18 + w * 0.15], fill=220)
        for _ in range(140):
            x, y = rng.uniform(0, w), rng.uniform(0, h * 0.6)
            d.point((x, y), fill=int(rng.uniform(80, 255)))
    elif motif == "dunes":
        for i in range(7):
            y0 = h * (0.5 + i * 0.07)
            d.polygon([(0, h)] + [(x, y0 + 30 * math.sin(x / (120 + i * 20) + i)) for x in range(0, w + 20, 20)] + [(w, h)], fill=int(40 + i * 25))
        d.ellipse([w * 0.4, h * 0.22, w * 0.6, h * 0.22 + w * 0.2], fill=255)
    elif motif == "lines":
        for i in range(40):
            y = rng.uniform(0, h)
            d.line([(0, y), (w, y + rng.uniform(-200, 200))], fill=int(rng.uniform(40, 230)), width=int(rng.uniform(1, 4)))
    elif motif == "waves":
        for i in range(18):
            d.line([(x, h * 0.5 + (60 + i * 4) * math.sin(x / (50 + i * 3) + i * 0.6)) for x in range(0, w + 6, 6)], fill=int(80 + i * 9), width=2)
    elif motif == "street":
        d.polygon([(w * 0.42, h * 0.45), (w * 0.58, h * 0.45), (w * 1.0, h), (0, h)], fill=50)
        for i in range(10):
            y = h * (0.45 + i * 0.055)
            d.line([(w * 0.5, y), (w * 0.5, y + 14)], fill=230, width=3)
        for side in (0, 1):
            for i in range(6):
                x = w * (0.1 + i * 0.06) if side == 0 else w * (0.9 - i * 0.06)
                d.ellipse([x - 6, h * 0.35 - 6, x + 6, h * 0.35 + 6], fill=255)
    elif motif == "rings":
        cx, cy = w * 0.5, h * 0.45
        for i in range(14):
            r = 20 + i * w * 0.05
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=int(250 - i * 15), width=2)
    elif motif == "mountains":
        for i in range(5):
            y0 = h * (0.45 + i * 0.09)
            pts = [(0, h)]
            for x in range(0, w + 40, 40):
                pts.append((x, y0 - abs(math.sin(x / (90 + 30 * i) + i)) * h * 0.12))
            pts.append((w, h))
            d.polygon(pts, fill=int(50 + i * 35))
    elif motif == "hands":
        for k in range(2):
            cx = w * (0.38 + 0.24 * k)
            cy = h * 0.5
            for i in range(5):
                ang = math.radians(-110 + i * 22 + (k * 2 - 1) * 8)
                d.line([(cx, cy), (cx + math.cos(ang) * w * 0.22, cy + math.sin(ang) * w * 0.22)], fill=230, width=int(w * 0.035))
            d.ellipse([cx - w * 0.09, cy - w * 0.07, cx + w * 0.09, cy + w * 0.12], fill=230)
    elif motif == "sun":
        d.ellipse([w * 0.3, h * 0.25, w * 0.7, h * 0.25 + w * 0.4], fill=255)
        for i in range(5):
            y0 = h * (0.62 + i * 0.06)
            d.rectangle([0, y0, w, y0 + h * 0.008], fill=120)
    img = img.filter(ImageFilter.GaussianBlur(max(1.5, w / 400)))
    f += np.asarray(img, np.float32)[:, :, None] / 255.0 * A * 0.8
    noise = rng.normal(0, 4, (h, w, 1))
    return Image.fromarray(np.clip(f + noise, 0, 255).astype(np.uint8))


def make_posters():
    os.makedirs(POSTERS, exist_ok=True)
    for i, (slug, (bg, acc, motif)) in enumerate(POSTER_SPECS.items()):
        save_webp(abstract_art(600, 900, bg, acc, motif, i * 13 + 1), os.path.join(POSTERS, f"{slug}.webp"))
        save_webp(abstract_art(1280, 720, bg, acc, motif, i * 13 + 1), os.path.join(POSTERS, f"{slug}-backdrop.webp"), q=78)
        print("  pôster:", slug)


def make_ligacao():
    out = os.path.join(MEDIA, "a-ligacao")
    film = Ligacao()
    print("Áudio: A Ligação")
    audio = ligacao_audio()
    print("Vídeo: A Ligação")
    stills = render(film, LIGACAO_DUR, out, "a-ligacao", audio, keep_frames=(16.6, 27.0, 42.0))
    save_webp(stills[27.0], os.path.join(out, "backdrop.webp"), (1600, 900), 80)
    save_webp(poster_crop(stills[27.0], 0.52), os.path.join(out, "poster.webp"), (600, 900))
    save_webp(stills[16.6], os.path.join(out, "still-wide.webp"), (1280, 720))
    save_webp(stills[42.0], os.path.join(out, "still-door.webp"), (1280, 720))


class HeroLoop:
    DUR = 8.0

    def __init__(self):
        self.room = build_room()["base"]

    def frame(self, t):
        f = self.room.copy()
        door_layer(f, 0.0)
        rain(f, t, 1.0)
        # leve glow pulsante do telefone em repouso (sem toque)
        add_glow(f, radial(W, H, 860, 724, 260, 2.0), "#4a6db0", 0.25 + 0.05 * math.sin(t * 1.5))
        k = t / self.DUR
        img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8))
        s = 1.08 - 0.04 * k
        cw, ch = W / s, H / s
        img = img.crop((int(W * 0.58 - cw / 2), int(H / 2 - ch / 2), int(W * 0.58 + cw / 2), int(H / 2 + ch / 2))).resize((W, H), Image.BILINEAR)
        return np.asarray(img, np.float32)


def make_manifesto_and_hero():
    out = os.path.join(MEDIA, "manifesto")
    print("Vídeo: Manifesto")
    stills = render(Manifesto(), Manifesto.DUR, out, "manifesto", manifesto_audio(), keep_frames=(9.0, 15.0))
    save_webp(stills[9.0], os.path.join(out, "backdrop.webp"), (1600, 900), 80)
    save_webp(poster_crop(stills[15.0], 0.5), os.path.join(out, "poster.webp"), (600, 900))
    print("Vídeo: Hero loop")
    render(HeroLoop(), HeroLoop.DUR, os.path.join(MEDIA, "hero"), "hero-loop", None, renditions=((1280, 720, 27),))


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("all", "posters"):
        make_posters()
    if what in ("all", "ligacao"):
        make_ligacao()
    if what in ("all", "manifesto"):
        make_manifesto_and_hero()
    print("ok")
