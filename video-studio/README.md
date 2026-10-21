# Video Studio (edição de vídeo pelo Claude Code)

Kit para editar vídeo de ponta a ponta dentro do Claude Code, sem interface gráfica:
você manda o vídeo e pede a edição em texto; o Claude executa.

## Instalar (a cada sessão nova)

O ambiente na nuvem é apagado ao fim da sessão, então rode:

```bash
bash video-studio/setup.sh
```

Leva alguns minutos na primeira vez (inclui ~560 MB do modelo de transcrição).

## O que vem instalado

| Etapa | Ferramenta |
|---|---|
| Cortar, juntar, acelerar, cor, zoom, crop 9:16, exportar | `ffmpeg` (x264/x265/AV1, vidstab, loudnorm, drawtext) |
| Cortar silêncios / "respiros" automaticamente | `auto-editor` |
| Detectar cortes de cena | `scenedetect` |
| Montagem com timeline em código | `moviepy`, `melt` (motor MLT do Kdenlive/Shotcut) |
| Transcrição e legendas (offline) | `scripts/transcrever.py` (Whisper large-v3-turbo + VAD) |
| Legenda queimada estilo Reels | `scripts/queimar-legenda.sh` |
| Áudio: volume padrão, ruído, efeitos | `ffmpeg-normalize`, `noisereduce`, `sox`, `pydub`, `librosa` |
| Imagem / thumbnail | `imagemagick`, `pillow` |
| Inspeção de arquivos | `ffprobe`, `mediainfo`, `mkvtoolnix` |
| Fontes | Montserrat, Roboto, Open Sans, Noto (com emoji) |

## Exemplos

```bash
# Legenda .srt em português
python3 video-studio/scripts/transcrever.py video.mp4 --lingua pt

# Queimar a legenda no vídeo
video-studio/scripts/queimar-legenda.sh video.mp4 video.srt final.mp4

# Cortar silêncios
auto-editor video.mp4 -o cortado.mp4 --no-open

# Padronizar volume (-14 LUFS, padrão de YouTube/Instagram)
ffmpeg-normalize video.mp4 -t -14 -c:a aac -o normalizado.mp4
```

## Limitações

- **Sem GPU**: tudo roda na CPU (4 núcleos). Exportar 4K ou vídeos longos é lento.
- **Rede restrita**: Hugging Face, YouTube e Google Fonts são bloqueados. O `yt-dlp`
  está instalado, mas não baixa do YouTube daqui.
- **Sem preview em tempo real**: você revisa por frames exportados ou pelo arquivo final.
- Para enviar os vídeos brutos, use o repositório (arquivos grandes: Git LFS) ou outro meio
  que o ambiente consiga acessar.
