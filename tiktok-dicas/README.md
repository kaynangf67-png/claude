# Dicas TikTok (Remotion)

Vídeo vertical 1080x1920, 30fps, com 6 cenas (gancho, ideia, números, passo a passo, erro, fechamento). Tudo sai de **um JSON por dica** mais o áudio e os timestamps da narração. A duração de cada cena vem dos timestamps.

```bash
npm install
npm run dev      # preview no Remotion Studio
npm run render   # gera out/Dica.mp4 (H.264)
```

## Gerar um vídeo novo

1. **Copie** `public/config.json` para `public/minha-dica.json` e troque os textos.
   - `roteiro` é o texto **exatamente como vai ser narrado**, separado por cena (com os 3 passos separados). É ele que permite cortar a narração em cenas, então escreva números como a voz vai falar ("cento e cinquenta").
   - `numeros`: o último item é o resultado. O render avisa se a conta não fechar.
   - `passos`: até 8 palavras cada. Ícones disponíveis: `alvo lista mensagem camera loja dinheiro telefone check mapa pessoas calendario foguete`.
   - `transicoes`: 5 itens entre `split`, `zoom`, `wipe`, `glitch`, sem repetir o mesmo dois seguidos.
   - `cor`: `limao`, `dourado` ou um hex.
2. **Gere a narração** juntando os trechos do `roteiro` (voz feminina calma, pt-BR, na sua TTS) e salve como `public/narracao.mp3`.
3. **Salve os timestamps por palavra** como `public/narracao.json`. O projeto lê direto estes formatos, sem converter:
   - `{ "palavras": [{ "texto": "Um", "inicio": 0.0, "fim": 0.2 }] }` (segundos)
   - a resposta do ElevenLabs *with-timestamps* (`alignment` com tempos por caractere)
   - `words` do Whisper / ElevenLabs Speech-to-Text (roda a transcrição em cima do mp3)
4. Rode:
   ```bash
   npm run render -- --props='{"config":"minha-dica.json"}' --output=out/minha-dica.mp4
   ```
   No Studio dá para trocar o `config` no painel de props.

Os avisos aparecem no terminal com o prefixo `[dica]`: duração fora de 25–35s, gancho acima de ~2s, conta errada, passo longo, trecho do roteiro que não bate com o áudio, áudio ausente. **Leia antes de postar.**

### Sem áudio ainda?

`npm run timestamps:estimar -- public/minha-dica.json` cria timestamps **estimados** a partir do `roteiro`, para ver o layout no preview. O vídeo final precisa dos timestamps reais.

## Áudio

- A narração toca em volume cheio. A trilha (`trilha`, opcional, em loop) fica a **-22dB** enquanto há voz e sobe para -12dB nas pausas, com rampa de 0,35s (ducking calculado pelos timestamps).
- `public/trilha.wav` é um loop lo-fi sintetizado por `npm run trilha`, livre de direitos. Troque por uma trilha sua quando quiser.

## Estrutura

```
src/
  Root.tsx          composição "Dica" + cálculo da duração (calculateMetadata)
  Video.tsx         monta cenas, transições, legendas, grão, áudio
  cenas/            Gancho, Ideia, Numeros, Passos, Erro, Fechamento
  transicoes/       split, zoom-through, glitch (+ wipe do @remotion/transitions)
  componentes/      Camera (zoom lento), Pelicula (grão + vinheta), Legendas, Icone
  lib/              leitura dos timestamps, corte em cenas, ducking
  tema.ts           cores, fonte (Sora, embutida) e área segura
```

Área segura: o conteúdo fica entre 190px do topo e 1350px, com 90px de margem à esquerda e 180px à direita (já contando o zoom da câmera). As legendas ficam entre 1400px e 1720px.
