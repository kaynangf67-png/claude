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
       "encravados": "encravados.", "Eles": "eles", "um homem,": "o homem,"}
raw = json.load(open(B / "words.json"))
words, i = [], 0
while i < len(raw):
    w = dict(raw[i])
    nxt = raw[i + 1] if i + 1 < len(raw) else None
    par = f'{w["text"]} {nxt["text"]}' if nxt else ""
    if nxt and par.split(" ")[0] + " " + par.split(" ")[1] in FIX:
        a, b = FIX[par].split(" ")
        w["text"] = a
        words.append(w)
        n2 = dict(nxt); n2["text"] = b
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
t_nariz = find("nariz")
t_cabelo = find("cabelo")
t_dif = find("diferença")
t_agua = find("prova")
t_ceram = find("cerâmica")
t_corta = find("corta", 23)
t_irrita = find("irrita")
t_pelos = find("pelos")
t_cabecas = find("cabeças")
t_100 = find("R$100")
t_baratos = find("baratos")
t_link = find("link")
t_corre = find("corre")

TRES0, TRES1 = t_nariz - 0.1, t_dif + 1.4
AGUA0, AGUA1 = t_agua - 0.1, t_agua + 1.6
CER0, CER1 = t_ceram - 0.1, t_ceram + 3.0
NAO0, NAO1 = t_corta - 0.1, min(t_pelos + 1.4, t_cabecas - 2.0)
KIT0, KIT1 = t_cabecas - 1.9, min(find("limpeza") + 1.2, t_100 - 0.2)
PRE0, PRE1 = t_100 - 0.1, t_baratos + 2.4
CTA0 = t_link - 0.15

OVERLAYS = f"""<template>
  <script src="assets/js/gsap.min.js"></script>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; font-family: Montserrat; }}
    #root .tag {{ display: inline-flex; align-items: center; gap: 18px; padding: 16px 30px; border-radius: 22px;
      font-weight: 900; font-size: 52px; letter-spacing: 0.01em; box-shadow: 0 16px 34px rgba(0,0,0,.30); }}
    #root .tag .n {{ display: inline-grid; place-items: center; width: 62px; height: 62px; border-radius: 50%;
      background: #FFE500; color: #111; font-size: 38px; }}
    #root .dark {{ background: rgba(17,17,17,.92); color: #fff; }}
    #root #ov-tres {{ position: absolute; left: 60px; top: 230px; display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }}
    #root #ov-agua {{ position: absolute; left: 0; right: 0; top: 260px; display: flex; justify-content: center; }}
    #root #ov-agua .tag {{ background: #1E88E5; color: #fff; font-size: 64px; }}
    #root #ov-ceram {{ position: absolute; left: 0; right: 0; top: 240px; display: flex; flex-direction: column; align-items: center; gap: 14px; }}
    #root #ov-ceram .tag {{ background: #fff; color: #111; font-size: 60px; }}
    #root #ov-ceram small {{ display: inline-block; padding: 10px 26px; border-radius: 999px; background: #00B84A; color: #fff;
      font-weight: 900; font-size: 40px; letter-spacing: 0.06em; }}
    #root #ov-nao {{ position: absolute; right: 50px; top: 230px; display: flex; flex-direction: column; gap: 16px; align-items: flex-end; }}
    #root #ov-nao .tag {{ position: relative; background: #fff; color: #111; font-size: 48px; }}
    #root #ov-nao .risco {{ position: absolute; left: 18px; right: 18px; top: 50%; height: 9px; margin-top: -4px;
      background: #FF3B30; border-radius: 6px; transform-origin: 0 50%; }}
    #root #ov-kit {{ position: absolute; left: 60px; top: 220px; display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }}
    #root #kit-tit {{ display: inline-block; padding: 12px 28px; border-radius: 18px; background: #FFE500; color: #111;
      font-weight: 900; font-size: 46px; letter-spacing: 0.02em; box-shadow: 0 14px 30px rgba(0,0,0,.28); }}
    #root .ck {{ display: inline-flex; align-items: center; gap: 18px; padding: 14px 28px 14px 18px; border-radius: 20px;
      background: rgba(17,17,17,.92); color: #fff; font-weight: 900; font-size: 46px; box-shadow: 0 14px 30px rgba(0,0,0,.28); }}
    #root .ck .box {{ position: relative; width: 54px; height: 54px; border-radius: 14px; background: #00B84A; }}
    #root .ck .v {{ position: absolute; left: 17px; top: 6px; width: 18px; height: 32px; border-right: 8px solid #fff;
      border-bottom: 8px solid #fff; transform: rotate(45deg); transform-origin: 50% 50%; }}
    #root #ov-preco {{ position: absolute; left: 0; right: 0; top: 230px; display: flex; flex-direction: column; align-items: center; gap: 22px; }}
    #root #pr-de {{ position: relative; display: inline-block; padding: 12px 34px; border-radius: 22px; background: #fff; color: #111;
      font-weight: 900; font-size: 96px; letter-spacing: -0.02em; box-shadow: 0 16px 34px rgba(0,0,0,.28); }}
    #root #pr-de small {{ display: block; font-size: 32px; letter-spacing: 0.12em; color: #666; text-align: center; }}
    #root #pr-risco {{ position: absolute; left: 20px; right: 20px; top: 58%; height: 12px; margin-top: -6px; background: #FF3B30;
      border-radius: 8px; transform-origin: 0 50%; transform: rotate(-6deg); }}
    #root #pr-agora {{ display: inline-block; padding: 18px 40px; border-radius: 26px; background: #00B84A; color: #fff;
      font-weight: 900; font-size: 64px; box-shadow: 0 16px 34px rgba(0,0,0,.28); }}
    #root #ov-cta {{ position: absolute; left: 0; right: 0; top: 850px; display: flex; flex-direction: column; align-items: center; gap: 6px; }}
    #root #cta-pill {{ display: inline-block; padding: 20px 46px; border-radius: 999px; background: #FE2C55; color: #fff;
      font-weight: 900; font-size: 58px; letter-spacing: 0.02em; box-shadow: 0 18px 38px rgba(254,44,85,.45); }}
    #root .chev {{ width: 70px; height: 70px; border-right: 16px solid #FE2C55; border-bottom: 16px solid #FE2C55;
      transform: rotate(45deg); border-radius: 6px; }}
  </style>
  <div id="root" data-composition-id="overlays" data-layout-allow-overlap>
    <div id="ov-tres" class="clip" data-start="{TRES0:.2f}" data-duration="{TRES1 - TRES0:.2f}">
      <div id="tr-1" class="tag dark"><span class="n">1</span>NARIZ</div>
      <div id="tr-2" class="tag dark"><span class="n">2</span>CABELO</div>
      <div id="tr-3" class="tag dark"><span class="n">3</span>BARBA</div>
    </div>
    <div id="ov-agua" class="clip" data-start="{AGUA0:.2f}" data-duration="{AGUA1 - AGUA0:.2f}"><div id="ag-in" class="tag">À PROVA D'ÁGUA</div></div>
    <div id="ov-ceram" class="clip" data-start="{CER0:.2f}" data-duration="{CER1 - CER0:.2f}">
      <div id="ce-in" class="tag">LÂMINA DE CERÂMICA</div><small id="ce-sub">EVITA CORTES</small>
    </div>
    <div id="ov-nao" class="clip" data-start="{NAO0:.2f}" data-duration="{NAO1 - NAO0:.2f}">
      <div id="na-1" class="tag">CORTES<span class="risco" id="na-r1"></span></div>
      <div id="na-2" class="tag">IRRITAÇÃO<span class="risco" id="na-r2"></span></div>
      <div id="na-3" class="tag">PELOS ENCRAVADOS<span class="risco" id="na-r3"></span></div>
    </div>
    <div id="ov-kit" class="clip" data-start="{KIT0:.2f}" data-duration="{KIT1 - KIT0:.2f}">
      <div id="kit-tit">O KIT VEM COMPLETO</div>
      <div id="ck-1" class="ck"><span class="box"><span class="v" id="v-1"></span></span>3 CABEÇAS</div>
      <div id="ck-2" class="ck"><span class="box"><span class="v" id="v-2"></span></span>PENTE DE 3 NÍVEIS</div>
      <div id="ck-3" class="ck"><span class="box"><span class="v" id="v-3"></span></span>CABO DE CARGA</div>
      <div id="ck-4" class="ck"><span class="box"><span class="v" id="v-4"></span></span>KIT DE LIMPEZA</div>
    </div>
    <div id="ov-preco" class="clip" data-start="{PRE0:.2f}" data-duration="{PRE1 - PRE0:.2f}">
      <div id="pr-de"><small>COSTUMA CUSTAR</small>+ DE R$100<span id="pr-risco"></span></div>
      <div id="pr-agora">PREÇO DE PROMOÇÃO</div>
    </div>
    <div id="ov-cta" class="clip" data-start="{CTA0:.2f}" data-duration="{DUR - CTA0:.2f}">
      <div id="cta-pill">TOQUE NO CARRINHO</div>
      <div id="cta-ch" style="display:flex;flex-direction:column;align-items:center;margin-top:10px">
        <div class="chev" id="ch1"></div><div class="chev" id="ch2" style="margin-top:-30px"></div>
      </div>
    </div>
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      function entra(sel, t, from) {{
        tl.fromTo(sel, Object.assign({{ opacity: 0, scale: 0.4 }}, from || {{}}), {{ opacity: 1, scale: 1, x: 0, y: 0, rotation: 0, duration: 0.38, ease: "back.out(2.4)" }}, t);
      }}
      function sai(sel, t) {{ tl.to(sel, {{ opacity: 0, scale: 0.7, duration: 0.18, ease: "power2.in" }}, t - 0.18); }}
      // 3 em 1
      entra("#tr-1", {t_nariz - 0.1:.2f}, {{ x: -80 }}); entra("#tr-2", {t_cabelo - 0.1:.2f}, {{ x: -80 }}); entra("#tr-3", {t_dif - 0.1:.2f}, {{ x: -80 }});
      sai(["#tr-1", "#tr-2", "#tr-3"], {TRES1:.2f});
      // à prova d'água
      entra("#ag-in", {AGUA0:.2f}, {{ y: -40 }});
      tl.fromTo("#ag-in", {{ boxShadow: "0 0 0 0 rgba(30,136,229,.75)" }}, {{ boxShadow: "0 0 0 36px rgba(30,136,229,0)", duration: 0.8, ease: "power2.out" }}, {AGUA0 + 0.3:.2f});
      sai("#ag-in", {AGUA1:.2f});
      // cerâmica
      entra("#ce-in", {CER0:.2f}, {{ y: -40 }}); entra("#ce-sub", {find("evita") - 0.1:.2f}, {{ y: 20 }});
      sai(["#ce-in", "#ce-sub"], {CER1:.2f});
      // sem cortes / irritação / pelos encravados: aparece e é riscado na fala
      [["#na-1", "#na-r1", {t_corta - 0.1:.2f}], ["#na-2", "#na-r2", {t_irrita - 0.1:.2f}], ["#na-3", "#na-r3", {t_pelos - 0.1:.2f}]].forEach(function (r) {{
        entra(r[0], r[2], {{ x: 80 }});
        tl.fromTo(r[1], {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.22, ease: "power3.out" }}, r[2] + 0.4);
      }});
      sai(["#na-1", "#na-2", "#na-3"], {NAO1:.2f});
      // kit completo: cada item entra quando é falado
      entra("#kit-tit", {KIT0:.2f}, {{ y: -30 }});
      [["#ck-1", "#v-1", {t_cabecas - 0.1:.2f}], ["#ck-2", "#v-2", {find("níveis") - 0.1:.2f}], ["#ck-3", "#v-3", {find("carregar") - 0.1:.2f}], ["#ck-4", "#v-4", {find("limpeza") - 0.1:.2f}]].forEach(function (r) {{
        entra(r[0], r[2], {{ x: -80 }});
        tl.fromTo(r[1], {{ scale: 0, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.25, ease: "back.out(3)" }}, r[2] + 0.25);
      }});
      sai(["#kit-tit", "#ck-1", "#ck-2", "#ck-3", "#ck-4"], {KIT1:.2f});
      // preço
      entra("#pr-de", {PRE0:.2f}, {{ y: -30 }});
      tl.set("#pr-agora", {{ opacity: 0 }}, {PRE0:.2f});
      tl.fromTo("#pr-risco", {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.25, ease: "power3.out" }}, {t_baratos - 0.35:.2f});
      tl.to("#pr-de", {{ scale: 0.72, opacity: 0.85, duration: 0.3, ease: "power2.out" }}, {t_baratos - 0.1:.2f});
      tl.fromTo("#pr-agora", {{ opacity: 0, scale: 0.3, rotation: -6 }}, {{ opacity: 1, scale: 1, rotation: -3, duration: 0.42, ease: "back.out(2.8)" }}, {t_baratos - 0.05:.2f});
      sai(["#pr-de", "#pr-agora"], {PRE1:.2f});
      // CTA carrinho (até o fim)
      entra("#cta-pill", {CTA0:.2f}, {{ y: 40 }});
      tl.fromTo("#cta-pill", {{ scale: 1 }}, {{ scale: 1.07, duration: 0.32, ease: "sine.inOut", yoyo: true, repeat: {max(1, int((DUR - CTA0 - 0.5) / 0.32) - 1)} }}, {CTA0 + 0.45:.2f});
      tl.fromTo(["#ch1", "#ch2"], {{ y: -10, opacity: 0.35 }}, {{ y: 14, opacity: 1, duration: 0.4, ease: "sine.inOut", stagger: 0.12, yoyo: true, repeat: {max(1, int((DUR - CTA0) / 0.4) - 2)} }}, {CTA0 + 0.3:.2f});
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
SFX = [
    ("impact-bass-1", HEAD_T + 0.58),
    ("pop", t_nariz + 0.05), ("click-soft", t_cabelo + 0.05), ("pop", t_dif + 0.05),
    ("whoosh-short", AGUA0 + 0.1),
    ("pop", CER0 + 0.12),
    ("click-soft", t_corta + 0.35), ("click-soft", t_irrita + 0.35), ("click-soft", t_pelos + 0.35),
    ("whoosh", KIT0 + 0.1), ("click-soft", t_cabecas + 0.2), ("click-soft", find("níveis") + 0.2),
    ("click-soft", find("carregar") + 0.2), ("click-soft", find("limpeza") + 0.2),
    ("pop", PRE0 + 0.12), ("whoosh-short", t_baratos - 0.3), ("ping", t_baratos + 0.05),
    ("notification", CTA0 + 0.15),
    ("click", t_corre),
]


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
      <div id="headline-slam" data-composition-id="headline-slam" data-composition-src="compositions/components/headline-slam.html"
        data-start="{HEAD_T}" data-duration="3.4" data-track-index="2" data-track-kind="graphics"
        data-variable-values='{{"text":"PRESENTE PRO HOMEM","accent_word_index":0,"accent":"green","shadow":true}}'
        style="position:absolute;left:40px;top:190px;width:1000px;height:250px;z-index:5;--fg:#fff;--brand:#FFE500;--font-display:Montserrat"></div>
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
print({k: round(v, 2) for k, v in dict(nariz=t_nariz, agua=t_agua, ceram=t_ceram, corta=t_corta, kit0=KIT0, r100=t_100, baratos=t_baratos, cta=CTA0).items()})
