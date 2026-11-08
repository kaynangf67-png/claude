# M1 SNIPER BOT

Extensão do Google Chrome (Manifest V3) que mostra um painel pequeno, flutuante e arrastável sobre a Quotex. O painel analisa candles de 1 minuto com EMA 9/21/200, RSI 14, ADX 14, Bollinger 20/2 e Price Action, sugere entradas **CALL/PUT** com expiração de 1 minuto e aplica uma gestão de risco obrigatória.

> **Execução:** por padrão o bot só indica. Existe um **modo AUTO opcional** (versão 1.2): depois que você **calibra** os elementos da Quotex e **arma** o automático, o bot **clica CALL/PUT sozinho**, mas só no mercado aberto na Quotex e só se a conta, o ativo e o valor conferirem. Ele não usa APIs privadas: apenas clica no botão que você mesmo indicou.
>
> **Atenção:** a Quotex pode proibir automação nos termos de uso e bloquear a conta. Use primeiro na DEMO. A responsabilidade pelo uso é sua.
>
> **A pontuação não é probabilidade de acerto.** Opções binárias têm alto risco e são restritas ou proibidas em vários países. Não existe 100% de acerto.

---

## 1. O que está conectado, testado ou pendente

| Recurso | Situação |
|---|---|
| Painel flutuante **sobre o gráfico** (arrastar, minimizar, ocultar, LIGAR/DESLIGAR, valor, DEMO/REAL, GREEN/LOSS, último sinal, histórico, ativo, relógio, ajustes ⚙ dentro do painel) | **Funcionando.** Testado no Chromium com a extensão carregada. |
| Confirmação da **próxima vela** (M1, expiração 1 min): checklist ✓/✗ de cada indicador, nota e prévia ao vivo da vela em formação | **Funcionando** com dados reais da Binance. |
| Clique no ícone da extensão = mostra/oculta o painel na aba atual (funciona em qualquer domínio, inclusive espelhos da Quotex) | **Funcionando.** Testado com injeção via `activeTab` em domínio fora da lista. |
| Fonte de candles: **API pública de market data da Binance** (`data-api.binance.vision`, documentada e sem chave) | **Conectada e testada** com dados reais. |
| Candles da própria Quotex | **Não conectado.** A Quotex não tem API pública documentada. Por isso o bot usa uma fonte independente. |
| Ativos cobertos | Criptomoedas (BTC, ETH, SOL, XRP, …) via Binance. **OTC e Forex da Quotex não são cobertos.** O preço da Binance pode diferir do preço exibido na Quotex. |
| Indicadores (EMA, RSI de Wilder, ADX de Wilder, Bollinger) | **Testados** (testes unitários, RSI conferido com a série de referência do StockCharts). |
| Price Action (engolfos, pin bars, rejeição de suporte/resistência, rompimento confirmado, continuação) | **Testado** (testes unitários). |
| Motor de pontuação 0–100, mínimo de 80 | **Testado.** Sem sinal quando os indicadores se contradizem. |
| Travas de 10 GREEN / 3 LOSS, sem Martingale, sem entrada simultânea, sem duplicidade, sinal desatualizado, desligar interrompe sinais | **Testados** (unitário + extensão real). |
| Persistência (`chrome.storage.local`) após fechar o navegador ou atualizar a extensão | **Implementada.** Testado o recarregamento do estado e a trava reaplicada mesmo com o estado editado à mão. |
| Detecção do ativo da Quotex (pelo título da aba) | **Best-effort, NÃO verificada** na Quotex real. Se detectar um ativo diferente do analisado, ou um ativo OTC, os sinais são suspensos. |
| Detecção DEMO/REAL da página (pela URL `demo-trade` vs `trade`) | **Best-effort, NÃO verificada** na Quotex real. Se a página parecer REAL com o bot em DEMO, os sinais são bloqueados. |
| Resultado GREEN/LOSS | O bot **sugere** o resultado pelo candle da Binance, mas **você registra** o resultado que a Quotex mostrou. |
| **Modo AUTO** (clique automático em CALL/PUT) | **Funcionando e testado** numa página que imita a Quotex, com elementos calibrados e candles sintéticos que forçam um sinal: o clique saiu 0,3 s após a abertura da vela de entrada. **Não foi testado na Quotex real.** A calibração depende do HTML da Quotex, e se o site mudar é preciso calibrar de novo. |
| Mercados indicados (varredura de 12 ativos de cripto a cada 15 s) | **Funcionando.** Ao abrir na Quotex um dos mercados, o bot passa a analisar esse mercado automaticamente. |

## 2. Instalação (modo desenvolvedor)

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` no Chrome.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `m1-sniper-bot/` (a que contém `manifest.json`).
5. Abra a Quotex (`qxbroker.com`, `quotex.com` ou `quotex.io`). O painel aparece no canto superior direito.
6. Nada abre em outra página. **Clique no ícone da extensão** para mostrar ou ocultar o painel em cima do gráfico (funciona até em domínios da Quotex que não estão na lista). Ajuste o **fuso** e o **payout** no botão **⚙** do painel.

> Se o seu acesso à Quotex usa outro domínio, acrescente-o em `content_scripts.matches` e em `web_accessible_resources.matches` no `manifest.json` e recarregue a extensão.

Não há build: o código roda direto no Chrome. Node 20+ só é necessário para testes e backtest.

## 3. Como usar

1. Na Quotex, abra a **conta DEMO** e o mesmo ativo escolhido no painel (ex.: BTC/USD ↔ `BTCUSDT`), em M1.
2. Digite o **valor por operação** no painel.
3. Clique em **LIGAR**. A caixa **PRÓXIMA VELA** mostra, a cada segundo:
   - a leitura da vela em formação (**prévia**: "se fechar assim, sai sinal"), com contagem até o fechamento;
   - a lista de confirmações: Tendência (EMAs), RSI 14, ADX 14, Bollinger 20/2, Price Action e vela de confirmação, cada uma com ✓ (confirma), • (neutro) ou ✗ (contra), e o valor do indicador;
   - a nota de 0 a 100, com a linha amarela marcando o mínimo de 80.
4. Quando a vela **fecha** e tudo confirma, a caixa vira **✔ CONFIRMADO · ▲ CALL / ▼ PUT**, com a entrada na vela seguinte e expiração de 1 minuto. Você tem **15 s** (configurável de 3 a 30 s) a partir da abertura dessa vela.
5. O bot **não opera sozinho**. Se decidir entrar, abra a operação você mesmo na Quotex e clique em **ENTREI** (para contar no placar). Caso contrário, clique em **IGNORAR**.
6. Depois da expiração, clique em **GREEN**, **LOSS** ou **EMPATE** conforme o resultado da Quotex. O botão sugerido pela Binance fica destacado em amarelo.
7. Os contadores se atualizam. Com **10 GREEN** aparece **META DIÁRIA ATINGIDA**, com **3 LOSS** aparece **LIMITE DE LOSS ATINGIDO**. O painel desliga e só volta na virada do dia local.

Os ajustes (fuso, nota mínima, payout, validade do sinal), as estatísticas da DEMO, os critérios do modo REAL e a exportação do histórico ficam no botão **⚙** do próprio painel. O relatório completo continua disponível em `chrome://extensions` → M1 SNIPER BOT → **Detalhes → Opções da extensão**.

### Modo AUTO (opcional)

1. No painel, clique em **⚙ → Calibração do automático** e calibre os 4 itens. Clique em **CALIBRAR** e depois no item da Quotex: o **nome do ativo**, o **campo de valor**, o botão **Para cima (CALL)** e o botão **Para baixo (PUT)**. Durante a calibração, o clique é **bloqueado** e não abre operação. **Esc** cancela.
2. Na Quotex, deixe a **expiração em 1 minuto** e o **valor igual** ao do painel.
3. Clique em **🤖 AUTO DESLIGADO**, leia o aviso e confirme. O botão fica roxo: **AUTO ARMADO**.
4. O painel mostra, ao vivo, as condições exigidas, e **todas** precisam estar ✓ para o bot clicar:
   - **Calibrado**;
   - **Conta**: a página DEMO/REAL precisa ser igual ao modo do bot (REAL só depois da validação);
   - **Mercado aberto**: o ativo aberto na Quotex é o analisado (OTC nunca entra);
   - **Valor**: o valor no campo da Quotex é igual ao do painel.
5. Quando uma vela fecha com sinal ≥ 80 nesse mercado, o bot clica CALL/PUT em até 6 s da abertura da vela seguinte. Depois disso, não entra mais.
6. Depois da expiração, confira na Quotex e registre GREEN/LOSS. Se você não registrar em 45 s, o bot registra o resultado medido na fonte (Binance).

Regras de segurança do AUTO:
- Ele desarma sozinho ao **DESLIGAR**, ao bater a meta de 10 GREEN ou o limite de 3 LOSS, na **virada do dia**, se a **calibração mudar** ou se o **clique falhar** (botão sumiu ou desabilitado).
- Uma operação por vez, sem Martingale.

**DESLIGAR** interrompe novos sinais na hora. Uma operação já aberta continua esperando o registro do resultado.

## 4. Regras do motor

Análise **somente no fechamento** do candle. A entrada é na abertura do candle seguinte, com expiração de 1 minuto.

| Bloco | Pontos | Vetos (impedem o sinal) |
|---|---|---|
| Tendência | até 25 (EMA9×EMA21 = 10, preço e EMA21 do lado certo da EMA200 = 10, inclinação da EMA9 = 5) | EMA9/21 contra a direção; preço do lado errado da EMA200 |
| RSI 14 | 15 dentro de 50–70 (CALL) ou 30–50 (PUT); 7 na margem de 5 pontos | RSI ≥ 70 no CALL ou ≤ 30 no PUT (exaustão); RSI contra a direção |
| ADX 14 | 15 se ≥ 25; 8 se de 20 a 25 | ADX < 20 (sem direção); +DI/−DI contraditório |
| Bollinger 20/2 | 10 do lado certo da média + 5 se houver rejeição na média ou na banda | Fechamento fora da banda (esticado); bandas comprimidas |
| Price Action | até 20 (engolfo/pin bar 20, rejeição 18, rompimento confirmado 16, continuação 14, +4 se houver mais de um padrão) | Nenhum padrão |
| Candle de confirmação | até 10 (a favor = 5, corpo ≥ 50% = 3, corpo ≥ média = 2) | Candle contra a direção |

A nota mínima é **80** e só pode ser aumentada (até 100). Se CALL e PUT se qualificarem ao mesmo tempo, não há sinal.

## 5. Gerenciamento de risco (fixo, não configurável)

- **10 GREEN/dia** ou **3 LOSS/dia** bloqueiam o dia. O painel desliga e não religa até a virada do dia local.
- A virada usa o **fuso configurado**. Os contadores só reiniciam quando a data **avança**: atrasar o relógio não desbloqueia. O fuso só pode ser trocado em um dia sem operações e sem bloqueio.
- **Sem Martingale.** Depois de um LOSS, o valor não pode subir no mesmo dia.
- Uma operação por vez, cada sinal é único (ativo + candle) e sinais vencidos são descartados.
- Todo o estado passa pelo service worker, que é o único gravador. A trava é **recalculada a partir dos contadores** sempre que o estado é carregado (reinício, atualização ou edição manual do storage).
- Sem conexão, dados atrasados (mais de 2,5 min), lacunas ou candles inválidos suspendem os sinais.

## 6. Modo REAL

O modo REAL **não** é liberado só pela quantidade de sinais. A página de configurações exige **todos** os critérios abaixo:

- ≥ 100 operações DEMO registradas e ≥ 100 sinais com resultado medido;
- ≥ 5 dias diferentes de teste;
- taxa de acerto DEMO ≥ break-even + 3 p.p. (break-even = 1 / (1 + payout); com payout 0,85, isso dá 54,1%, então o mínimo é 57,1%);
- resultado líquido DEMO positivo e drawdown máximo ≤ 10 entradas;
- **confirmação por escrito** da frase `ENTENDO OS RISCOS E QUERO O MODO REAL`.

Mesmo no modo REAL, o bot continua sem executar ordens.

## 7. Testes e backtest

```bash
cd m1-sniper-bot
npm test                                    # 31 testes: indicadores, padrões, motor, travas, REAL, AUTO
node scripts/backtest.mjs --symbol BTCUSDT,ETHUSDT,SOLUSDT --days 7 --tz America/Sao_Paulo
node scripts/backtest.mjs --csv meus_candles.csv --symbol EURUSD   # CSV: time,open,high,low,close
```

O backtest é walk-forward **sem antecipação**: no candle *i* o motor só vê os candles 0..*i*, e o resultado vem do candle *i+1*. Um teste garante que truncar a série não muda os sinais anteriores. As travas diárias de 10/3 também são aplicadas.

**Resultado obtido em 07/11/2026 (7 dias, dados reais da Binance, payout 0,85):**

| Ativo | Sinais | Acerto | Resultado | Drawdown máx. |
|---|---|---|---|---|
| BTCUSDT | 72 | 66,2% | +15,25 entradas | 4,00 |
| ETHUSDT | 49 | 50,0% | −3,60 entradas | 6,05 |
| SOLUSDT | 44 | 38,5% | −11,25 entradas | 11,25 |
| **Total** | **165** | **54,2%** | **+0,40 entradas** | 14,05 |

Leitura honesta: no total o resultado ficou **no break-even**. Foi positivo só em BTC, numa amostra pequena (uma semana), e não mede a diferença de preço entre a Binance e a Quotex. **Isso não comprova vantagem estatística.** Valide na DEMO, por ativo e por horário, antes de qualquer decisão. Os relatórios mostram o desempenho por ativo e por hora.

## 8. Estrutura

```
m1-sniper-bot/
├── manifest.json
├── src/
│   ├── core/            # lógica pura (roda no Chrome e no Node)
│   │   ├── indicators.js   # EMA, SMA, RSI, ADX, Bollinger
│   │   ├── priceAction.js  # padrões de candle
│   │   ├── engine.js       # motor de análise + pontuação 0–100
│   │   ├── validate.js     # validação/mescla de candles
│   │   ├── risk.js         # travas diárias, sem Martingale
│   │   ├── state.js        # estado + redutor (todas as regras)
│   │   ├── stats.js        # acerto, drawdown, por ativo/hora, critérios REAL
│   │   ├── backtest.js     # walk-forward sem antecipação
│   │   └── time.js         # fuso horário/virada do dia
│   ├── data/binance.js     # captura autorizada de candles (API pública)
│   ├── background/sw.js    # service worker: única fonte de verdade
│   ├── content/            # painel flutuante + laço de análise
│   └── options/            # relatórios, configurações, modo REAL, exportação
├── scripts/                # backtest e geração de ícones
└── tests/                  # node --test
```

## 9. Limitações conhecidas

- Os preços vêm da Binance, não da Quotex, e a diferença pode mudar o resultado de operações de 1 minuto.
- A detecção de ativo e de conta na página da Quotex depende do título e da URL, que a Quotex pode mudar sem aviso. Esses pontos não foram verificados na Quotex real porque não há acesso a ela neste ambiente.
- O motor não considera notícias, spread nem latência de execução manual.
- O backtest mede o fechamento contra a abertura do candle seguinte. Na prática, a sua entrada manual acontece alguns segundos depois.
