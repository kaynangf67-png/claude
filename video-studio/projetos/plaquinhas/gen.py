#!/usr/bin/env python3
"""Gera o projeto HyperFrames do vídeo das plaquinhas a partir de words.json.

Saídas: index.html, compositions/legendas.html, compositions/overlays.html
"""
import json, re, html, subprocess
from pathlib import Path

P = Path(__file__).resolve().parent
T = Path("/tmp/claude-0/-home-user-claude/055c61e1-07f8-51c4-be32-d290dafc9e81/scratchpad/tt")
DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            str(P / "assets/base.mp4")], capture_output=True, text=True).stdout)
DUR = round(DUR - 0.02, 2)

# ---------------- palavras ----------------
raw = json.load(open(T / "words.json"))
words = []
i = 0
while i < len(raw):
    w = dict(raw[i])
    m = re.fullmatch(r"(\d+)([,.?!]?)", w["text"])
    if m and i + 1 < len(raw) and raw[i + 1]["text"].lower().startswith("reais"):
        nxt = raw[i + 1]
        w["text"] = "R$" + m.group(1) + re.sub(r"^reais", "", nxt["text"], flags=re.I)
        w["end"] = nxt["end"]
        i += 1
    elif m and m.group(1) in ("70", "80"):
        w["text"] = "R$" + w["text"]
    words.append(w)
    i += 1


def find(txt, after=0.0):
    for w in words:
        if w["start"] >= after and re.sub(r"[^\wÀ-ú$]", "", w["text"]).lower() == txt.lower():
            return w["start"]
    raise KeyError(txt)


DESTAQUE = {"renda", "extra", "dinheiro", "plaquinhas", "plaquinha", "nfc", "qr", "code", "graça", "google",
            "barbearias", "lucro", "grana", "três", "dias", "fornecedor", "segue", "negócio", "avaliações",
            "avaliação", "internet"}
DINHEIRO = re.compile(r"^R\$\d+")

# grupos de 2-3 palavras; quebra em pontuação ou pausa >= 150 ms
groups, cur = [], []
for k, w in enumerate(words):
    cur.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    pausa = (nxt["start"] - w["end"]) if nxt else 9
    if len(cur) == 3 or re.search(r"[.?!,:]$", w["text"]) or pausa >= 0.15 or not nxt:
        groups.append(cur)
        cur = []


def legendas_html():
    out = []
    for gi, g in enumerate(groups):
        spans = []
        for wi, w in enumerate(g):
            txt = w["text"]
            base = re.sub(r"[^\wÀ-ú$]", "", txt).lower()
            cls = "w"
            if DINHEIRO.match(txt):
                cls += " money"
            elif base in DESTAQUE:
                cls += " key"
            spans.append(f'<span id="lg-w{gi}-{wi}" class="{cls}" data-t="{w["start"]:.3f}">'
                         f'{html.escape(txt.upper())}</span>')
        g0 = max(0.1, g[0]["start"] - 0.05)
        nxt0 = groups[gi + 1][0]["start"] - 0.05 if gi + 1 < len(groups) else DUR
        g1 = min(max(g[-1]["end"] + 0.25, g0 + 0.35), nxt0)
        out.append(f'      <div id="lg-g{gi}" class="grp" data-a="{g0:.3f}" data-b="{g1:.3f}">'
                   f'<div class="line">{"".join(spans)}</div></div>')
    return "\n".join(out)


LEGENDAS = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    #root .band {{ position: absolute; left: 0; right: 0; top: 1110px; height: 210px; }}
    #root .grp {{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      opacity: 0; overflow: visible; }}
    #root .line {{ display: flex; gap: 0 34px; justify-content: center; align-items: center; width: 100%;
      flex-wrap: wrap; padding: 0 70px; }}
    #root .w {{ display: inline-block; font-family: Montserrat; font-weight: 900; font-size: 84px;
      line-height: 1.05; letter-spacing: -0.02em; color: #fff; -webkit-text-stroke: 9px #000;
      paint-order: stroke fill; text-shadow: 0 8px 18px rgba(0,0,0,.45); transform-origin: 50% 60%; }}
  </style>
  <div id="root" data-composition-id="legendas">
    <div class="band" data-layout-allow-overflow>
{legendas_html()}
    </div>
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      document.querySelectorAll("#root .grp").forEach(function (g) {{
        var a = +g.dataset.a, b = +g.dataset.b;
        var din = Math.min(0.13, (b - a) * 0.4), dout = Math.min(0.08, (b - a) * 0.25);
        tl.fromTo(g, {{ opacity: 0, scale: 0.86, y: 18 }}, {{ opacity: 1, scale: 1, y: 0, duration: din, ease: "back.out(2.4)" }}, a);
        tl.to(g, {{ opacity: 0, duration: dout, ease: "power2.in" }}, b - dout);
        tl.set(g, {{ opacity: 0, visibility: "hidden" }}, b);
        g.querySelectorAll(".w").forEach(function (w) {{
          var t = Math.max(a, +w.dataset.t - 0.03);
          var cor = w.classList.contains("money") ? "#2BE36B" : (w.classList.contains("key") ? "#FFE500" : "#FFFFFF");
          var ativo = w.classList.contains("money") ? "#2BE36B" : "#FFE500";
          tl.fromTo(w, {{ color: "#FFFFFF", scale: 1 }}, {{ color: ativo, scale: 1.07, duration: 0.07, ease: "power2.out" }}, t);
          tl.to(w, {{ color: cor, scale: 1, duration: 0.16, ease: "power2.out" }}, t + 0.16);
        }});
      }});
      window.__timelines["legendas"] = tl;
    }})();
  </script>
</template>
"""

# ---------------- overlays ----------------
L, R = (40, 440), (800, 440)  # cantos para emojis (x, y do topo-esquerdo, 240px)


def emoji(cid, code, t0, dur, pos, size=240):
    x, y = pos
    return dict(kind="emoji", id=cid, code=code, t0=t0, dur=dur, x=x, y=y, size=size)


t_dinheiro = find("dinheiro")
t_olhada = find("olhada")
t_nfc = find("NFC")
t_qr = find("QR")
t_graca = find("graça")
t_google = find("Google")
t_pensa = find("pensa")
t_lucro = find("lucro")
t_20 = find("R$20")
t_90 = find("R$90")
t_massa = find("massa")
t_dinheiro2 = find("dinheiro", 58)
t_tres = find("três", 60)
t_500 = find("R$500")
t_segue = find("segue")

EMOJIS = [
    emoji("em-dinheiro", "1f911", t_dinheiro - 0.08, 1.7, R),
    emoji("em-olhada", "1f440", t_olhada - 0.15, 1.7, L),
    emoji("em-pensa", "1f914", t_pensa - 0.1, 1.6, R),
    emoji("em-lucro", "1f680", t_lucro - 0.1, 1.9, L),
    emoji("em-massa", "1f4aa", t_massa - 0.25, 1.6, R),
    emoji("em-dinheiro2", "1f4b8", t_dinheiro2 - 0.12, 1.7, L),
]


def overlays_html():
    el, js = [], []
    for e in EMOJIS:
        el.append(f'    <div id="{e["id"]}" class="clip emo" data-start="{e["t0"]:.2f}" data-duration="{e["dur"]:.2f}" '
                  f'style="left:{e["x"]}px;top:{e["y"]}px;width:{e["size"]}px;height:{e["size"]}px">'
                  f'<div class="emo-in" id="{e["id"]}-in"></div></div>')
        js.append(f'      emo("{e["id"]}", "{e["code"]}", {e["t0"]:.2f}, {e["dur"]:.2f});')
    return "\n".join(el), "\n".join(js)


EMO_EL, EMO_JS = overlays_html()
CHIPS_END = t_qr + 1.9
STAMP0, STAMP1 = t_graca - 0.1, t_graca + 1.6
PRICE0, PRICE1 = t_20 - 0.15, t_90 + 2.6
DIAS0, DIAS1 = t_tres - 0.05, t_500 + 1.15

OVERLAYS = f"""<template>
  <script src="assets/js/gsap.min.js"></script>
  <script src="assets/js/lottie.min.js"></script>
  <style>
    @font-face {{ font-family: "Noto Color Emoji"; src: local("Noto Color Emoji"); }}
    #root {{ position: absolute; inset: 0; pointer-events: none; font-family: Montserrat; }}
    #root .emo {{ position: absolute; }}
    #root .emo-in {{ width: 100%; height: 100%; filter: drop-shadow(0 14px 22px rgba(0,0,0,.35)); }}
    #root .chip {{ position: absolute; display: flex; align-items: center; gap: 14px; padding: 18px 34px;
      border-radius: 999px; font-weight: 900; font-size: 54px; letter-spacing: -0.01em;
      box-shadow: 0 16px 36px rgba(0,0,0,.28); }}
    #root .chip i {{ font-style: normal; font-family: "Noto Color Emoji"; font-size: 46px; }}
    #root #ov-nfc {{ left: 70px; top: 300px; background: #1A73E8; color: #fff; }}
    #root #ov-qr {{ right: 70px; top: 300px; background: #fff; color: #111; }}
    #root #ov-gratis {{ position: absolute; left: 0; right: 0; top: 250px; display: flex; justify-content: center; }}
    #root #ov-gratis b {{ display: inline-block; padding: 14px 46px; border: 10px solid #00B84A; color: #00B84A;
      background: rgba(255,255,255,.92); border-radius: 22px; font-weight: 900; font-size: 104px;
      letter-spacing: 0.02em; box-shadow: 0 18px 40px rgba(0,0,0,.25); }}
    #root #ov-preco {{ position: absolute; left: 0; right: 0; top: 215px; height: 330px; }}
    #root .pc {{ position: absolute; left: 50%; width: 560px; margin-left: -280px; padding: 20px 30px 24px;
      border-radius: 34px; text-align: center; box-shadow: 0 22px 48px rgba(0,0,0,.30); }}
    #root .pc small {{ display: block; font-size: 46px; font-weight: 800; letter-spacing: 0.12em; opacity: .85; }}
    #root .pc b {{ display: block; font-size: 112px; font-weight: 900; line-height: 1; letter-spacing: -0.03em; }}
    #root #pc-compra {{ top: 0; background: #fff; color: #111; }}
    #root #pc-venda {{ top: 0; background: #00B84A; color: #fff; }}
    #root #pc-seta {{ position: absolute; left: 50%; top: 120px; width: 120px; margin-left: -60px; text-align: center;
      font-family: "Noto Color Emoji"; font-size: 96px; }}
    #root #ov-dias {{ position: absolute; left: 0; right: 0; top: 590px; display: flex; justify-content: center; }}
    #root #ov-dias b {{ font-family: Montserrat, "Noto Color Emoji"; display: inline-block; padding: 14px 34px; border-radius: 999px; background: #FFE500; color: #111;
      font-weight: 900; font-size: 52px; box-shadow: 0 14px 30px rgba(0,0,0,.28); }}
    #root #ov-confete {{ left: 0; top: 0; width: 1080px; height: 1920px; }}
    #root .pt {{ position: absolute; left: 540px; top: 380px; width: 18px; height: 30px; border-radius: 4px; opacity: 0; }}
  </style>
  <div id="root" data-composition-id="overlays" data-layout-allow-overlap>
{EMO_EL}
    <div id="ov-nfc" class="clip chip" data-start="{t_nfc - 0.08:.2f}" data-duration="{CHIPS_END - t_nfc + 0.08:.2f}"><span class="chip-in" id="ov-nfc-in"><i>📶</i> NFC</span></div>
    <div id="ov-qr" class="clip chip" data-start="{t_qr - 0.08:.2f}" data-duration="{CHIPS_END - t_qr + 0.08:.2f}"><span class="chip-in" id="ov-qr-in"><i>🔳</i> QR CODE</span></div>
    <div id="ov-gratis" class="clip" data-start="{STAMP0:.2f}" data-duration="{STAMP1 - STAMP0:.2f}"><b id="ov-gratis-in">GRÁTIS</b></div>
    <div id="ov-preco" class="clip" data-start="{PRICE0:.2f}" data-duration="{PRICE1 - PRICE0:.2f}">
      <div id="pc-compra" class="pc"><small>VOCÊ COMPRA</small><b>R$20</b></div>
      <div id="pc-venda" class="pc"><small>VOCÊ VENDE</small><b id="pc-venda-v">R$90</b></div>
    </div>
    <div id="ov-dias" class="clip" data-start="{DIAS0:.2f}" data-duration="{DIAS1 - DIAS0:.2f}"><b id="ov-dias-in">EM 3 DIAS</b></div>
    <div id="ov-confete" class="clip" data-start="{t_500 - 0.05:.2f}" data-duration="1.6" data-layout-ignore>
      {"".join(f'<span class="pt" style="background:{c}"></span>' for c in ["#FFE500", "#00B84A", "#1A73E8", "#FF3B30", "#FFFFFF"] * 9)}
    </div>
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      function pop(sel, a, b) {{
        tl.fromTo(sel, {{ scale: 0.2, opacity: 0, rotation: -12 }}, {{ scale: 1, opacity: 1, rotation: 0, duration: 0.42, ease: "back.out(2.6)" }}, a);
        tl.to(sel, {{ scale: 0.6, opacity: 0, duration: 0.18, ease: "power2.in" }}, b - 0.2);
      }}
      function emo(id, code, a, d) {{
        var anim = lottie.loadAnimation({{ container: document.getElementById(id + "-in"), renderer: "svg",
          loop: true, autoplay: false, path: "assets/lottie/" + code + ".json" }});
        window.__hfLottie = window.__hfLottie || []; window.__hfLottie.push(anim);
        pop("#" + id + "-in", a, a + d);
        tl.fromTo("#" + id + "-in", {{ y: 0 }}, {{ y: -14, duration: d / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }}, a + 0.4);
      }}
{EMO_JS}
      // selos NFC / QR CODE
      [["#ov-nfc-in", {t_nfc - 0.08:.2f}], ["#ov-qr-in", {t_qr - 0.08:.2f}]].forEach(function (c) {{
        tl.fromTo(c[0], {{ scale: 0, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.35, ease: "back.out(3)" }}, c[1]);
      }});
      tl.to(["#ov-nfc-in", "#ov-qr-in"], {{ scale: 0.7, opacity: 0, duration: 0.18, ease: "power2.in" }}, {CHIPS_END - 0.2:.2f});
      // carimbo GRÁTIS
      tl.fromTo("#ov-gratis-in", {{ scale: 2.6, opacity: 0, rotation: 14 }}, {{ scale: 1, opacity: 1, rotation: -6, duration: 0.2, ease: "power4.in" }}, {STAMP0:.2f});
      tl.fromTo("#ov-gratis-in", {{ x: 0 }}, {{ x: 10, duration: 0.03, yoyo: true, repeat: 3, ease: "none" }}, {STAMP0 + 0.2:.2f});
      tl.to("#ov-gratis-in", {{ scale: 0.7, opacity: 0, duration: 0.18 }}, {STAMP1 - 0.2:.2f});
      // card de preço
      var a = {PRICE0:.2f}, v = {t_90 - 0.12:.2f}, b = {PRICE1:.2f};
      tl.fromTo("#pc-compra", {{ y: -60, opacity: 0, scale: 0.6 }}, {{ y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }}, a);
      tl.set("#pc-venda", {{ opacity: 0 }}, a);
      tl.to("#pc-compra", {{ x: -250, y: -10, scale: 0.62, duration: 0.35, ease: "power3.inOut" }}, v - 0.25);
      tl.fromTo("#pc-venda", {{ opacity: 0, x: 120, scale: 0.4 }}, {{ opacity: 1, x: 150, scale: 0.9, duration: 0.42, ease: "back.out(2.4)" }}, v);
      tl.fromTo("#pc-venda", {{ boxShadow: "0 0 0 0 rgba(0,184,74,.7)" }}, {{ boxShadow: "0 0 0 34px rgba(0,184,74,0)", duration: 0.7, ease: "power2.out" }}, v + 0.35);
      tl.to(["#pc-compra", "#pc-venda"], {{ opacity: 0, y: -40, duration: 0.25, ease: "power2.in" }}, b - 0.25);
      // EM 3 DIAS
      tl.fromTo("#ov-dias-in", {{ scale: 0, opacity: 0, rotation: -8 }}, {{ scale: 1, opacity: 1, rotation: -4, duration: 0.4, ease: "back.out(2.8)" }}, {DIAS0:.2f});
      tl.to("#ov-dias-in", {{ opacity: 0, scale: 0.7, duration: 0.18 }}, {DIAS1 - 0.2:.2f});
      // confete (trajetórias determinísticas com gravidade)
      var pts = document.querySelectorAll("#ov-confete .pt"), c0 = {t_500 - 0.05:.2f};
      pts.forEach(function (p, i) {{
        var ang = -Math.PI / 2 + Math.cos(i * 2.17) * 1.25, vel = 900 + (i * 137 % 600);
        var vx = Math.cos(ang) * vel, vy = Math.sin(ang) * vel, T = 1.55;
        tl.fromTo(p, {{ x: 0, y: 0, opacity: 1, rotation: 0 }}, {{ x: vx * T * 0.62, duration: T, ease: "power1.out" }}, c0);
        tl.set(p, {{ x: 0, y: 0, opacity: 0, rotation: 0 }}, 0);
        tl.fromTo(p, {{ y: 0 }}, {{ y: vy * 0.35, duration: 0.45, ease: "power2.out", immediateRender: false }}, c0);
        tl.to(p, {{ y: vy * 0.35 + 1300, duration: T - 0.45, ease: "power2.in" }}, c0 + 0.45);
        tl.to(p, {{ rotation: (i % 2 ? 1 : -1) * (360 + i * 40), duration: T, ease: "none" }}, c0);
        tl.to(p, {{ opacity: 0, duration: 0.25 }}, c0 + T - 0.25);
      }});
      window.__timelines["overlays"] = tl;
    }})();
  </script>
</template>
"""

# ---------------- efeitos sonoros (pico alinhado 1 frame depois da imagem) ----------------
PEAK = {"pop": 0.120, "whoosh": 0.162, "whoosh-short": 0.162, "click": 0.073, "click-soft": 0.073,
        "sparkle": 0.027, "chime": 0.418, "impact-bass-1": 0.073, "ping": 0.324, "notification": 0.229,
        "riser": 3.472}
FDUR = {"pop": 0.72, "whoosh": 0.57, "whoosh-short": 0.57, "click": 0.37, "click-soft": 0.37, "sparkle": 1.8,
        "chime": 2.54, "impact-bass-1": 2.12, "ping": 1.32, "notification": 2.46, "riser": 3.55}
VOL = {"pop": 0.9, "whoosh": 0.42, "whoosh-short": 0.42, "click": 1.3, "click-soft": 1.2, "sparkle": 0.28,
       "chime": 1.1, "impact-bass-1": 0.32, "ping": 1.0, "notification": 0.6, "riser": 0.2}
HEAD_T = 0.15
FOLLOW0 = t_segue - 1.55  # o modelo pressiona o botão 1.0 s após entrar ("então já me segue")
SFX = [
    ("impact-bass-1", HEAD_T + 0.58),
    ("pop", t_dinheiro - 0.08 + 0.1),
    ("whoosh-short", t_olhada - 0.15 + 0.12),
    ("click-soft", t_nfc - 0.08 + 0.12),
    ("click-soft", t_qr - 0.08 + 0.12),
    ("impact-bass-1", STAMP0 + 0.2),
    ("sparkle", t_google - 0.25 + 0.2),
    ("chime", t_google - 0.25 + 1.3),
    ("pop", t_pensa - 0.1 + 0.1),
    ("whoosh", t_lucro - 0.1 + 0.12),
    ("pop", PRICE0 + 0.15),
    ("whoosh-short", t_90 - 0.3),
    ("ping", t_90 + 0.05),
    ("pop", t_massa - 0.25 + 0.1),
    ("whoosh", t_dinheiro2 - 0.12 + 0.12),
    ("riser", t_500),
    ("pop", DIAS0 + 0.1),
    ("impact-bass-1", t_500),
    ("sparkle", t_500 + 0.05),
    ("whoosh-short", FOLLOW0 + 0.15),
    ("click", FOLLOW0 + 1.0),
]


def sfx_html():
    out = []
    for k, (nome, hit) in enumerate(SFX):
        st = max(0.0, hit + 1 / 30 - PEAK[nome])
        extra = f' data-duration="{min(FDUR[nome], DUR - st):.2f}"' + (' data-fade-out="0.12"' if nome == "riser" else "")
        out.append(f'      <audio id="sfx-{k:02d}" class="clip" src="assets/sfx/{nome}.mp3" data-start="{st:.3f}"'
                   f'{extra} data-volume="{VOL[nome]}" data-track-index="{20 + k}"></audio>')
    return "\n".join(out)


INDEX = f"""<!doctype html>
<html lang="pt-BR" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/js/gsap.min.js"></script>
    <script src="assets/js/lottie.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 1080px; height: 1920px; font-family: Montserrat; }}
      #base {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      .card-branco {{ background: rgba(255,255,255,.96); border-radius: 44px; box-shadow: 0 22px 50px rgba(0,0,0,.28); }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <video id="base" class="clip" src="assets/base.mp4" data-start="0" data-duration="{DUR}" muted playsinline data-track-index="0" style="z-index:1"></video>
      <audio id="voz" class="clip" src="assets/voz.wav" data-start="0" data-duration="{DUR}" data-volume="1" data-track-index="1"></audio>
{sfx_html()}
      <div id="headline-slam" data-composition-id="headline-slam" data-composition-src="compositions/components/headline-slam.html"
        data-start="{HEAD_T}" data-duration="3.4" data-track-index="2" data-track-kind="graphics"
        data-variable-values='{{"text":"RENDA EXTRA","accent_word_index":1,"accent":"green","shadow":true}}'
        style="position:absolute;left:40px;top:190px;width:1000px;height:250px;z-index:5;--fg:#111;--brand:#00B84A;--font-display:Montserrat"></div>
      <div id="star-rating-fill" class="card-branco" data-composition-id="star-rating-fill" data-composition-src="compositions/components/star-rating-fill.html"
        data-start="{t_google - 0.25:.2f}" data-duration="2.6" data-track-index="3" data-track-kind="graphics"
        data-variable-values='{{"rating":5,"starCount":5,"showValue":"yes"}}'
        style="position:absolute;left:90px;top:240px;width:900px;height:200px;z-index:5;--brand:#FFB400;--muted:#c9c9c9;--fg:#111;--font-display:Montserrat"></div>
      <div id="count-up" class="card-branco" data-composition-id="count-up" data-composition-src="compositions/components/count-up.html"
        data-start="{t_500 - 1.75:.2f}" data-duration="{1.75 + 1.15:.2f}" data-track-index="4" data-track-kind="graphics"
        data-variable-values='{{"start":0,"end":500,"prefix":"R$","suffix":"","accent":"green","glow":false,"exit":"fade"}}'
        style="position:absolute;left:210px;top:240px;width:660px;height:320px;z-index:5;--brand:#00B84A;--fg:#111;--font-display:Montserrat"></div>
      <div id="tiktok-follow" data-composition-id="tiktok-follow" data-composition-src="compositions/tiktok-follow.html"
        data-start="{FOLLOW0:.2f}" data-duration="{DUR - FOLLOW0:.2f}" data-track-index="5" data-track-kind="graphics"
        data-width="1080" data-height="1920" style="position:absolute;inset:0;z-index:6"></div>
      <div id="overlays" data-composition-id="overlays" data-composition-src="compositions/overlays.html"
        data-start="0" data-duration="{DUR}" data-track-index="6" data-track-kind="graphics"
        data-width="1080" data-height="1920" style="position:absolute;inset:0;z-index:7"></div>
      <div id="legendas" data-composition-id="legendas" data-composition-src="compositions/legendas.html"
        data-start="0" data-duration="{DUR}" data-track-index="7" data-track-kind="captions"
        data-width="1080" data-height="1920" style="position:absolute;inset:0;z-index:8"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""

(P / "compositions/legendas.html").write_text(LEGENDAS)
(P / "compositions/overlays.html").write_text(OVERLAYS)
(P / "index.html").write_text(INDEX)
print(f"dur={DUR} grupos={len(groups)} sfx={len(SFX)} emojis={len(EMOJIS)}")
print({k: round(v, 2) for k, v in dict(dinheiro=t_dinheiro, google=t_google, r20=t_20, r90=t_90, r500=t_500, segue=t_segue, follow0=FOLLOW0).items()})
