# Video Studio

Kit para editar vídeos verticais de venda (TikTok, TikTok Shop, Mercado Livre) dentro do Claude Code.

**Como usar:** numa sessão do Claude Code neste repositório, envie o vídeo e diga "edita esse vídeo"
(diga também onde vai postar e o produto). O Claude segue a skill `editar-video`
(`.claude/skills/editar-video/SKILL.md`), que tem o fluxo completo e o estilo combinado.

## Fluxo

| Passo | Comando | O que faz |
|---|---|---|
| 0 | `bash video-studio/setup.sh` | instala tudo (o ambiente é apagado entre sessões) |
| 1 | `pipeline/mapear.py VIDEO DIR` | frames com horário + fala com tempo de cada palavra e pausas |
| 2 | `pipeline/montar.py DIR --vel 1.15` | corta conforme `tomadas.json`, remove pausas > 0,3 s, acelera, re-transcreve para conferir |
| 3 | `pipeline/projeto.sh gerar DIR "t1,t2"` | projeto HyperFrames a partir de `edicao.json` + snapshots para revisão |
| 4 | `pipeline/projeto.sh render DIR NOME` | vídeo final em `saida/NOME.mp4` (-14 LUFS) e projeto em `projetos/NOME/` |

## Pastas

- `pipeline/` scripts do fluxo; `palavras.py` é a transcrição com tempo por palavra (Parakeet v3).
- `template/` modelo do projeto HyperFrames (`gen.py` lê `edicao.json`).
- `projetos/` projetos de vídeos já feitos (sem o vídeo pesado), para reaproveitar.
- `saida/` vídeos finais (fora do git).
- `scripts/` utilitários antigos: `transcrever.py` (SRT com Whisper) e `queimar-legenda.sh`.

## Estilo padrão

Limpo, no modelo de @dosufinds: sem emojis, sem efeitos sonoros, legenda pequena de uma linha,
no máximo 2–3 selos e um CTA final. Detalhes e regras técnicas na skill.

## Limites do ambiente

Sem GPU (render ~3–5 min por vídeo de 40 s). Hugging Face, YouTube e bancos de imagem/música são
bloqueados; música se coloca no próprio TikTok/CapCut.
