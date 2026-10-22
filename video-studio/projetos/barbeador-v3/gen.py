#!/usr/bin/env python3
"""Projeto HyperFrames do vídeo do barbeador (TikTok Shop). Sem emojis.

Saídas: index.html, compositions/legendas.html, compositions/overlays.html
"""
import json, re, html, subprocess
from pathlib import Path

P = Path(__file__).resolve().parent
B = P.parent
DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            str(P / "assets/base.mp4")], capture_output=True, text=True).stdout)
DUR = round(DUR - 0.02, 2)

# ---------------- palavras (com correções do que foi falado) ----------------
FIX = {"a prova": "à prova", "isso.": "isso", "Corta": "corta", "dos...": "dos", "Pelos": "pelos",
       "encravados": "encravados.", "Eles": "eles", "um homem,": "o homem,", "em cravado.": "encravados.",
       "em cravados.": "encravados."}
raw = json.load(open(B / "words.json"))
words, i = [], 0
while i < len(raw):
    w = dict(raw[i])
    nxt = raw[i + 1] if i + 1 < len(raw) else None
    par = f'{w["text"]} {nxt["text"]}' if nxt else ""
    if nxt and par.split(" ")[0] + " " + par.split(" ")[1] in FIX:
        partes = FIX[par].split(" ")
        if len(partes) == 1:  # duas palavras ouvidas viram uma
            w["text"] = partes[0]; w["end"] = nxt["end"]
            words.append(w)
        else:
            w["text"] = partes[0]
            words.append(w)
            n2 = dict(nxt); n2["text"] = partes[1]
            words.append(n2)
        i += 2
        continue
    m = re.fullmatch(r"(\d+)([,.?!]?)", w["text"])
    if m and nxt and nxt["text"].lower().startswith("reais"):
        w["text"] = "R$" + m.group(1) + re.sub(r"^reais", "", nxt["text"], flags=re.I)
        w["end"] = nxt["end"]
        i += 1
    else:
        w["text"] = FIX.get(w["text"], w["text"])
    words.append(w)
    i += 1


def find(txt, after=0.0):
    for w in words:
        if w["start"] >= after and re.sub(r"[^\wÀ-ú$']", "", w["text"]).lower() == txt.lower():
            return w["start"]
    raise KeyError(txt)


DESTAQUE = {"presente", "homem", "pele", "nariz", "cabelo", "barba", "diferença", "banho", "prova", "d'água",
            "cerâmica", "cortes", "sensíveis", "medo", "corta", "irrita", "encravados", "cabeças", "pente",
            "níveis", "kit", "limpeza", "carregar", "baratos", "promoção", "link", "embaixo", "estoque",
            "corre", "acabe"}
DINHEIRO = re.compile(r"^R\$\d+")

groups, cur = [], []
for k, w in enumerate(words):
    cur.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    pausa = (nxt["start"] - w["end"]) if nxt else 9
    chars = len(" ".join(x["text"] for x in cur))
    prox = chars + 1 + len(nxt["text"]) if nxt else 0
    if len(cur) == 4 or prox > 20 or re.search(r"[.?!,:]$", w["text"]) or pausa >= 0.15 or not nxt:
        groups.append(cur)
        cur = []


def legendas_html():
    out = []
    for gi, g in enumerate(groups):
        spans = []
        for wi, w in enumerate(g):
            base = re.sub(r"[^\wÀ-ú$']", "", w["text"]).lower()
            cls = "w" + (" money" if DINHEIRO.match(w["text"]) else (" key" if base in DESTAQUE else ""))
            spans.append(f'<span id="lg-w{gi}-{wi}" class="{cls}" data-t="{w["start"]:.3f}">'
                         f'{html.escape(w["text"].upper())}</span>')
        g0 = max(0.1, g[0]["start"] - 0.05)
        nxt0 = groups[gi + 1][0]["start"] - 0.05 if gi + 1 < len(groups) else DUR
        g1 = min(max(g[-1]["end"] + 0.25, g0 + 0.35), nxt0)
        out.append(f'      <div id="lg-g{gi}" class="grp" data-a="{g0:.3f}" data-b="{g1:.3f}">'
                   f'<div class="line">{"".join(spans)}</div></div>')
    return "\n".join(out)


LEGENDAS = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    #root .band {{ position: absolute; left: 0; right: 0; top: 1225px; height: 100px; }}
    #root .grp {{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      opacity: 0; overflow: visible; }}
    #root .line {{ display: flex; gap: 0 22px; justify-content: center; align-items: center; width: 100%;
      flex-wrap: nowrap; white-space: nowrap; padding: 0 60px; }}
    #root .w {{ display: inline-block; font-family: Montserrat; font-weight: 900; font-size: 62px;
      line-height: 1.05; letter-spacing: -0.01em; color: #fff; -webkit-text-stroke: 7px #000;
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

# ---------------- momentos ----------------
t_agua = find("prova")
t_link = find("link")
AGUA0, AGUA1 = find("banho") - 0.1, t_agua + 2.2
CTA0 = t_link - 0.15

OVERLAYS = f"""<template>
  <script src="assets/js/gsap.min.js"></script>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; font-family: Montserrat; }}
    #root #ov-agua {{ position: absolute; right: 44px; top: 190px; }}
    #root #ag-in {{ display: flex; align-items: center; gap: 14px; padding: 12px 22px 12px 14px; border-radius: 22px;
      background: rgba(255,255,255,.95); box-shadow: 0 10px 26px rgba(0,0,0,.30); }}
    #root .gota {{ position: relative; width: 62px; height: 62px; border-radius: 50%; background: #1E88E5; }}
    #root .gota i {{ position: absolute; left: 19px; top: 14px; width: 24px; height: 24px; background: #fff;
      border-radius: 0 50% 50% 50%; transform: rotate(45deg); }}
    #root #ag-in b {{ display: block; color: #0D47A1; font-weight: 900; font-size: 30px; line-height: 1.02; letter-spacing: 0.02em; }}
    #root #ov-cta {{ position: absolute; left: 0; right: 0; top: 850px; display: flex; flex-direction: column; align-items: center; gap: 6px; }}
    #root #cta-pill {{ display: inline-block; padding: 18px 42px; border-radius: 999px; background: #FE2C55; color: #fff;
      font-weight: 900; font-size: 52px; letter-spacing: 0.02em; box-shadow: 0 16px 34px rgba(254,44,85,.40); }}
    #root .chev {{ width: 60px; height: 60px; border-right: 14px solid #FE2C55; border-bottom: 14px solid #FE2C55;
      transform: rotate(45deg); border-radius: 6px; }}
  </style>
  <div id="root" data-composition-id="overlays" data-layout-allow-overlap>
    <div id="ov-agua" class="clip" data-start="{AGUA0:.2f}" data-duration="{AGUA1 - AGUA0:.2f}">
      <div id="ag-in"><span class="gota"><i></i></span><span><b>À PROVA</b><b>D'ÁGUA</b></span></div>
    </div>
    <div id="ov-cta" class="clip" data-start="{CTA0:.2f}" data-duration="{DUR - CTA0:.2f}">
      <div id="cta-pill">TOQUE NO CARRINHO</div>
      <div style="display:flex;flex-direction:column;align-items:center;margin-top:10px">
        <div class="chev" id="ch1"></div><div class="chev" id="ch2" style="margin-top:-26px"></div>
      </div>
    </div>
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      tl.fromTo("#ag-in", {{ opacity: 0, scale: 0.6, y: -20 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "back.out(2)" }}, {AGUA0:.2f});
      tl.to("#ag-in", {{ opacity: 0, scale: 0.8, duration: 0.2, ease: "power2.in" }}, {AGUA1 - 0.2:.2f});
      tl.fromTo("#cta-pill", {{ opacity: 0, scale: 0.5, y: 30 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.38, ease: "back.out(2.2)" }}, {CTA0:.2f});
      tl.fromTo("#cta-pill", {{ scale: 1 }}, {{ scale: 1.06, duration: 0.32, ease: "sine.inOut", immediateRender: false, yoyo: true, repeat: {max(1, int((DUR - CTA0 - 0.5) / 0.32) - 1)} }}, {CTA0 + 0.45:.2f});
      tl.fromTo(["#ch1", "#ch2"], {{ y: -10, opacity: 0.35 }}, {{ y: 12, opacity: 1, duration: 0.4, ease: "sine.inOut", stagger: 0.12, yoyo: true, repeat: {max(1, int((DUR - CTA0) / 0.4) - 2)} }}, {CTA0 + 0.3:.2f});
      window.__timelines["overlays"] = tl;
    }})();
  </script>
</template>
"""

# ---------------- sons ----------------
PEAK = {"pop": 0.120, "whoosh": 0.162, "whoosh-short": 0.162, "click": 0.073, "click-soft": 0.073,
        "sparkle": 0.027, "chime": 0.418, "impact-bass-1": 0.073, "ping": 0.324, "notification": 0.229}
FDUR = {"pop": 0.72, "whoosh": 0.57, "whoosh-short": 0.57, "click": 0.37, "click-soft": 0.37, "sparkle": 1.8,
        "chime": 2.54, "impact-bass-1": 2.12, "ping": 1.32, "notification": 2.46}
VOL = {"pop": 0.9, "whoosh": 0.42, "whoosh-short": 0.42, "click": 1.3, "click-soft": 1.2, "sparkle": 0.28,
       "chime": 1.1, "impact-bass-1": 0.32, "ping": 1.0, "notification": 0.6}
HEAD_T = 0.12
SFX = []  # referência não usa efeitos sonoros


def sfx_html():
    out = []
    for k, (nome, hit) in enumerate(SFX):
        st = max(0.0, hit + 1 / 30 - PEAK[nome])
        out.append(f'      <audio id="sfx-{k:02d}" class="clip" src="assets/sfx/{nome}.mp3" data-start="{st:.3f}" '
                   f'data-duration="{min(FDUR[nome], DUR - st):.2f}" data-volume="{VOL[nome]}" data-track-index="{20 + k}"></audio>')
    return "\n".join(out)


INDEX = f"""<!doctype html>
<html lang="pt-BR" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/js/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 1080px; height: 1920px; font-family: Montserrat; }}
      #base {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
      <video id="base" class="clip" src="assets/base.mp4" data-start="0" data-duration="{DUR}" muted playsinline data-track-index="0" style="z-index:1"></video>
      <audio id="voz" class="clip" src="assets/voz.wav" data-start="0" data-duration="{DUR}" data-volume="1" data-track-index="1"></audio>
{sfx_html()}
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
print(f"dur={DUR} grupos={len(groups)} sfx={len(SFX)}")
print({'agua': round(AGUA0, 2), 'cta': round(CTA0, 2)})
