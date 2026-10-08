# LUMIA — o intérprete de IA para filmes

> Não queremos apenas traduzir o que é dito. Queremos ajudar todos a viver a história.

MVP funcional de uma plataforma de streaming acessível: o usuário escolhe um filme,
clica **🤟 Assistir com Libras**, o filme começa e um intérprete 3D aparece no canto
inferior direito, sincronizado com o vídeo, considerando falante, emoção, sons e contexto.

```bash
cd lumia
npm install
npm run dev        # http://localhost:5173
npm test           # 27 testes (WebVTT, motor de Libras, sincronia, layout, pipeline, rig GLB)
npm run build      # typecheck + build de produção
npm run media      # (opcional) regenera vídeos, áudios e pôsteres — requer python3, numpy, pillow, ffmpeg
```

## Roteiro de demonstração (2 minutos)

1. **Home** → *Assistir com Libras* em "A Ligação".
2. O painel **IA de interpretação** mostra as etapas (cena → diálogo → personagens → emoção → sons → contexto → Libras → validação → sincronização).
3. O intérprete aparece no canto inferior direito. Em 0:10 a porta bate (🔊 + sinal), em 0:12 o telefone toca, em 0:19 a tela "NÚMERO DESCONHECIDO" é interpretada — e o intérprete **muda de canto sozinho** para não cobrir a mão que pega o telefone.
4. 0:25 — Daniel fala: o avatar **incorpora o personagem** (gira o tronco), soletra M-A-R-I-N-A, sinaliza com urgência. Legenda com nome do falante e "🎭 Daniel · urgente".
5. 0:31 — pergunta QU (sobrancelhas franzidas), 0:34 — tópico + negação (balanço de cabeça), 0:45 — sussurro (sinalização contida, medo).
6. Pause, volte, avance, mude a velocidade: o avatar acompanha (a pose é função pura de `video.currentTime`).
7. Teste tamanho/posição (⚙), arraste o intérprete, modo cinema 🎬, Libras imersivo, tela cheia.
8. Abaixo do player: **transcrição sincronizada**, **análise da cena** (formato SCENE) e **representação em Libras** com status e confiança.
9. **/estudio**: aprove, corrija glosas e publique trechos — o player muda na hora. **/como-funciona**: laboratório que interpreta qualquer frase (e ao vivo pelo microfone no Chrome/Edge).

## O que é real e o que é simulado

| Parte | Estado | Onde |
|---|---|---|
| Player HTML5, controles, qualidade, velocidade, legendas, tela cheia, gestos | **Real** | `components/VideoPlayer.tsx`, `PlayerControls.tsx` |
| Transcrição sincronizada WebVTT com `<v Falante>` | **Real** | `services/videoService.ts`, `public/media/*/*.vtt` |
| Identificação de falante, emoção, contexto | **Real (regras transparentes)** | `ai/speakerEngine.ts`, `emotionEngine.ts`, `contextEngine.ts` |
| Análise multimodal do vídeo (cenas, eventos visuais, rostos) | **Simulada** — escrita à mão a partir do roteiro | `data/demoSceneAnalysis.ts` → `ai/multimodalAnalyzer.ts` |
| Tradução português → Libras do filme | **Simulada** — plano de glosas escrito à mão | `data/demoInterpretation.ts` → `ai/librasEngine.ts` |
| Tradução no laboratório / ao vivo | **Real, por regras** (não por IA) | `ai/librasEngine.ts#ruleBasedGloss` |
| Reconhecimento de fala ao vivo | **Real** via Web Speech API do navegador | `ai/liveInterpretation.ts` |
| Controle de qualidade + validação humana + status | **Real** (salvo no navegador) | `ai/qualityEngine.ts`, `/estudio` |
| Animação (IK, configurações de mão, rosto ARKit, incorporação) | **Real** | `avatar/*` |
| Léxico de sinais | **Aproximações não validadas** | `avatar/signEngine.ts` |
| Avatar | **Avatar de referência procedural**; rig para GLB realista pronto | `avatar/rig/`, `public/models/README.md` |
| Login, perfil, listas | **Mock local** (localStorage) | `services/authService.ts` |
| Catálogo | Local; contrato da API documentado | `services/catalogService.ts` |

Todo ponto que depende de IA ainda inexistente está marcado no código com
`TODO: FUTURE AI INTEGRATION`, explicando o que conectar.

## Limitações conhecidas (sem esconder)

- **O avatar não é fotorrealista.** Um humano realista exige um asset profissional
  (modelagem/escaneamento + rig facial + mãos). A arquitetura aceita
  `public/models/avatar.glb` — veja `public/models/README.md`. O rig GLB foi testado
  com um esqueleto sintético, não com um modelo real.
- **Os sinais são aproximações** escritas para demonstrar a arquitetura. Não foram
  validados por intérpretes nem por pessoas surdas. Por isso toda interpretação nasce
  com status *Revisão necessária*. Antes de qualquer uso público, é indispensável
  trabalhar com a comunidade surda e intérpretes certificados — e, para naturalidade,
  com motion capture.
- **Desempenho medido só em ambiente sem GPU** (WebGL por software): o JS do avatar
  custa ~1 ms/quadro; a renderização é limitada a 30 fps e para quando o intérprete
  está oculto. Não foi medido em celulares reais.
- As vozes do curta são prosódia sintetizada **sem palavras** — o diálogo está nas legendas.
- Navegadores sem H.264 recebem WebM (VP9/Opus) automaticamente.

## Mídia

Todo vídeo, som e pôster foi **gerado por código** (`scripts/generate_media.py`):
nenhum filme comercial, nenhum ator real. Exceto os dois curtas originais, os títulos
do catálogo são fictícios e aparecem como "em licenciamento".

## Estrutura

```
src/
  ai/          multimodalAnalyzer, speechEngine, speakerEngine, emotionEngine,
               contextEngine, librasEngine, qualityEngine, interpretationPipeline,
               liveInterpretation
  avatar/      animationEngine, expressionEngine, signEngine, timelineEngine,
               rig/ (proceduralAvatar, glbRig, IK)
  components/  Navbar, Hero, MovieCard, MovieGrid, VideoPlayer, PlayerControls,
               AvatarViewer, AvatarWindow, AvatarControls, Transcript,
               AccessibilityPanel, SceneInsight, CaptionOverlay, PipelineStatus
  data/        movies, demoTranscript, demoInterpretation, demoSceneAnalysis
  services/    catalogService (Content Catalog API), videoService,
               accessibilityService, authService, validationService
  business/    plans (FREE · PREMIUM · FAMILY · PARTNER · ENTERPRISE)
  pages/       Home, Browse, Categories, MyList, Search, Title, Watch,
               HowItWorks, Accessibility, Profile, Login, Studio
```

Línguas de sinais usam códigos distintos (`pt-BR-LIBRAS`, `en-US-ASL`, `en-GB-BSL`…):
nunca são tratadas como a mesma língua.

Deploy: `vercel.json` incluído (rewrite de SPA). Defina o diretório raiz do projeto como `lumia/`.
