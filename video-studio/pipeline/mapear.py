#!/usr/bin/env python3
"""Passo 1: mapa do vídeo bruto para decidir os cortes.

Gera em DIR: in.mp4 (cópia), mapa.jpg (frames com horário), palavras_fonte.json e mapa.txt
(fala com o tempo de cada pausa > 0,45 s e lista de silêncios). Leia mapa.txt + mapa.jpg e
escolha as tomadas.

Uso: mapear.py VIDEO DIR
"""
import json, os, re, shutil, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palavras import transcrever  # noqa: E402


def main():
    video, d = sys.argv[1], sys.argv[2]
    os.makedirs(d, exist_ok=True)
    src = os.path.join(d, "in.mp4")
    if os.path.abspath(video) != os.path.abspath(src):
        shutil.copy(video, src)
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height",
                           "-of", "json", src], capture_output=True, text=True).stdout
    info = json.loads(info)
    dur = float(info["format"]["duration"])
    wh = [(s.get("width"), s.get("height")) for s in info["streams"] if s.get("width")]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf",
                    f"fps=28/{dur},scale=150:-1,drawtext=text='%{{pts\\:hms}}':x=2:y=2:fontsize=12:"
                    "fontcolor=yellow:box=1:boxcolor=black,tile=14x2", "-frames:v", "1",
                    os.path.join(d, "mapa.jpg")], check=True)

    words = transcrever(src)
    json.dump(words, open(os.path.join(d, "palavras_fonte.json"), "w"), ensure_ascii=False, indent=0)

    sil = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "silencedetect=noise=-33dB:d=0.3",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    st = re.findall(r"silence_start: ([\d.]+)", sil)
    en = re.findall(r"silence_end: ([\d.]+)", sil)

    linhas = [f"VÍDEO {dur:.1f}s {wh}", "", "FALA (palavra[início-fim]; [Ns] = pausa antes):"]
    cur, prev = [], None
    for w in words:
        gap = w["start"] - prev if prev is not None else w["start"]
        if gap > 0.45 and cur:
            linhas.append(" ".join(cur))
            cur = []
        if gap > 0.45:
            cur.append(f"[{gap:.1f}s]")
        cur.append(f'{w["text"]}[{w["start"]:.2f}-{w["end"]:.2f}]')
        prev = w["end"]
    if cur:
        linhas.append(" ".join(cur))
    linhas += ["", "SILÊNCIOS (-33 dB, > 0,3 s): " + " ".join(f"{float(a):.2f}-{float(b):.2f}" for a, b in zip(st, en))]
    open(os.path.join(d, "mapa.txt"), "w").write("\n".join(linhas) + "\n")
    print("\n".join(linhas))


if __name__ == "__main__":
    main()
