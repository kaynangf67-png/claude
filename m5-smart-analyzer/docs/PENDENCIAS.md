# Regras e definições ainda pendentes

## Dúvidas sobre as anotações da aula 2 (precisam de confirmação)
1. **F1** — a primeira palavra de "…ão em M5 ou timeframes maiores" está ilegível (parece "Reversão" ou "Rejeição"). Qual é o filtro? É não entrada? Como se detecta?
2. **F2** — a última linha ("velas de cores?") está ilegível. Qual é a condição exata e o que é "próximo" da região (distância)?
3. **G3 "Pico de vela"** — é o preço do candle em formação atingindo o extremo (pavio) da região? Ou o pico de candles anteriores?
4. **G2** — "velas anteriores deixando pavio": quantas velas, e o pavio precisa estar do lado da região?
5. **G1** — o cronômetro conta a partir da abertura do candle M5 (corrida de 5:00)? Entra a favor ou contra? Existe limite máximo (ex.: não entrar após 4:30)?
6. **Direção/expiração** — as anotações não dizem se a entrada é compra ou venda a partir da zona, nem o tempo de expiração. O app não define isso.

## Parâmetros numéricos que a aula não fornece
`wickRelevantRatio`, `minRelevantWickCandles`, `alternationFavorableMin`, `directionalDominanceMin`, `swingMinDisplacementMult`, `minValidatedSwings`,
`zoneToleranceMult`, `retractionMinMult`, `retractionWindow`, `bigBodyRatio`, `bigBodyMinCount`, `continuousMoveEfficiency`.

## Regras não verificáveis com candles fechados
F2 e F4 (candle em formação / ritmo do preço), G1 (relógio) e G3 (pico). Exigem dados intra-candle (ticks ou o candle em formação em tempo real).

## Outras pendências técnicas
- "Corpo grande" considera só corpo/amplitude; a amplitude absoluta do candle não entra.
- O gráfico mostra só as 6 zonas mais recentes (para não poluir); as demais estão no painel de filtros.
- A reprodução histórica (Histórico → Reprodução) só mostra a distribuição dos estados; não mede acerto (sem gatilho/expiração definidos).
- Candles carregados persistem até 5000 candles; avisos e lacunas da importação não são guardados.
- Apenas M5. Outros timeframes exigem regras próprias.
