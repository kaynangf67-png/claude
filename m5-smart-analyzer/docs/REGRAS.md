# Regras implementadas

Versão das regras: `aula-03@0.1.0` (campo `rulesVersion`, gravado em todo registro do histórico).

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
tempo restante mínimo = **2 min 30 s** (aula 3; confirmado por você: "não pegar entrada com menos que isso"), "2 toques na região deixando pavio" (aula 2).

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

## Aulas 2 e 3 — filtros de não entrada e gatilho

Fontes: **fotografia de anotações manuscritas** (aula 2) e o arquivo `analisador-m5.html` enviado por você, que registra a aula 3.
**Não vi a transcrição da aula 3**: o que está abaixo vem desse arquivo e da sua confirmação do cronômetro. O arquivo também ajudou a ler a anotação F1.

Os filtros F1, F2 e F4 usam o **candle em formação** (preço de agora, abertura, minutos já fechados). Sem feed ao vivo (CSV) eles ficam "não avaliáveis" e entram como ressalva.
Com o feed, são avaliados para a **zona em contato** com o candle em formação (`EntryCandidate`: borda da zona, preço de entrada = preço atual limitado à borda, toques válidos anteriores).

| Item | Regra | Operacionalização | Parâmetros |
|---|---|---|---|
| F1 `reversao` | "Reversão em M5…" (leitura inferida do arquivo; **a confirmar**) | não entrada se, neste candle, o preço já andou contra a operação mais que o limite (× ATR). Só o M5 atual, não "timeframes maiores" | `reversalATR` |
| F2 `vela_proxima_regiao` | vela nascendo próxima da região = sinal de rompimento | não entrada se a abertura está a menos que o mínimo (× ATR) da borda de entrada | `approachATR` |
| F3 `sequencia_direcional` | fluxo de 3 ou mais velas da mesma cor | não entrada se a sequência que **termina no último candle** tem ≥ 3 (qualquer direção; mais conservador que "rumo à zona") | `maxSameDirectionRun` (3, **aula**) |
| F4 `vela_lenta_parada` | vela lenta ou parada = chance de rompimento | aproximação provisória: lenta = eficiência (deslocamento ÷ caminho nos fechamentos de 1 min) acima do limite; parada = amplitude pequena após 1 min | `slowEfficiencyMax`, `stoppedRangeATR` |

Critérios do gatilho (`src/core/rules/gatilho.ts`) — todos precisam ser atendidos **e** o cenário precisa estar FAVORÁVEL (sem F1–F4 detectados):

| Critério | Operacionalização | Origem |
|---|---|---|
| Tempo restante | tempo restante do candle ≥ 150 s (exatamente 150 vale; abaixo disso não entra) | aula 3, **confirmado** |
| Velas anteriores com força a favor | das 2 velas fechadas anteriores, quantas têm pavio relevante do lado da zona **ou** cor a favor; `prevCandlesRequired` (1 ou 2: a professora fala "as duas" e "uma" em trechos diferentes) | aula 3 (arquivo) |
| "Pico de vela" | **interpretação provisória**: o preço do candle em formação alcançou a borda de entrada da zona (entrada no extremo) | **a confirmar** — a anotação não define o termo |
| 2 toques anteriores com pavio | zona em contato com ≥ 2 toques anteriores cujo candle do extremo deixou pavio relevante | aula 2 |

Parâmetros de F1/F2/F4 e `prevCandlesRequired` **não existem nas aulas** (no arquivo, o autor os marca como "meus"). Entram só no preset exploratório.

Diferenças em relação ao arquivo `analisador-m5.html` (não adotado):
- a **nota de 0 a 100** por par (mistura os pilares numa pontuação arbitrária; o briefing proíbe pontuação que esconda critérios). Aqui o ranking é por estado do cenário;
- o modelo de zonas é outro (tolerância em ATR, rejeição = fechamento de volta). Mantive o meu, único para o ao vivo e o teste histórico.

## Teste histórico e diário (medem resultado)

- **Resultado**: o candle M5 fecha do lado certo do preço de entrada (borda da zona): venda ganha se fecha abaixo, compra se fecha acima; igual = empate (fora da taxa). Expiração = fechamento do M5. Isso **não vem da aula**.
- **Ponto de equilíbrio** = 1 ÷ (1 + payout). Com 80%: 55,6%. O payout é um parâmetro seu (`payoutPercent`, padrão técnico 80: confirme na corretora).
- **Veredito**: "acima" só se o intervalo de confiança (Wilson 95%) inteiro está acima do equilíbrio; "abaixo" se inteiro abaixo; senão **inconclusivo**.
- **Teste histórico** (`src/core/backtest.ts`): para cada toque numa zona **armada** (≥ 2 toques válidos anteriores), reproduz o caminho do candle com velas de 1 minuto até o toque, avalia o gatilho com o mesmo código do ao vivo e confere o fechamento. Usa só velas anteriores. Instante do toque = meio do minuto em que a borda foi alcançada. Mostra 3 recortes (todo toque / cenário favorável / gatilho confirmado) e a contribuição de cada critério.
- **Diário ao vivo** (`src/core/journal.ts`): registra cada toque do candle em formação em zona armada e resolve no fechamento. Só com a aba aberta e visível.
- Limitações estatísticas: 7 critérios olhados de uma vez (alguns vão parecer bons por acaso), casos de pares de cripto correlacionados (o intervalo é otimista) e dados que não são os da Quotex.

## Sem look-ahead

- Um pivô só é conhecido `swingLookback` candles depois (`confirmedAtIndex`); a validação registra `validatedAtIndex`; a retração registra `confirmedAtIndex`.
- A análise recebe só candles até o "agora"; `replay()` (`src/core/replay.ts`) chama a análise com `candles[0..i]` para cada `i`.
- Testes: pivô ausente antes da confirmação; conjunto de pivôs em `i` = calculado só com dados até `i`; alterar candles futuros não muda a análise passada.
- No gráfico, topos/fundos aparecem **no candle do pivô**, embora só fossem conhecidos alguns candles depois (veja o painel de filtros).
