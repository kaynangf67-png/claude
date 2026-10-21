# Setup de edição de vídeo (Windows)

Script que instala, via `winget`, o kit completo para editar vídeo de ponta a ponta.

| Etapa | Ferramenta |
|---|---|
| Captura (tela/câmera) | OBS Studio |
| Edição, cor, áudio, exportação | DaVinci Resolve (padrão), Kdenlive ou Shotcut |
| Limpeza de áudio | Audacity |
| Conversão / compressão | HandBrake, FFmpeg |
| Reprodução | VLC |
| Extras (`-Extras`) | GIMP (thumbnail), yt-dlp, MKVToolNix |

## Como rodar

1. Baixe `instalar.ps1`.
2. Abra o **PowerShell como Administrador** na pasta do arquivo.
3. Rode:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\instalar.ps1                     # DaVinci Resolve
.\instalar.ps1 -Editor Kdenlive    # PC sem GPU dedicada / pouca RAM
.\instalar.ps1 -Extras             # + GIMP, yt-dlp, MKVToolNix
```

Se algum pacote não estiver no winget ou falhar, o script abre a página oficial para instalação manual.

## Qual editor escolher

- **DaVinci Resolve**: o melhor gratuito, mas pesado. Precisa de GPU dedicada
  (idealmente 4 GB+ de VRAM) e 16 GB de RAM. Em notebook com vídeo integrado
  vai travar.
- **Kdenlive**: leve e completo; boa escolha para PC modesto.
- **Shotcut**: mais simples, roda em quase tudo.
