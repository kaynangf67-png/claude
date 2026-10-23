# CLAUDE.md

Este repositório reúne vários projetos do usuário (sites em `kl-beauty/`, `liveflow/`, `unnica-odonto/`, app Vite em `src/`) e o kit de edição de vídeo em `video-studio/`.

## Edição de vídeo

Quando o usuário enviar um vídeo e pedir para editar/cortar/legendar, use a skill `editar-video` (`.claude/skills/editar-video/SKILL.md`). Ela tem o fluxo completo, o estilo combinado com o usuário (limpo, sem emojis, legenda pequena) e os erros que não devem se repetir. Comece sempre por `bash video-studio/setup.sh`.

Responda em português, de forma direta e crítica.
