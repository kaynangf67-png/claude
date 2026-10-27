#!/usr/bin/env python3
"""Monta vídeo-base com narração gravada à parte por cima de cenas de um vídeo (ex.: lousa de LED).

Lê DIR/plano.json:
  {
    "fonte": "cenas.mp4",                       # vídeo com as cenas (o áudio dele é descartado)
    "mascaras": [[x0, y0, x1, y1], ...],        # texto queimado a apagar (px da fonte), opcional
    "clip_max": 1.8,                            # corte a cada no máximo N s (ritmo)
    "partes": [                                 # uma por narração, na ordem
      {"audio": "gancho.wav",                   # já tratada (sem respiros, 1.15x) ou crua
       "cenas": [[null, [[8.0, 11.9], [42.2, 44.4]]],      # null = começo da parte
                 ["noite", [[42.0, 47.0]]]]}               # palavra = troca de cena quando ela é falada
    ]
  }
Grava em DIR: voz.wav (-14 LUFS), palavras.json, base.mp4 (1080x1920, 30 fps, sem áudio, keyframe a cada 1 s)
e imprime a fala final + a lista de cortes. Depois siga com projeto.sh gerar/render como sempre.

Uso: narrado.py DIR
"""
import json, os, subprocess, sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palavras import transcrever, texto  # noqa: E402
from montar import W, H, FPS, zoom, encaixar  # noqa: E402

GAP = 0.06  # respiro entre narrações


def norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def main():
    D = sys.argv[1]
    P = json.load(open(os.path.join(D, "plano.json")))
    src = os.path.join(D, P["fonte"]) if not os.path.isabs(P["fonte"]) else P["fonte"]
    clip_max = P.get("clip_max", 1.8)

    # voz: junta as partes e normaliza
    lista, inicios, t = [], [], 0.0
    for p in P["partes"]:
        a = p["audio"] if os.path.isabs(p["audio"]) else os.path.join(D, p["audio"])
        d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a],
                                 capture_output=True, text=True).stdout)
        inicios.append(t)
        lista.append((a, d))
        t += d + GAP
    total = t - GAP
    ins = sum([["-i", a] for a, _ in lista], [])
    fc = "".join(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur={GAP}[a{i}];" for i in range(len(lista)))
    fc += "".join(f"[a{i}]" for i in range(len(lista))) + f"concat=n={len(lista)}:v=0:a=1,atrim=0:{total:.3f}[out]"
    raw = os.path.join(D, "voz_raw.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc, "-map", "[out]", "-ar", "48000", "-ac", "1", raw], check=True)
    subprocess.run(["ffmpeg-normalize", raw, "-t", "-14", "-tp", "-1.0", "-ar", "48000",
                    "-o", os.path.join(D, "voz.wav"), "-f", "-q"], check=True)
    os.remove(raw)
    bounds = inicios + [total]
    words = transcrever(os.path.join(D, "voz.wav"), list(zip(bounds, bounds[1:])))
    json.dump(words, open(os.path.join(D, "palavras.json"), "w"), ensure_ascii=False, indent=0)

    # trocas de cena: (tempo final, faixas da fonte)
    trocas = []
    for k, p in enumerate(P["partes"]):
        ini, fim = bounds[k], bounds[k + 1]
        for chave, faixas in p["cenas"]:
            if chave is None:
                trocas.append((ini, faixas))
                continue
            w = next((w for w in words if ini - 0.05 <= w["start"] < fim and norm(w["text"]).startswith(norm(chave))), None)
            if w is None:
                raise SystemExit(f'palavra "{chave}" não encontrada na parte {k + 1}: {texto([x for x in words if ini <= x["start"] < fim])}')
            trocas.append((max(w["start"] - 0.1, ini), faixas))
    trocas.sort(key=lambda x: x[0])

    # clipes: dentro de cada troca, percorre as faixas cortando a cada clip_max s
    clipes = []  # (t_ini, t_fim, src_ini)
    for i, (t0, faixas) in enumerate(trocas):
        t1 = trocas[i + 1][0] if i + 1 < len(trocas) else total
        t, j, pos = t0, 0, {}
        while t < t1 - 1e-3:
            a, b = faixas[j % len(faixas)]
            s = pos.get(j % len(faixas), a)
            if b - s < 0.5:
                s = a
            d = min(clip_max, b - s, t1 - t)
            if t1 - (t + d) < 0.45:  # não deixa sobra curta: estica este clipe
                d = min(t1 - t, b - s) if b - s >= t1 - t else d
            clipes.append((t, t + d, s))
            pos[j % len(faixas)] = s + d
            t += d
            j += 1
    print("CORTES:", " | ".join(f"{a:.1f}s<-fonte {s:.1f}" for a, _, s in clipes), file=sys.stderr)

    # máscara do texto queimado
    cap = cv2.VideoCapture(src)
    sw, sh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    M = np.zeros((sh, sw), np.uint8)
    for x0, y0, x1, y1 in P.get("mascaras", []):
        cv2.rectangle(M, (x0, y0), (x1, y1), 255, -1)
    F = cv2.GaussianBlur(M.astype(np.float32) / 255, (0, 0), 6)[..., None]
    Ms = cv2.resize(M, (sw // 2, sh // 2), interpolation=cv2.INTER_NEAREST)

    def limpa(f):
        if not M.any():
            return f
        ip = cv2.inpaint(cv2.resize(f, (sw // 2, sh // 2)), Ms, 6, cv2.INPAINT_TELEA)
        ip = cv2.GaussianBlur(cv2.resize(ip, (sw, sh), interpolation=cv2.INTER_CUBIC), (0, 0), 5)
        return (f * (1 - F) + ip * F).astype(np.uint8)

    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                            "-g", "30", "-pix_fmt", "yuv420p", os.path.join(D, "base.mp4")], stdin=subprocess.PIPE)
    n_out = int(total * FPS)
    ci, cur_src = -1, None
    for f in range(n_out):
        t = f / FPS
        while ci + 1 < len(clipes) and clipes[ci + 1][0] <= t + 1e-6:
            ci += 1
            cap.set(cv2.CAP_PROP_POS_MSEC, clipes[ci][2] * 1000)
            cur_src = None
        a, b, s = clipes[ci]
        ok, fr = cap.read()
        if ok:
            cur_src = fr
        tin = t - a
        z = (1.0 if ci % 2 == 0 else 1.1) + 0.03 * tin / max(b - a, 0.1)
        enc.stdin.write(zoom(encaixar(limpa(cur_src)), z).tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"\nDURAÇÃO FINAL {total:.1f}s, {len(clipes)} cortes. FALA FINAL (confira):\n{texto(words)}")


if __name__ == "__main__":
    main()
