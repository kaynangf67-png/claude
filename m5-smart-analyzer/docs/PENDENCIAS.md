# Regras e definições ainda pendentes

## Dúvidas abertas (precisam de confirmação sua)
1. **F1** — a anotação "…ão em M5 ou timeframes maiores" parece ser **"Reversão"**, e o arquivo `analisador-m5.html` tem um filtro de reversão. Implementei assim, só no M5 atual. É isso? E "timeframes maiores" significa olhar também o candle M15/M1?
2. **"Pico de vela"** — implementei como "preço na borda da zona". É isso, ou é algo sobre o pavio/extremo do candle anterior?
3. **Velas anteriores**: as duas precisam ter força a favor, ou basta uma? (`prevCandlesRequired`)
4. **F3** — vale qualquer sequência de 3 da mesma cor, ou só rumo à zona (como no arquivo)? Hoje bloqueia qualquer direção.
5. **Direção e expiração** — compra no suporte e venda na resistência, com expiração no fechamento do M5, é o que o teste assume (do arquivo). Confirmar.
6. Onde estão as transcrições da aula 3 (e seguintes)? Só vi o arquivo; quero conferir os números dele contra a fonte.

## Parâmetros numéricos que a aula não fornece
`wickRelevantRatio`, `minRelevantWickCandles`, `alternationFavorableMin`, `directionalDominanceMin`, `swingMinDisplacementMult`, `minValidatedSwings`,
`zoneToleranceMult`, `retractionMinMult`, `retractionWindow`, `bigBodyRatio`, `bigBodyMinCount`, `continuousMoveEfficiency`, `reversalATR`, `approachATR`, `slowEfficiencyMax`, `stoppedRangeATR`, `prevCandlesRequired`.

## Regras que dependem do candle em formação
F1, F2, F4, o "pico de vela" e o cronômetro só são avaliados com o feed ao vivo (Binance, **cripto**) ou, no cronômetro, com o tempo restante digitado. Para forex não há feed ao vivo; só teste histórico com CSV de 1 minuto do MT5.

## Prazos (curto/médio/longo)
As aulas só dão regras para o **M5**. Outros timeframes de entrada (M1, M15, H1+) exigem regras próprias e validação própria; não foram inventados. O que existe é a **confluência com M15/H1 como contexto** (hipótese, desligada por padrão). Pergunta aberta: a professora tem aula para outros prazos?

## Outras pendências técnicas
- "Corpo grande" considera só corpo/amplitude; a amplitude absoluta do candle não entra.
- O gráfico mostra só as 6 zonas mais recentes (para não poluir); as demais estão no painel de filtros.
- A "Reprodução histórica" só mostra a distribuição dos estados; quem mede resultado é o "Teste histórico".
- O feed ao vivo consulta a API pública a cada 5 s (sem WebSocket); o diário só registra com a aba visível.
- Candles carregados persistem até 5000 candles; avisos e lacunas da importação não são guardados.
- Apenas M5. Outros timeframes exigem regras próprias.
