# ZapSticker AI

> **Sua foto. Sua voz. Sua figurinha.**

Plataforma web (mobile first) que transforma **uma foto + um áudio** em uma figurinha com som pronta para compartilhar no WhatsApp.

**Fluxo:** FOTO → ÁUDIO → GERAR FIGURINHA → COMPARTILHAR NO WHATSAPP

## Rodando

```bash
cd zapsticker-ai
npm install      # também copia os binários WASM para public/vendor
npm run dev      # http://localhost:3000
npm test         # testes unitários (WAV, limites, pacote .wastickers)
npm run build && npm start
```

Para publicar na Vercel, crie o projeto com **Root Directory = `zapsticker-ai`** (framework Next.js).

## O que o app gera (e por quê)

O WhatsApp **não toca som em figurinhas**: figurinhas nativas são imagens WebP 512×512 (estáticas até 100 KB, animadas até 500 KB) e nenhuma delas carrega áudio. Por isso o ZapSticker não finge uma integração que não existe e entrega quatro saídas reais:

| Saída | Formato | Como chega no WhatsApp |
|---|---|---|
| **Figurinha falante** | Vídeo 512×512 com animação sincronizada à voz + áudio. MP4 H.264 no Chrome/Safari, WebM nos navegadores sem H.264 (o app avisa) | Menu de compartilhar do celular → WhatsApp (toca com som) |
| **Figurinha oficial** | WebP 512×512, ≤ 100 KB, margem e contorno branco | Compartilhar/baixar. Em versões recentes do WhatsApp: *Figurinhas → Criar figurinha* com a imagem |
| **Foto + áudio juntos** | PNG + WAV na mesma ação de compartilhar | Uma mensagem com a imagem e o áudio |
| **Pacote de figurinhas** | `.wastickers` (zip com `title.txt`, `author.txt`, `tray.png` 96×96, WebPs e `contents.json` no formato do [app de exemplo oficial do WhatsApp](https://github.com/WhatsApp/stickers)) | Importado por apps de pacotes no Android, ou usado por um app companheiro próprio |

O compartilhamento usa a **Web Share API Level 2** (`navigator.share({ files })`), que no Android e no iOS abre o menu nativo onde o WhatsApp aparece. Onde ela não existe (computador, alguns navegadores), os arquivos são baixados e o app explica como enviar pelo WhatsApp Web/Desktop. Também há "Copiar figurinha" (área de transferência) e "Abrir WhatsApp".

## Funcionalidades

- **Etapa 1 — Foto:** galeria (JPG/PNG/WEBP até 15 MB), câmera (nativa no celular, `getUserMedia` no computador), arrastar e soltar, recorte com arrastar/pinça/roda do mouse, zoom, girar, "inteira"/"preencher", **remoção de fundo** (IA MediaPipe Selfie Segmenter para pessoas, ou algoritmo de fundo liso) e **contorno branco** com espessura ajustável. A prévia usa o mesmo código que gera o arquivo final.
- **Etapa 2 — Áudio:** upload (MP3, WAV, M4A, AAC, OGG, OPUS, WEBM, FLAC até 20 MB / 10 min), gravação pelo microfone com medidor de nível (até 30 s), player, forma de onda com **corte** por alças (trecho de até 30 s), **volume** de 0 a 200 %, substituir/regravar/excluir, duração.
- **Etapa 3 — Gerar:** 6 animações (pulsar, pular, balançar, tremer, flutuar, parado) que reagem ao volume da voz, selo de áudio com equalizador e anel de progresso, 4 fundos para o vídeo, prévia com **testar reprodução**, barra de progresso real, **gerar novamente**.
- **Minhas figurinhas:** grade com reprodução, editar, excluir (com confirmação), baixar cada formato, compartilhar de novo, seleção para **pacote .wastickers** e aba **Histórico** (criada, editada, compartilhada, baixada, excluída, pacote exportado).
- **Salvamento automático** do rascunho (IndexedDB), restaurado ao voltar ao editor.
- Tema escuro (padrão) e claro, interface em português, navegação inferior estilo iOS no celular, áreas seguras do iPhone, PWA (manifesto).

## Arquitetura

```
app/                      rotas (App Router)
  page.tsx                tela inicial + demonstração interativa
  criar/                  editor em 3 etapas
  minhas-figurinhas/      galeria + histórico
  api/health, api/stickers  backend (base para sincronização futura)
components/
  editor/                 Editor, PhotoStep, CropEditor, CameraCapture, AudioStep, AudioRecorder, Waveform, GenerateStep
  gallery/                Gallery, StickerCard
  ShareSheet, StickerPlayer, StickerDemo, AppShell, ui/ (Button, Sheet, Toast, Slider, Toggle/Chips)
lib/
  image.ts                Canvas API: carregar, recortar, contorno, fundo liso
  segment.ts              remoção de fundo por IA (MediaPipe, roda no aparelho)
  webp.ts                 libwebp em WASM (@jsquash/webp) com limite de 100 KB — funciona no iOS
  audio.ts                Web Audio API: decodificar, cortar, volume, envelope da voz, gravação
  wav.ts                  codificador WAV e picos da forma de onda
  animation.ts            desenho de cada quadro (prévia e vídeo usam o mesmo código)
  video.ts                exportação com canvas.captureStream + MediaRecorder
  generate.ts             pipeline completo
  storage.ts              IndexedDB (figurinhas, rascunho, histórico)
  share.ts / pack.ts      compartilhamento e pacote .wastickers
  server/                 repositório de metadados (interface + implementação em memória)
```

Tudo roda no navegador; nenhum arquivo do usuário é enviado a servidores. Os binários WASM (MediaPipe e libwebp) e o modelo de segmentação são servidos pelo próprio site (`public/vendor`, `public/models`).

### Backend

`GET /api/health` e `GET/POST/DELETE /api/stickers` (metadados, identificados por `x-device-id`). O repositório (`lib/server/stickerRepository.ts`) é uma interface com implementação em memória, pronta para ser trocada por um banco (ex.: Postgres + storage) quando houver contas e sincronização entre aparelhos.

## Limitações conhecidas

- Figurinhas do WhatsApp não têm som; o som vai na "figurinha falante" (vídeo) ou no "foto + áudio".
- Adicionar um pacote direto à aba de figurinhas do WhatsApp exige um app nativo (Android/iOS) — a web não tem essa permissão. O `.wastickers`/`contents.json` gerado já segue o formato do app oficial de exemplo.
- A remoção de fundo por IA é treinada para pessoas; para objetos use "Fundo liso".
- O vídeo é gravado em tempo real (leva a duração do áudio). Navegadores sem H.264 no MediaRecorder (ex.: Firefox) geram WebM.
- As criações ficam no armazenamento do navegador deste aparelho.
