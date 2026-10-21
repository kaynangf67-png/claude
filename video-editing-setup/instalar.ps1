<#
  Instala as ferramentas para editar vídeo de ponta a ponta no Windows 10/11 via winget.

  Uso (PowerShell como Administrador):
    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\instalar.ps1                    # editor padrão: DaVinci Resolve
    .\instalar.ps1 -Editor Kdenlive   # PC fraco / sem GPU dedicada
    .\instalar.ps1 -Editor Shotcut
    .\instalar.ps1 -Extras            # também instala GIMP, yt-dlp e MKVToolNix
#>
param(
    [ValidateSet('DaVinci', 'Kdenlive', 'Shotcut')]
    [string]$Editor = 'DaVinci',
    [switch]$Extras
)

$ErrorActionPreference = 'Continue'

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'winget não encontrado. Instale/atualize o "App Installer" pela Microsoft Store e rode de novo.' -ForegroundColor Red
    Start-Process 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
    exit 1
}

# Id do winget => página oficial (usada se o pacote não existir/falhar no winget)
$editores = @{
    DaVinci  = @{ Id = 'Blackmagic.DaVinciResolve'; Nome = 'DaVinci Resolve (editor)'; Url = 'https://www.blackmagicdesign.com/products/davinciresolve' }
    Kdenlive = @{ Id = 'KDE.Kdenlive';              Nome = 'Kdenlive (editor)';        Url = 'https://kdenlive.org/download/' }
    Shotcut  = @{ Id = 'Meltytech.Shotcut';         Nome = 'Shotcut (editor)';         Url = 'https://shotcut.org/download/' }
}

$pacotes = @(
    $editores[$Editor]
    @{ Id = 'OBSProject.OBSStudio'; Nome = 'OBS Studio (gravar tela/câmera)';      Url = 'https://obsproject.com/download' }
    @{ Id = 'Audacity.Audacity';    Nome = 'Audacity (limpar/editar áudio)';       Url = 'https://www.audacityteam.org/download/' }
    @{ Id = 'HandBrake.HandBrake';  Nome = 'HandBrake (converter/comprimir)';       Url = 'https://handbrake.fr/downloads.php' }
    @{ Id = 'Gyan.FFmpeg';          Nome = 'FFmpeg (conversão por linha de comando)'; Url = 'https://www.gyan.dev/ffmpeg/builds/' }
    @{ Id = 'VideoLAN.VLC';         Nome = 'VLC (player que abre qualquer formato)'; Url = 'https://www.videolan.org/vlc/' }
)

if ($Extras) {
    $pacotes += @(
        @{ Id = 'GIMP.GIMP.3';             Nome = 'GIMP (thumbnails/imagens)';   Url = 'https://www.gimp.org/downloads/' }
        @{ Id = 'yt-dlp.yt-dlp';           Nome = 'yt-dlp (baixar referências)'; Url = 'https://github.com/yt-dlp/yt-dlp/releases' }
        @{ Id = 'MoritzBunkus.MKVToolNix'; Nome = 'MKVToolNix (faixas/legendas)'; Url = 'https://mkvtoolnix.download/downloads.html' }
    )
}

$falhas = @()
foreach ($p in $pacotes) {
    Write-Host "`n==> $($p.Nome)  [$($p.Id)]" -ForegroundColor Cyan

    # Confere se o Id existe antes de tentar instalar
    winget show --id $p.Id --exact --source winget --accept-source-agreements *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    Pacote não encontrado no winget." -ForegroundColor Yellow
        $falhas += $p
        continue
    }

    winget install --id $p.Id --exact --source winget --silent `
        --accept-package-agreements --accept-source-agreements
    # -1978335189 = já instalado e sem atualização disponível
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        Write-Host "    Falhou (código $LASTEXITCODE)." -ForegroundColor Yellow
        $falhas += $p
    }
}

Write-Host "`n================ RESUMO ================" -ForegroundColor Green
if ($falhas.Count -eq 0) {
    Write-Host 'Tudo instalado. Reinicie o PC (drivers/codecs e o PATH do FFmpeg só valem depois).'
} else {
    Write-Host 'Instale manualmente (as páginas oficiais vão abrir):' -ForegroundColor Yellow
    foreach ($f in $falhas) {
        Write-Host " - $($f.Nome): $($f.Url)"
        Start-Process $f.Url
    }
}
Write-Host "`nNão esqueça: atualize o driver da placa de vídeo (NVIDIA/AMD/Intel) pelo site do fabricante." -ForegroundColor Magenta
