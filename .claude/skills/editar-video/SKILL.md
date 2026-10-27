---
name: editar-video
description: Edita vídeos verticais de venda/review (TikTok, TikTok Shop, Reels, Mercado Livre) de ponta a ponta com o kit em video-studio/. Use sempre que o usuário enviar um vídeo (.mp4/.mov, normalmente em /root/.claude/uploads/) e pedir para editar, cortar, cortar respiros/pausas, legendar ou deixar pronto para postar.
---

# Editar vídeo (kit `video-studio/`)

O usuário grava vídeos de produto no celular (muitas vezes enviados pelo WhatsApp) e posta no TikTok / TikTok Shop / Mercado Livre. Fale em português, direto, e aponte os pontos fracos (ver "Seja crítico").

## 0. Ambiente

O container é apagado entre sessões. Antes de tudo:

```bash
bash video-studio/setup.sh        # idempotente; 1ª vez ~5 min (modelos ~1,2 GB)
```

Ferramentas: `video-studio/pipeline/` (mapear, montar, projeto) e `video-studio/template/` (projeto HyperFrames gerado por `edicao.json`). Trabalhe numa pasta do scratchpad, uma por vídeo (`$SCRATCH/<nome>/`).

## 1. Mapear

```bash
python3 video-studio/pipeline/mapear.py "<upload.mp4>" "$SCRATCH/<nome>"
```

Leia `mapa.txt` (fala com tempo de cada palavra e pausas) e **olhe `mapa.jpg`** (Read). Identifique:
- silêncio no começo (corte sempre: os primeiros 1–2 s decidem o TikTok);
- trechos com a pessoa fora do quadro / câmera apontando para outra coisa;
- **regravações**: frases repetidas, "de novo", palavras erradas ("lâmina de selana… ele tem uma…"). Fique com a **última tomada completa** de cada frase;
- palavras duvidosas: confira com o Whisper (2ª opinião) recortando 1–3 s do trecho antes de corrigir legenda.

Se a plataforma (TikTok Shop × Mercado Livre × outra) ou o produto não estiverem claros, pergunte — muda o CTA.

## 2. Montar

Escreva `$SCRATCH/<nome>/tomadas.json` — `[[início, fim, "comentário"], ...]` em segundos da fonte, na ordem final. Use as bordas das palavras com ~0,06 s de folga. Depois:

```bash
python3 video-studio/pipeline/montar.py "$SCRATCH/<nome>" --vel 1.15
```

Ele corta pausas > 0,3 s, acelera a fala 1,15x (tom mantido), alterna zoom a cada corte, normaliza a voz e **re-transcreve o resultado**. Leia a FALA FINAL impressa e compare com o mapa: **nenhuma palavra pode ter sumido**. Se sumiu, alargue a tomada naquele ponto e rode de novo. Se a palavra é falada tão baixo que o detector a trata como pausa (ex.: "antes que acabe a sua"), separe esse pedaço numa tomada com 4º campo `true` (`[66.36, 67.05, "a sua", true]`) — ela entra inteira, sem corte de pausa.

**Vários vídeos numa edição** (ex.: "recrie formatos diferentes"): junte as fontes com ffmpeg `concat` (normalize fps/escala/áudio antes), crie `in.mp4` apontando para o resultado e some a duração dos vídeos anteriores aos tempos das tomadas. Formatos diferentes = **ângulos de venda diferentes** (problema → solução, economia, kit completo, prova de uso), não só outra edição da mesma fala.

**Narração gravada à parte + cenas sem fala** (ex.: lousa de LED): trate cada áudio (corte de pausas + 1,15x, como no `montar.py`), escreva `DIR/plano.json` e rode `python3 video-studio/pipeline/narrado.py DIR`. Ele junta as narrações, re-transcreve, troca de cena quando uma palavra-chave é falada (corte a cada ≤1,8 s), apaga texto queimado da fonte com inpainting (`mascaras`) e grava `base.mp4`/`voz.wav`/`palavras.json`; depois siga com `projeto.sh`. Exemplo em `video-studio/projetos/lousa-ml-g1-c1-a1/plano.json`. Confira o brilho das faixas escolhidas: transição com tela preta estraga o corte.

**Duelo / tela dividida** (dois personagens, como o viral dos fones): monte a fala com `montar.py` (fontes concatenadas na ordem do roteiro), escreva `DIR/duelo.json` (falante por tomada, lado de cada um, trechos de reação com o personagem calado — sem ele pegando o celular) e rode `python3 video-studio/pipeline/duelo.py DIR` antes do `projeto.sh`. `"K!"` = tomada em tela cheia (CTA para a câmera). Nomes no topo: `"rotulos": {"esq", "dir", "ate"}` no `edicao.json`. Exemplo: `video-studio/projetos/kemei-duelo-mercadolivre-tela-dividida/`. Confira se o rosto não encosta na borda da metade.

**Mercado Livre Clips**: vertical, até ~60 s, precisa mostrar o produto em uso, um vídeo diferente por anúncio, sem contato do vendedor. Não mostre preço de concorrente (outro marketplace) na tela. **A fala precisa citar "Mercado Livre" nos primeiros segundos** (pedido do usuário): abra com a frase dele que menciona a plataforma, mesmo que o gancho de problema venha logo depois.

## 3. Projeto visual

Crie `$SCRATCH/<nome>/edicao.json`:

```json
{
  "correcoes": {"aparentes.": "aparelhos.", "pent": "pente"},
  "pares": {"a prova": "à prova", "em cravado.": "encravados."},
  "destaque": ["frete", "grátis", "cerâmica"],
  "selos": [
    {"tipo": "canto", "icone": "gota", "linhas": ["RESISTENTE", "À ÁGUA"], "de": "resistente", "ate": "água", "depois": 2.2},
    {"tipo": "centro", "texto": "FRETE GRÁTIS", "cor": "#00B84A", "de": "frete", "ate": "link", "depois": -0.4}
  ],
  "cta": {"texto": "TOQUE NO CARRINHO", "de": "link"}
}
```

- `correcoes`: palavra → palavra (erros do reconhecedor). `pares`: "duas palavras ouvidas" → uma ou duas corrigidas.
- `de`/`ate`: palavra falada que liga/desliga o selo (`"frete"` ou `["dinheiro", 58]` = 1ª ocorrência após 58 s). `depois`: segundos após `ate` (negativo = antes). Ou `duracao`.
- `icone`: `gota`, `check` ou vazio. "100 reais" vira "R$100" sozinho.

```bash
bash video-studio/pipeline/projeto.sh gerar "$SCRATCH/<nome>" "0.5,<t_selo1>,<t_selo2>,<t_cta>"
```

Olhe `hf/snaps/contact-sheet.jpg`. Lint precisa dar 0 erros. Ajuste `edicao.json` e gere de novo até ficar certo.

## 4. Render e entrega

```bash
bash video-studio/pipeline/projeto.sh render "$SCRATCH/<nome>" <nome-do-video>
```

Saída em `video-studio/saida/<nome>.mp4` (fora do git) e projeto em `video-studio/projetos/<nome>/`. Extraia 1–2 frames do arquivo final para conferir, mande com `SendUserFile` e faça commit do projeto (não do vídeo).

Pacote para CapCut, se pedido: vídeo cortado sem legenda (`base.mp4` + `voz.wav` muxados) + `.srt` gerado de `palavras.json` com as mesmas correções.

## Estilo (decidido com o usuário — não mude sem ele pedir)

Referência que ele modela: vídeos tipo @dosufinds — produto colado na câmera, fala corrida, **edição quase invisível**.

- **Sem emojis.** Nada de emoji na tela nem Lottie de emoji.
- **Sem efeitos sonoros e sem título de abertura** por padrão.
- **Legenda pequena, uma linha** (62 px, até ~26 letras/5 palavras), em y≈1225–1325 px; palavra falada acende em amarelo, valores em R$ em verde.
- No máximo **2–3 selos** no vídeo inteiro (ex.: "RESISTENTE À ÁGUA" no canto, "FRETE GRÁTIS") + **CTA final**.
- CTA por plataforma: TikTok Shop → "TOQUE NO CARRINHO"; Mercado Livre/afiliado → "LINK NA BIO" ou o que ele falar (pergunte onde estará o link: link externo não é clicável dentro de vídeo do TikTok).
- Ordem das falas: a original, salvo motivo forte (explique antes de inverter).
- 1080x1920, 30 fps, -14 LUFS. Nada de texto fora da faixa 168–1330 px (UI do TikTok).

## Regras técnicas aprendidas (não repita estes erros)

- Pausa mínima de corte = **0,3 s**. Com 0,2 s o detector come palavras faladas baixo ("por", "corta", "antes").
- Sempre **re-transcreva o áudio final** e confira palavra por palavra; tempos do reconhecedor no começo de cada tomada costumam vir 0,3–0,5 s adiantados.
- Use o Parakeet para tempo por palavra; Whisper só para segunda opinião (não dá tempo por palavra aqui).
- Não "corrija" a fala inventando palavras: se dois modelos ouvem igual, a legenda segue o que foi dito (no máximo concordância, ex. "preço da barba").
- `os.cpu_count()` mente no container; use `len(os.sched_getaffinity(0))`.
- Hugging Face, YouTube, bancos de imagem/música e Google Fonts direto são bloqueados; GitHub releases, npm, PyPI e fonts.gstatic funcionam.

## Seja crítico (o usuário pediu)

Depois de entregar, diga em poucas linhas o que limita o resultado e como gravar melhor: produto perto da lente nos primeiros 3 s, não sair do quadro, falar corrido (se errar, recomeçar a frase), mandar o arquivo original do celular (o do WhatsApp chega em ~478x850), e riscos de política da plataforma (promessas absolutas como "não corta a pele", "promoção" sem promoção real, preço de referência não verificado, menção a depilação íntima).
