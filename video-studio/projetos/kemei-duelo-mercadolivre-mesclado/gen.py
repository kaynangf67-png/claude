#!/usr/bin/env python3
"""Gera o projeto HyperFrames a partir de palavras.json + edicao.json (estilo limpo, sem emojis).

Pasta do projeto (este arquivo fica nela):
  palavras.json          saída do pipeline/montar.py
  edicao.json            configuração do vídeo (ver ../README.md, seção edicao.json)
  assets/base.mp4, assets/voz.wav
Saídas: index.html, compositions/legendas.html, compositions/overlays.html

Uso: python3 gen.py
"""
import html, json, re, subprocess
from pathlib import Path

P = Path(__file__).resolve().parent
CFG = json.load(open(P / "edicao.json"))
DUR = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                            str(P / "assets/base.mp4")], capture_output=True, text=True).stdout)
DUR = round(DUR - 0.02, 2)

# ---------------- palavras + correções ----------------
CORR = CFG.get("correcoes", {})
PARES = CFG.get("pares", {})
raw = json.load(open(P / "palavras.json"))
words, i = [], 0
while i < len(raw):
    w = dict(raw[i])
    nxt = raw[i + 1] if i + 1 < len(raw) else None
    par = f'{w["text"]} {nxt["text"]}' if nxt else None
    if par in PARES:  # duas palavras ouvidas -> uma ou duas corrigidas
        partes = PARES[par].split(" ", 1)
        w["text"] = partes[0]
        if len(partes) == 1:
            w["end"] = nxt["end"]
            words.append(w)
        else:
            words.append(w)
            n2 = dict(nxt)
            n2["text"] = partes[1]
            words.append(n2)
        i += 2
        continue
    m = re.fullmatch(r"(\d+(?:,\d+)?)([,.?!]?)", w["text"])
    if CFG.get("dinheiro_reais", True) and m and nxt and nxt["text"].lower().startswith("reais"):
        w["text"] = "R$" + m.group(1).replace(",00", "") + re.sub(r"^reais", "", nxt["text"], flags=re.I)
        w["end"] = nxt["end"]
        i += 1
    else:
        w["text"] = CORR.get(w["text"], w["text"])
    words.append(w)
    i += 1


words = [w for w in words if w["text"]]  # correção para "" apaga a palavra (ex.: gaguejada)


def limpa(t):
    return re.sub(r"[^\wÀ-ú$']", "", t).lower()


def quando(ref):
    """Tempo da palavra: "frete" ou ["dinheiro", 58.0] (primeira ocorrência após 58 s)."""
    alvo, depois = (ref, 0.0) if isinstance(ref, str) else (ref[0], float(ref[1]))
    for w in words:
        if w["start"] >= depois and limpa(w["text"]) == alvo.lower():
            return w["start"]
    raise SystemExit(f'palavra "{alvo}" não encontrada em palavras.json (após {depois}s)')


DESTAQUE = {d.lower() for d in CFG.get("destaque", [])}
DINHEIRO = re.compile(r"^R\$\d+")
MAX_CHARS = CFG.get("legenda_max_letras", 22)

# ---------------- legendas: uma linha, até 5 palavras / 22 letras ----------------
groups, cur = [], []
for k, w in enumerate(words):
    cur.append(w)
    nxt = words[k + 1] if k + 1 < len(words) else None
    chars = len(" ".join(x["text"] for x in cur))
    prox = chars + 1 + len(nxt["text"]) if nxt else 0
    pausa = (nxt["start"] - w["end"]) if nxt else 9
    if len(cur) == 5 or prox > MAX_CHARS or re.search(r"[.?!,:]$", w["text"]) or pausa >= 0.15 or not nxt:
        groups.append(cur)
        cur = []


def legendas_html():
    out = []
    for gi, g in enumerate(groups):
        spans = []
        for wi, w in enumerate(g):
            cls = "w" + (" money" if DINHEIRO.match(w["text"]) else (" key" if limpa(w["text"]) in DESTAQUE else ""))
            spans.append(f'<span id="lg-w{gi}-{wi}" class="{cls}" data-t="{w["start"]:.3f}">'
                         f'{html.escape(w["text"].upper())}</span>')
        g0 = max(0.1, g[0]["start"] - 0.05)
        nxt0 = groups[gi + 1][0]["start"] - 0.05 if gi + 1 < len(groups) else DUR
        g1 = min(max(g[-1]["end"] + 0.25, g0 + 0.35), nxt0)
        out.append(f'      <div id="lg-g{gi}" class="grp" data-a="{g0:.3f}" data-b="{g1:.3f}">'
                   f'<div class="line">{"".join(spans)}</div></div>')
    return "\n".join(out)


LEG_TOP = CFG.get("legenda_top", 1225)  # faixa livre do TikTok vai até 1330 px
LEGENDAS = f"""<template>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; }}
    #root .band {{ position: absolute; left: 0; right: 0; top: {LEG_TOP}px; height: 100px; }}
    #root .grp {{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      opacity: 0; overflow: visible; }}
    #root .line {{ display: flex; gap: 0 30px; justify-content: center; align-items: center; width: 100%;
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

# ---------------- selos e CTA ----------------
ICONES = {
    "gota": '<span class="ico" style="background:#1E88E5"><i class="gota"></i></span>',
    "check": '<span class="ico" style="background:#00B84A"><i class="check"></i></span>',
    "": "",
}
el, js = [], []
for n, s in enumerate(CFG.get("selos", [])):
    a = quando(s["de"]) - 0.1
    b = quando(s["ate"]) + s.get("depois", 1.8) if "ate" in s else a + s.get("duracao", 2.5)
    b = min(b, DUR)
    sid = f"selo{n}"
    if s.get("tipo", "centro") == "canto":
        linhas = "".join(f"<b>{html.escape(l)}</b>" for l in s["linhas"])
        el.append(f'    <div id="{sid}" class="clip canto" data-start="{a:.2f}" data-duration="{b - a:.2f}">'
                  f'<div id="{sid}-in" class="canto-in">{ICONES[s.get("icone", "")]}<span style="color:{s.get("cor", "#0D47A1")}">{linhas}</span></div></div>')
        js.append(f'      entra("#{sid}-in", {a:.2f}, {{ y: -20, scale: 0.6 }}); sai("#{sid}-in", {b:.2f});')
    else:
        el.append(f'    <div id="{sid}" class="clip centro" data-start="{a:.2f}" data-duration="{b - a:.2f}">'
                  f'<div id="{sid}-in" class="centro-in" style="background:{s.get("cor", "#00B84A")};color:{s.get("cor_texto", "#fff")}">'
                  f'{html.escape(s["texto"])}</div></div>')
        js.append(f'      entra("#{sid}-in", {a:.2f}, {{ scale: 0.4, rotation: -6 }}, -3); sai("#{sid}-in", {b:.2f});')

cta = CFG.get("cta")
if cta:
    c0 = quando(cta["de"]) - 0.15
    el.append(f'    <div id="ov-cta" class="clip" data-start="{c0:.2f}" data-duration="{DUR - c0:.2f}">'
              f'<div id="cta-pill">{html.escape(cta["texto"])}</div>'
              '<div style="display:flex;flex-direction:column;align-items:center;margin-top:10px">'
              '<div class="chev" id="ch1"></div><div class="chev" id="ch2" style="margin-top:-26px"></div></div></div>')
    js.append(f'''      entra("#cta-pill", {c0:.2f}, {{ y: 30, scale: 0.5 }});
      tl.fromTo("#cta-pill", {{ scale: 1 }}, {{ scale: 1.06, duration: 0.32, ease: "sine.inOut", immediateRender: false, yoyo: true, repeat: {max(1, int((DUR - c0 - 0.5) / 0.32) - 1)} }}, {c0 + 0.45:.2f});
      tl.fromTo(["#ch1", "#ch2"], {{ y: -10, opacity: 0.35 }}, {{ y: 12, opacity: 1, duration: 0.4, ease: "sine.inOut", stagger: 0.12, yoyo: true, repeat: {max(1, int((DUR - c0) / 0.4) - 2)} }}, {c0 + 0.3:.2f});''')

rot = CFG.get("rotulos")  # tela dividida: {"esq": "KEMEI 3 EM 1", "dir": "GILETE", "ate": s}, fixos no topo de cada metade
if rot:
    r_dur = min(float(rot.get("ate", DUR)), DUR)
    for lado, x in (("esq", 0), ("dir", 540)):
        if rot.get(lado):
            el.append(f'    <div id="rot-{lado}" class="clip rot" data-start="0" data-duration="{r_dur:.2f}" style="left:{x}px">{html.escape(rot[lado])}</div>')

OVERLAYS = f"""<template>
  <script src="assets/js/gsap.min.js"></script>
  <style>
    #root {{ position: absolute; inset: 0; pointer-events: none; font-family: Montserrat; }}
    #root .canto {{ position: absolute; right: 44px; top: 190px; }}
    #root .canto-in {{ display: flex; align-items: center; gap: 14px; padding: 12px 22px 12px 14px; border-radius: 22px;
      background: rgba(255,255,255,.95); box-shadow: 0 10px 26px rgba(0,0,0,.30); }}
    #root .canto-in b {{ display: block; font-weight: 900; font-size: 30px; line-height: 1.02; letter-spacing: 0.02em; }}
    #root .ico {{ position: relative; width: 62px; height: 62px; border-radius: 50%; flex: none; }}
    #root .gota {{ position: absolute; left: 19px; top: 14px; width: 24px; height: 24px; background: #fff;
      border-radius: 0 50% 50% 50%; transform: rotate(45deg); }}
    #root .check {{ position: absolute; left: 22px; top: 12px; width: 16px; height: 30px; border-right: 7px solid #fff;
      border-bottom: 7px solid #fff; transform: rotate(45deg); }}
    #root .centro {{ position: absolute; left: 0; right: 0; top: 230px; display: flex; justify-content: center; }}
    #root .centro-in {{ display: inline-block; padding: 16px 38px; border-radius: 22px; font-weight: 900; font-size: 60px;
      letter-spacing: 0.02em; box-shadow: 0 14px 30px rgba(0,0,0,.30); }}
    #root #ov-cta {{ position: absolute; left: 0; right: 0; top: 850px; display: flex; flex-direction: column; align-items: center; gap: 6px; }}
    #root #cta-pill {{ display: inline-block; padding: 18px 42px; border-radius: 999px; background: #FE2C55; color: #fff;
      font-weight: 900; font-size: 52px; letter-spacing: 0.02em; box-shadow: 0 16px 34px rgba(254,44,85,.40); }}
    #root .rot {{ position: absolute; top: 300px; width: 540px; text-align: center; color: #fff; font-weight: 800;
      font-size: 40px; letter-spacing: 0.04em; text-shadow: 0 2px 10px rgba(0,0,0,.65), 0 0 2px rgba(0,0,0,.8); }}
    #root .chev {{ width: 60px; height: 60px; border-right: 14px solid #FE2C55; border-bottom: 14px solid #FE2C55;
      transform: rotate(45deg); border-radius: 6px; }}
  </style>
  <div id="root" data-composition-id="overlays" data-layout-allow-overlap>
{chr(10).join(el)}
  </div>
  <script>
    (function () {{
      var tl = gsap.timeline({{ paused: true }});
      function entra(sel, t, from, rot) {{
        tl.fromTo(sel, Object.assign({{ opacity: 0 }}, from), {{ opacity: 1, scale: 1, x: 0, y: 0, rotation: rot || 0, duration: 0.38, ease: "back.out(2.4)" }}, t);
      }}
      function sai(sel, t) {{ tl.to(sel, {{ opacity: 0, scale: 0.8, duration: 0.2, ease: "power2.in" }}, t - 0.2); }}
{chr(10).join(js)}
      window.__timelines["overlays"] = tl;
    }})();
  </script>
</template>
"""

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

(P / "compositions").mkdir(exist_ok=True)
(P / "compositions/legendas.html").write_text(LEGENDAS)
(P / "compositions/overlays.html").write_text(OVERLAYS)
(P / "index.html").write_text(INDEX)
print(f"dur={DUR}s legendas={len(groups)} selos={len(CFG.get('selos', []))} cta={'sim' if cta else 'não'}")
print("LEGENDA:", " | ".join(" ".join(w["text"] for w in g) for g in groups))
