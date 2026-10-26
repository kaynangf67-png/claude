# Regras implementadas

Versão das regras: `aula-02@0.1.0` (campo `rulesVersion`, gravado em todo registro do histórico).

**Princípio:** o aplicativo só afirma o que as aulas afirmam. Onde a aula é qualitativa, o parâmetro numérico começa como
**"não definido"** e o filtro fica **pendente de configuração** (nunca satisfeito). Cada parâmetro registra a origem:

| Origem | Significado |
|---|---|
| `aula` | número citado explicitamente na aula |
| `padrao_tecnico` | escolha neutra do app (tamanho de janela etc.) |
| `usuario` | definido por você |
| `preset_exploratorio` | valor de teste aplicado pelo botão "Preencher com valores exploratórios". **Não vem da aula e não foi validado.** |
| `nao_definido` | a aula não define |

Valores que vêm da aula: toques anteriores = **2** (aula 1), fluxo da mesma cor = **3 ou mais** (aula 2),
cronômetro = **2 min 30 s** (aula 2), "2 toques na região deixando pavio" (aula 2).

## Estados do motor (`src/core/engine.ts`)

1. **NÃO AVALIÁVEL** — poucos candles, candle inválido, timestamps duplicados/fora de ordem, lacuna dentro da janela analisada, intervalo incompatível com M5, amplitude zero.
2. **DESFAVORÁVEL** — algum filtro de *não entrada* detectado. Vence tudo (inclusive critérios pendentes).
3. **AGUARDAR** — algum critério positivo não atendido/pendente, ou filtro de não entrada que não pôde ser verificado por falta de parâmetro.
4. **FAVORÁVEL** — todos os critérios positivos habilitados atendidos e nenhum filtro de não entrada detectado. **Não é entrada confirmada.**

Filtros que exigem o *candle em formação* (F2, F4) aparecem como "não avaliável" e entram como **ressalva** na análise (não bloqueiam nem são tratados como satisfeitos).

Estados de cada filtro: favorável, desfavorável, pendente, não avaliável. Em filtros de contexto, "desfavorável" = critério contrário
(não leva sozinho ao cenário desfavorável). Em filtros de não entrada, "desfavorável" = condição detectada.

## Aula 1 — escolha de pares para retração (M5)

| # | Filtro (`id`) | Papel | Operacionalização | Parâmetros |
|---|---|---|---|---|
| 1 | Pavios visíveis (`pavios`) | contexto | candles da janela de observação cujo maior pavio ≥ limite da amplitude; favorável se a contagem ≥ mínimo | `wickRelevantRatio`, `minRelevantWickCandles` *(não definidos)* |
| 2 | Alternância de cores (`alternancia`) | contexto | taxa de trocas de cor entre candles consecutivos (dojis ignorados) na janela; desfavorável se uma cor predomina | `alternationWindow` (12), `alternationFavorableMin`, `directionalDominanceMin` |
| 3 | Topos e fundos (`topos_fundos`) | contexto | candidato geométrico: máxima/mínima extrema entre N candles de cada lado; **validado**: preço se afastou ≥ mínimo (× amplitude média) usando só candles fechados | `swingLookback` (2), `swingMinDisplacementMult`, `minValidatedSwings` |
| 4 | Regiões com retrações (`zonas`) | contexto | pivôs do mesmo lado a menos da tolerância formam zona; classifica toque / aproximação / rompimento; favorável se o último candle toca ou se aproxima | `zoneToleranceMult`, `retractionMinMult`, `retractionWindow` |
| 5 | Histórico mínimo (`historico_minimo`) | contexto | zona em contato com ≥ N toques anteriores **válidos** (toque + retração observável) → "zona candidata" (**não é gatilho**) | `minPriorValidTouches` (2, **aula**) + parâmetros da regra 4 |
| 6a | Corpos grandes, pavios pequenos (`corpo_grande`) | não entrada | corpo ≥ limite da amplitude em ≥ N candles da janela | `bigBodyRatio`, `bigBodyMinCount` |
| 6b | Fluxo da mesma cor (`sequencia_direcional`) | não entrada | ver aula 2 | `maxSameDirectionRun` (3, **aula 2**) |
| 6c | Topos/fundos pouco definidos (`estrutura_indefinida`) | não entrada | menos pivôs validados que o mínimo da regra 3 | idem regra 3 |
| 6d | Movimento contínuo (`movimento_continuo`) | não entrada | eficiência direcional = \|Δ líquido\| ÷ caminho percorrido (fechamentos) na janela ≥ limite *(operacionalização provisória)* | `continuousMoveEfficiency` |
| 6e | Rompimento sem retração (`rompimento_sem_retracao`) | não entrada | fechamento além da borda externa de uma **região consolidada** (≥ `minPriorValidTouches` toques válidos antes) na janela de observação, sem retorno | parâmetros da regra 4 |
| 7 | Horário e OTC (`horario_otc`) | informativo | registra horário do último candle, fuso, OTC declarado e origem. **Nenhum horário recebe preferência.** | — |

Definições provisórias de zona (a aula não dá números):
*toque* = extremo do candle alcança a faixa sem fechar além da borda externa; *aproximação* = extremo a até uma tolerância da faixa;
*rompimento* = fechamento além da borda externa; *retração observável* = afastamento ≥ mínimo a partir do extremo do toque dentro da janela, sem rompimento antes.
Toque e aproximação consecutivos formam um único episódio de contato (evita contar o mesmo toque duas vezes).

## Aula 2 — filtros de não entrada e gatilho (anotações manuscritas)

Fonte: **fotografia de anotações manuscritas**, não transcrição. Algumas palavras estão ilegíveis (veja `PENDENCIAS.md`).

| Item | Texto lido | Situação |
|---|---|---|
| F1 | "Re?ão em M5 ou timeframes maiores" (palavra ilegível) | **não implementado** — aguardando confirmação |
| F2 | "Vela nascendo próximo da região → sinal de rompimento" (`vela_proxima_regiao`) | exige candle em formação → **não avaliável** com CSV |
| F3 | "Fluxo de vela da mesma cor, três ou mais velas" (`sequencia_direcional`) | **implementado**: sequência de mesma cor que **termina no último candle** ≥ 3 |
| F4 | "Vela lenta ou parada → chance de rompimento" (`vela_lenta_parada`) | exige candle em formação → **não avaliável** com CSV |
| G1 | cronômetro acima de 2 min 30 s | implementado; precisa dos segundos decorridos (**entrada manual**) |
| G2 | velas anteriores deixando pavio | implementado (usa a regra 1; precisa dos limites de pavio) |
| G3 | "pico de vela" | **não implementado** — sem definição operacional |
| G4 | 2 toques na região deixando pavio | implementado (zona em contato com 2 toques anteriores cujo candle do extremo deixou pavio relevante) |

O gatilho só é **confirmado** se todos os critérios forem atendidos **e** o cenário for FAVORÁVEL. Com candles fechados (CSV) isso nunca ocorre,
porque G1 e G3 não são verificáveis: o resultado esperado é "Gatilho não confirmado: X de 4 critérios atendidos".

## Sem look-ahead

- Um pivô só é conhecido `swingLookback` candles depois (`confirmedAtIndex`); a validação registra `validatedAtIndex`; a retração registra `confirmedAtIndex`.
- A análise recebe só candles até o "agora"; `replay()` (`src/core/replay.ts`) chama a análise com `candles[0..i]` para cada `i`.
- Testes: pivô ausente antes da confirmação; conjunto de pivôs em `i` = calculado só com dados até `i`; alterar candles futuros não muda a análise passada.
- No gráfico, topos/fundos aparecem **no candle do pivô**, embora só fossem conhecidos alguns candles depois (veja o painel de filtros).
