# M1 SNIPER BOT

Extensão do Google Chrome (Manifest V3) que mostra um painel flutuante sobre a Quotex para **análise de operações M1**
(1 minuto). Gera sinais **CALL/PUT** com pontuação de 0 a 100 e justificativa, aplica gestão de risco diária rígida e
registra o histórico. **A execução das ordens é sempre manual**: a extensão não clica, não envia ordens e não lê dados
internos da corretora.

> Nenhuma estratégia acerta 100%. Os sinais são uma ferramenta de apoio. Comece em conta DEMO; o modo REAL só é
> liberado depois de uma validação mínima registrada em DEMO (ver abaixo). Opções binárias têm alto risco de perda.

---

## 1. O que está conectado e o que não está

| Parte | Situação |
|---|---|
| Painel sobre a Quotex (arrastar, minimizar, ativar/desativar, valor, contadores, histórico, estatísticas) | **Funcional** |
| Motor de análise M1 (EMA 9/21/200, RSI 14, ADX 14, Bollinger 20/2, Price Action) | **Funcional e testado** |
| Gestão de risco (10 GREEN / 3 LOSS por dia, sem martingale, sem duplicidade, persistente) | **Funcional e testado** |
| Candles de uma **fonte de mercado independente**: Binance Spot, API pública documentada (`/api/v3/klines`) | **Funcional** (exige acesso de rede a `data-api.binance.vision` ou `api.binance.com`) |
| Entrada **manual** de candles (CSV colado no painel) | **Funcional** |
| Ler o gráfico, o ativo, o saldo ou o modo da conta **da Quotex** | **Não conectado.** A Quotex não publica API para isso. Não foi feita raspagem de página nem engenharia reversa de WebSocket. O painel mostra “Saldo: sem integração” |
| Enviar ordens | **Não existe, por decisão de projeto.** O usuário opera manualmente e confirma no painel |

**Consequência importante:** o preço da Binance **não é** o preço da Quotex. Para criptomoedas o movimento costuma ser
parecido, mas não é idêntico; para pares **OTC** da Quotex (preço gerado pela própria corretora) **não existe fonte
independente** e os sinais não correspondem ao gráfico que você vê. `EURUSDT` da Binance é só uma aproximação de EUR/USD.
Por isso o resultado sugerido pelo feed vem acompanhado de “confira com o resultado na corretora” e você registra o
resultado real com um clique.

---

## 2. Instalação (Chrome, modo desenvolvedor)

1. Baixe esta pasta `m1-sniper-bot/` (clone o repositório ou baixe o ZIP e extraia).
2. Abra `chrome://extensions` no Chrome.
3. Ligue **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta `m1-sniper-bot` (a que contém `manifest.json`).
5. Abra a Quotex (`qxbroker.com`, `quotex.io` ou `quotex.com`). O painel aparece no canto superior esquerdo do gráfico.
6. O ícone da extensão na barra do Chrome mostra/oculta o painel.

**Domínio espelho diferente?** Edite `content_scripts.matches` em `manifest.json`, adicione o domínio
(ex.: `"https://*.seu-espelho.com/*"`) e clique em **Recarregar** em `chrome://extensions`.

Para atualizar depois de baixar uma versão nova: substitua os arquivos e clique em **Recarregar** na extensão.

---

## 3. Uso

1. Clique em **⚙** e escolha a fonte:
   - **Binance (pública):** escolha o par (BTCUSDT, ETHUSDT, …). Em “Nome exibido” você pode escrever o nome do ativo
     que está aberto na Quotex (ex.: `BTC/USD`) para identificar no histórico.
   - **Manual (CSV):** cole pelo menos 230 candles M1 fechados (`time,open,high,low,close` ou `open,high,low,close`)
     e clique em **Analisar CSV**.
2. Defina o **valor por operação** (campo editável ou atalhos 5/10/20/50). O valor fica salvo.
3. Clique em **ATIVAR**. O painel carrega 500 candles e passa a analisar **a cada fechamento de candle**.
4. Quando surgir um sinal, o cartão mostra **▲ CALL** ou **▼ PUT**, pontuação, motivos e o candle de entrada.
   Você tem até **10 segundos** depois da abertura do candle de entrada para operar.
   - Operou na corretora? Clique **ENTREI**. Não quer? **IGNORAR** (ou deixe expirar).
5. Ao fim do minuto, clique **GREEN**, **LOSS** ou **EMPATE** conforme o resultado **na corretora**.
   O painel mostra o resultado medido pelo feed como referência. Se quiser, ative
   “Registrar resultado pelo feed automaticamente” (só faz sentido quando o feed é o mesmo ativo).
6. Ao chegar a **10 GREEN** ou **3 LOSS** no dia, o painel se desativa e bloqueia novas entradas até a meia-noite
   (data local do seu computador), mesmo que você feche e reabra o navegador.

O painel **sempre abre DESATIVADO** quando a página é carregada: você precisa ativar conscientemente.

---

## 4. Estratégia (motor `src/core/engine.js`)

O motor analisa **apenas candles fechados**. O último candle fechado é o candle de confirmação; a entrada sugerida é
no candle seguinte, com expiração de 1 minuto. Todos os indicadores são causais (o valor do candle *i* só usa candles
até *i*), então **não há repintura**; isso é verificado em teste.

**Filtros obrigatórios** (qualquer falha = sem sinal; o motivo aparece no painel):

| Filtro | CALL | PUT |
|---|---|---|
| Tendência | EMA 9 > EMA 21 **e** fechamento > EMA 200 **e** +DI > −DI | EMA 9 < EMA 21 **e** fechamento < EMA 200 **e** −DI > +DI |
| Contradição | Se EMA 9/21, EMA 200 e DI apontarem para lados diferentes → “filtros contraditórios” | idem |
| ADX (14) | ≥ ADX mínimo (padrão 20) | idem |
| RSI (14) | entre 50 e 70 (acima de 70 = exaustão) | entre 30 e 50 (abaixo de 30 = exaustão) |
| Volatilidade (Bollinger 20/2) | largura das bandas entre 0,5× e 3× a mediana das últimas 100; candle gatilho ≤ 3× ATR | idem |
| Exaustão | fechamento não pode estar mais de 0,5 ATR acima da banda superior | … abaixo da banda inferior |
| Price Action | ao menos um: engolfo de alta, pin bar de alta, rejeição de suporte (mínima recente, banda inferior ou EMA 21), rompimento de resistência confirmado no fechamento | equivalentes de baixa |
| Padrão contrário | nenhum padrão de baixa no mesmo candle | nenhum padrão de alta |
| Candle de confirmação | fechou comprador (close > open) | fechou vendedor |

**Pontuação 0–100:** tendência 25 (separação EMA9/21 em ATRs, inclinação da EMA 21, EMA 21 do lado certo da 200),
ADX 20 (força + distância entre DIs), RSI 15 (perto de 58 para CALL / 42 para PUT), Price Action 25 (força do padrão,
bônus por confluência), volatilidade 15 (perto da largura normal). Só vira sinal se a pontuação for ≥ **pontuação
mínima** (padrão 70, ajustável de 50 a 95).

---

## 5. Gestão de risco (`src/core/risk.js`)

- Meta diária: **10 GREEN** → bloqueio até o dia seguinte.
- Limite diário: **3 LOSS** → bloqueio até o dia seguinte.
- “Dia” = data local do usuário; o estado fica em `chrome.storage.local`, então o bloqueio continua após reiniciar.
- **Sem martingale:** depois de um LOSS, o valor da operação não pode ser aumentado no mesmo dia (pode diminuir).
- Valor não pode ser alterado com operação em andamento.
- **Sem duplicidade:** uma operação aberta por vez, um sinal por candle, e cada sinal só pode ser confirmado uma vez.
- Painel desativado = nenhum sinal novo e o botão ENTREI não existe; ao desativar, um sinal pendente é cancelado.
- Esses limites são fixos no código (não há configuração para afrouxá-los).

### Liberação da conta REAL

O botão **Liberar REAL** só funciona depois de **50 operações DEMO com resultado** e taxa de acerto ≥
**break-even + 5 pontos percentuais**. Break-even = 1 / (1 + payout); com payout de 85% ele é 54,1%, então o mínimo é 59,1%.
A tela de configurações mostra o progresso (operações, acerto e drawdown em DEMO). O modo da conta no painel é o
que **você** declara: a extensão não tem acesso ao modo real da sua conta na corretora.

---

## 6. Histórico e estatísticas

- **HISTÓRICO:** operações que você confirmou, com resultado.
- **SINAIS:** todos os sinais emitidos (operados, ignorados ou expirados), com o resultado que o feed mediu. Isso dá uma
  amostra “forward test” mesmo dos sinais que você não operou.
- **ESTATÍSTICAS:** número de operações, taxa de acerto, drawdown máximo (em stakes), break-even e resultado por ativo.
- Exportação em CSV nas configurações (operações e sinais).

---

## 7. Testes e backtest

Requer Node.js 18+ (sem dependências externas).

```bash
cd m1-sniper-bot
npm test
```

São 30 testes: indicadores com valores de referência (incluindo a tabela clássica de RSI de Wilder), causalidade dos
indicadores e do motor (sem repintura nem lookahead), padrões de Price Action, regras de cada filtro, gestão de risco
(meta, stop, virada de dia, persistência, sem martingale, sem duplicidade) e o fluxo completo do controlador
(ativar → sinal → ENTREI → resultado → persistência, expiração, bloqueio após reinício, liberação REAL, CSV manual).

### Backtest histórico

```bash
# Binance pública: últimos 7 dias de BTC, ETH, SOL, XRP e EUR (precisa de internet)
TZ=America/Sao_Paulo node scripts/backtest.js --symbols BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,EURUSDT --days 7

# Seus próprios dados (um arquivo por ativo; o nome do arquivo vira o nome do ativo)
node scripts/backtest.js --csv dados/EURUSD.csv,dados/GBPUSD.csv --payout 0.85

# Só para validar a mecânica, com dados sintéticos
node scripts/backtest.js --synthetic
```

Modelo: entrada na abertura do candle seguinte ao sinal, expiração no fechamento dele, uma operação por vez; empate
(close = open) devolve o valor. O relatório (`reports/backtest-AAAA-MM-DD.md`) traz, por ativo e no total:
quantidade de sinais, GREEN/LOSS/empates, taxa de acerto, resultado em stakes, **drawdown máximo** e maior sequência
de LOSS, tanto “todos os sinais” quanto “com a gestão diária global” (uma operação por vez entre ativos, parando
em 10 GREEN ou 3 LOSS).

> **Estado atual da validação:** o backtest com dados reais **ainda não foi executado** — o ambiente onde o
> projeto foi construído não tinha acesso à API da Binance. O relatório em `reports/backtest-synthetic.md` usa
> **dados sintéticos** e serve só para provar que o pipeline funciona: o gerador sintético tem regimes de tendência
> embutidos, então a taxa de acerto dele **não diz nada** sobre o mercado real. Rode o comando da Binance acima
> antes de tirar qualquer conclusão e, depois, valide em DEMO pelo painel.

### Pré-visualização sem a Quotex

```bash
cd m1-sniper-bot && python3 -m http.server 8765
# abra http://localhost:8765/dev/preview.html?reset
```

A página usa candles **sintéticos** e um relógio adiantado para que um sinal apareça em segundos.
Parâmetros: `?scenario=signal|idle|history|locked`, `&reset` apaga o estado salvo da página.

---

## 8. Estrutura

```
m1-sniper-bot/
├── manifest.json                 # MV3: content script na Quotex, service worker, storage
├── src/
│   ├── core/                     # puro, sem DOM: roda no navegador e no Node
│   │   ├── indicators.js         # EMA, SMA, RSI, ATR, ADX(+DI/−DI), Bollinger
│   │   ├── patterns.js           # engolfo, pin bar, rejeição, rompimento
│   │   ├── engine.js             # filtros + pontuação 0–100 → CALL/PUT/nada
│   │   ├── risk.js               # meta/stop diários, sem martingale, sem duplicidade
│   │   ├── stats.js              # acerto, drawdown, por ativo, validação DEMO→REAL
│   │   ├── history.js            # sinais e operações, resultado binário, CSV
│   │   └── settings.js           # padrões, saneamento, parser de CSV
│   ├── data/binance.js           # fonte independente (API pública documentada)
│   ├── background/service-worker.js  # busca candles fora da página da corretora
│   ├── content/controller.js     # orquestra feed → motor → risco → histórico (testável)
│   ├── content/main.js           # liga o controlador ao chrome.storage e ao painel
│   └── ui/panel.js, panel-styles.js  # painel em Shadow DOM (estilos isolados)
├── scripts/backtest.js           # backtest histórico com relatório
├── scripts/synthetic.js          # gerador sintético (somente testes)
├── tests/                        # node --test
├── dev/preview.html              # pré-visualização com dados sintéticos
└── reports/                      # relatórios de backtest
```

## 9. Privacidade e permissões

- `storage`: salvar configurações, contadores do dia e histórico **no seu navegador**.
- Acesso a `data-api.binance.vision` / `api.binance.com`: baixar candles públicos. Nenhum dado seu é enviado.
- O content script roda só nos domínios da Quotex listados no manifest e apenas desenha o painel.
