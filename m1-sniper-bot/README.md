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
6. Nada abre em outra página. **Clique no ícone da extensão** para mostrar ou ocultar o painel em cima do gráfico (funciona até em domínios da Quotex que não estão na lista). O horário já é o de Brasília e o payout é lido da Quotex.

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

Os ajustes (nota mínima, payout, validade do sinal; o horário é sempre o de Brasília), as estatísticas da DEMO, os critérios do modo REAL e a exportação do histórico ficam no botão **⚙** do próprio painel. O relatório completo continua disponível em `chrome://extensions` → M1 SNIPER BOT → **Detalhes → Opções da extensão**.

### Histórico sem espera pela conexão da página (v1.14)

Quando você abre um ativo, a Quotex baixa o histórico de velas pela conexão ao vivo da página (WebSocket), e o gráfico só desenha o que chegou. A extensão **observa essas mensagens recebidas, sem enviar nada** (`canvasTap.js` no mundo da página + `wsFeed.js`). Ela reconhece listas de velas (tempo + OHLC em ordens comuns, ou objetos), ticks (convertidos em velas de 1 minuto), o nome do ativo (ex.: `AUDCHF_otc` ↔ "AUD/CHF (OTC)") e as cotações ao vivo. Assim:
- o histórico entra direto nas velas do ativo: **sem aquecimento**, inclusive para estratégias com EMA 200, e também no **OTC**;
- a cotação recebida passa a ser a fonte preferida do **preço ao vivo** (mais exata que a leitura do gráfico).

Testado com uma conexão simulada no estilo socket.io (histórico binário + `quotes/stream`): 260 velas reconhecidas em ~2 s e preço ao vivo igual à cotação. O formato real da Quotex não é documentado nem pôde ser verificado daqui. Se não for reconhecido, **⚙ → COPIAR DIAGNÓSTICO** mostra a seção "conexão da página (WebSocket)" com os tipos de mensagem recebidos, para ajustar o leitor.

### Fonte "Quotex": o bot acompanha o gráfico da própria Quotex (v1.5 / v1.9)

**v1.9 — leitura do que o gráfico DESENHA:** a Quotex desenha o preço e a legenda OHLC dentro do canvas (não há texto na página). A extensão observa os textos que a página desenha (`fillText`) por um script no mundo da página (`src/content/canvasTap.js`), **sem alterar** o desenho, e extrai:
- **preço ao vivo (automático, v1.9.4)**: a Quotex desenha vários números que mudam, cada um num canvas próprio. O bot usa o **maior grupo de números que concordam entre si** (mesma cor, valores a menos de 0,05% um do outro, ritmo de ticks de 0,5 a 8 por segundo) e pega o valor do meio. Animações muito rápidas e marcações quase paradas ficam de fora. Se houver ambiguidade, ele não chuta. Para o caso de o automático errar, ainda dá para escolher manualmente em **⚙ → Preço ao vivo → ESCOLHER** (e **VOLTAR AO AUTOMÁTICO**);
- **legenda Abertura/Fechamento/Alto/Baixo** quando o mouse do Chrome passa pelo gráfico, o que permite ler o **histórico** em ~20 s.
Testado com um gráfico 100% em canvas que só aceita mouse real: preço ao vivo lido; 94 velas de histórico, 92/92 conferidas iguais.

Com a fonte **Quotex** (padrão), o bot lê o **preço ao vivo da tela** e monta as velas M1 sozinho. Assim ele analisa exatamente o gráfico que você vê, **inclusive OTC**, e sinais e AUTO funcionam também no OTC.

1. Em ⚙ → Calibração, calibre **Comprar** e **Vender**. O preço é lido sozinho: se o rótulo azul do eixo for texto, ele é usado (calibre em **Preço ao vivo**); se for desenhado no gráfico (canvas), o bot usa a **legenda do gráfico** ("Fechamento: …"). Enquanto o mouse está sobre o gráfico, a leitura pausa, porque a legenda mostra a vela apontada.
   Se algo não for lido, use **⚙ → COPIAR DIAGNÓSTICO** e envie o texto: ele mostra só a estrutura do painel (nomes de elementos e textos visíveis).
2. **Histórico pelo gráfico (v1.7)**: quando um ativo precisa de aquecimento, o bot tenta ler o histórico do **próprio gráfico**. Ele passa um "mouse virtual" sobre as velas e lê a legenda Abertura/Fechamento/Alto/Baixo de cada uma (~10–15 s, sem mexer o mouse no gráfico). Só aceita o resultado se a vela atual bater com o preço ao vivo, o espaçamento for regular (vela faltando = usa só o trecho contínuo) e Alto/Baixo forem coerentes. Para mais velas, afaste o zoom do gráfico (60+ visíveis). Para repetir: **⚙ → LER HISTÓRICO DO GRÁFICO**.
   Se o gráfico ignorar o mouse simulado (caso da Quotex), o bot usa o **mouse do Chrome** (`chrome.debugger`, permissão "debugger"). Durante a leitura (~15 s), o Chrome mostra a faixa amarela *"M1 SNIPER BOT começou a depurar este navegador"*. Ela some ao terminar. O bot só move o mouse sobre o gráfico, não clica, e se desconecta logo em seguida. Testado numa imitação da Quotex (150 velas, 100% iguais ao gráfico); na Quotex real depende de o gráfico responder ao mouse simulado.
3. **Modo rápido (v1.11)**: a Quotex não fornece histórico, então o bot monta as velas ao vivo. Com **12 velas (~12 min)** ele já analisa e opera, usando versões curtas dos mesmos indicadores: EMA 3/6/10, RSI 6, ADX 5 e Bollinger 10/2. As regras não mudam: nota mínima 80, vetos e travas. Com **60 velas** passa sozinho ao modo completo (EMA 9/21/50, RSI 14, ADX 14, Bollinger 20/2) e, com 260, usa a EMA 200. Indicadores curtos reagem mais rápido, mas erram mais: valide na DEMO.
   Antigo aquecimento: Com **60 velas (~1 h)** ele já sinaliza, usando a **EMA 50** como tendência longa. Com **260 velas**, passa para a **EMA 200** da regra original.
4. As velas ficam salvas por ativo: recarregar a página ou trocar de aba rapidamente não perde o aquecimento. Uma pausa maior que 2 minutos recomeça a contagem, porque velas faltando distorceriam os indicadores.
5. Limitações: máximas e mínimas vêm de leituras a cada 250 ms, então podem diferir levemente das velas da Quotex. A lista de "Mercados indicados" continua usando a Binance como referência.

Para voltar a usar a Binance (só cripto, sem OTC), mude **Fonte das velas** em ⚙.

### Sincronização com a Quotex

O bot acompanha o que você muda na Quotex, sem precisar mexer no painel:
- **Trocou de ativo** (aba ou painel de operação) → o bot passa a analisar o mesmo ativo. Se o bot não perceber a troca, use **⚙ → Calibração → Ativo** e clique no **nome do ativo aberto**, no topo do painel da direita, acima do Tempo. A partir daí ele vigia esse ponto da tela e acompanha as trocas sozinho, junto com o payout. O ponto indicado por você tem prioridade sobre a detecção automática. Isso vale também para OTC (Bitcoin (OTC) → BTC/USD), mas nesse caso os indicadores servem só de **referência**: o preço OTC é da Quotex, e sinais e AUTO ficam desligados.
- **Mudou o Investimento** → o valor do bot muda junto. O valor **não é digitado no bot**: ele é só exibido, lido do Investimento da Quotex (sem Martingale continua valendo).
- **Mudou de mercado com outra %** → o payout do bot muda junto.

### Payout e valor automáticos

- **Payout:** o bot lê a **%** do mercado aberto, na aba do ativo da Quotex (ex.: "Ethereum 85%"), e ajusta o payout sozinho a cada troca de mercado. O painel mostra "Payout 85% (lido da Quotex, automático) · empata com 54,1% de acerto". Abaixo de 75%, a linha fica vermelha: com payout baixo é preciso acertar muito mais para não perder.
- **Valor:** o valor do bot segue o campo **Investimento** da Quotex. As regras continuam valendo: depois de um LOSS, aumentar o valor na Quotex é recusado (sem Martingale) e o item "Valor" mostra o motivo.
- Percentuais nunca são confundidos com o valor da operação.

### Modo SOMENTE SINAIS (padrão desde a v1.15)

O bot **não opera**: ele só mostra **▲ COMPRA** ou **▼ VENDA** (com som), o horário de entrada e a contagem para você entrar manualmente na Quotex (1 min). O botão AUTO fica oculto, e o redutor recusa armar ou entrar sozinho. Cada sinal tem o resultado medido na vela seguinte, e o painel mostra o **acerto medido** (*"acerto medido: X% em N sinais (hoje …)"*), em verde só se passar do empate (~54%). **Nenhum sinal é garantia de acerto.**

### Modo AUTO (opcional, desativado)

1. No painel, clique em **⚙ → Calibração do automático** e calibre só os botões **Comprar (CALL)** e **Vender (PUT)**: clique em **CALIBRAR** e depois no botão da Quotex. Durante a calibração, o clique é **bloqueado** e não abre operação. **Esc** cancela.
   A partir do botão Comprar, o bot acha sozinho o **painel de operação** da Quotex e lê ali o **ativo e a %** (cabeçalho "Bitcoin 80%"), o **Tempo** (00:01:00), o **Investimento** e o **Pagamento**. Calibrar o ativo e o valor é opcional e só serve de reserva.
2. Na Quotex, deixe a **expiração em 1 minuto** e o **valor igual** ao do painel.
3. Clique em **🤖 AUTO DESLIGADO**, leia o aviso e confirme. O botão fica roxo: **AUTO ARMADO**.
4. O painel mostra, ao vivo, as condições exigidas, e **todas** precisam estar ✓ para o bot clicar:
   - **Calibrado** (painel de operação encontrado);
   - **Tempo**: o tempo da Quotex precisa ser 00:01:00;
   - **Conta**: a página DEMO/REAL precisa ser igual ao modo do bot (REAL só depois da validação);
   - **Mercado aberto**: o ativo aberto na Quotex é o analisado (OTC nunca entra);
   - **Valor**: o valor no campo da Quotex é igual ao do painel.
5. Quando uma vela fecha com sinal ≥ 80 nesse mercado, o bot clica CALL/PUT em até 6 s da abertura da vela seguinte. Depois disso, não entra mais.
6. Depois da expiração, confira na Quotex e registre GREEN/LOSS. Se você não registrar em 45 s, o bot registra o resultado medido na fonte (Binance).

**Confirmação da operação (v1.10):** depois de clicar, o bot confere o contador **"Operações"** da Quotex. Se ele não subir em 2,5 s (a Quotex ignorou o clique simulado), o bot repete com um **clique real do Chrome** (`chrome.debugger`; a faixa de depuração aparece por um instante) e confere de novo. Se mesmo assim não abrir, cancela o registro, desarma o AUTO e avisa. A segunda tentativa só acontece quando o contador foi lido e não subiu, para evitar operação duplicada. Testado de ponta a ponta numa imitação com botões que só aceitam clique real: sinal → clique simulado ignorado → clique real → 1 operação aberta.

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

## 4a. Estratégia "Price action" — padrão desde a v1.13

Sem indicadores (`src/core/strategies/priceAction.js`). **COMPRA** quando tudo abaixo vale na vela fechada (VENDA: o espelho):
1. **Tendência de alta** pela estrutura: os 2 últimos topos e os 2 últimos fundos subindo (topo/fundo = maior/menor que 2 velas de cada lado, confirmado);
2. **Fibonacci** do último impulso (fundo → topo, de pelo menos 2 ATR): correção entre **38,2% e 78,6%**;
3. **Pullback**: 2+ velas de correção, sem romper o início do impulso;
4. **Suporte**: a correção parou em um nível anterior (topo ou fundo antigo, tolerância 0,35 ATR);
5. **Vela de rejeição**: vela de alta fechando nos 40% superiores da vela;
6. **Espaço até a resistência** (topo do impulso) de pelo menos 0,3 ATR.

Precisa de **30 velas** (~30 min no OTC). **Backtest honesto** (BTC/ETH/SOL/BNB/XRP, M1, entrada na vela seguinte): na última semana, 1.328 sinais com **53,0%**; nas duas semanas anteriores, sem mudar nada, 2.752 sinais com **49,8%**. O break-even é 54,1%, então não há vantagem consistente comprovada.

## 4b. Estratégia "M1 SNIPER PRO" (script Pine do usuário) — padrão desde a v1.12

Tradução fiel do script Pine v6 do usuário (`src/core/strategies/sniperPro.js`), com os indicadores no padrão do TradingView (EMA semeada com SMA; RSI/ATR/DMI com RMA). **COMPRA** quando todas as condições abaixo valem na vela **fechada** (VENDA: o inverso):
- tendência: preço > EMA 200, EMA 9 > EMA 21 e EMA 200 subindo (vs. 3 velas atrás);
- força: ADX(14,14) ≥ 18 e +DI > −DI;
- RSI 14 entre 52 e 72 (venda: 28 a 48);
- MACD 12/26/9: histograma > 0 e subindo;
- pullback: a vela anterior tocou a EMA 9 ou a EMA 21;
- vela de alta, fechando acima da EMA 9, com corpo ≥ 0,15 × ATR 14;
- pelo menos 3 velas desde o último sinal.

Trocar em **⚙ → Estratégia**. Precisa de **204 velas** (EMA 200 + 3): com a fonte Binance o histórico vem na hora; no OTC da Quotex, o bot junta as velas ao vivo (~3,4 h).

**Backtest honesto (dados reais, sem olhar o futuro, entrada na vela seguinte):**

| Teste | Sinais | Acerto | Resultado (payout 85%) |
|---|---|---|---|
| M1, 7 dias, BTC/ETH/SOL/BNB/XRP | 919 | **46,8%** | −118 entradas |
| M5, 20 dias, mesmos ativos | 623 | **48,6%** | −62 entradas |

O break-even é 54,1%. **Por que o script parece 100% certeiro no TradingView:** ele só dá COMPRA em vela de alta e VENDA em vela de baixa, então a **vela onde a seta aparece** vai na direção da seta em ~98% dos sinais (medido). Mas a operação abre **na vela seguinte**, e é essa que decide o resultado. Para conferir de verdade, anote o resultado da **vela depois da seta**.

## 5. Gerenciamento de risco (fixo, não configurável)

- **10 GREEN/dia** ou **3 LOSS/dia** bloqueiam o dia. O painel desliga e não religa até a virada do dia local.
- O horário é **fixo em Brasília** (`America/Sao_Paulo`), sem opção de troca: o dia vira à meia-noite de Brasília. Instalações antigas em outro fuso são ajustadas sozinhas, sem zerar contadores nem liberar bloqueio. Os contadores só reiniciam quando a data **avança**: atrasar o relógio não desbloqueia.
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
npm test                                    # 56 testes: indicadores, padrões, motor, travas, REAL, AUTO, leitura da Quotex
node scripts/backtest.mjs --symbol BTCUSDT,ETHUSDT,SOLUSDT --days 7 --tz America/Sao_Paulo
node scripts/backtest.mjs --csv meus_candles.csv --symbol EURUSD   # CSV: time,open,high,low,close
node scripts/backtest.mjs --symbol BTCUSDT,ETHUSDT --days 7 --strategy sniperPro   # seu script
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

## 9. Problemas comuns

| O painel mostra | Causa e solução |
|---|---|
| **Dados atrasados** | Na versão 1.3.1, o horário é corrigido pelo servidor de dados. Se o relógio do PC estiver errado, o painel avisa "⏱ relógio do PC adiantado/atrasado X s (corrigido)". Se continuar atrasado, verifique a internet. |
| **Valor ✗ "não lido"** | Refaça a calibração do valor em ⚙, clicando no **número** do Investimento. Valores como `5,000 R$` são lidos como 5000; `2,50 R$`, como 2,50. |
| **Mercado aberto ✗ "aba ativa não identificada"** | A calibração pegou a barra de abas e a Quotex não marcou a aba ativa de um jeito reconhecível. Refaça clicando **no nome do ativo aberto** (ex.: "Ethereum"). Se a barra marcar a aba ativa (classe `active`/`selected`), o bot escolhe a aba certa sozinho. |
| **Mercado aberto ✗ "não lido"** | Refaça a calibração clicando no **nome do ativo** no topo do gráfico. São aceitos pares ("BTC/USD") e nomes ("Bitcoin"). |
| **Mercado aberto ✗ "OTC não tem fonte externa"** | Ativos **OTC** têm preço gerado pela própria corretora (comum nos fins de semana). O bot não tem como analisá-los e nunca opera neles. Abra um ativo de cripto sem OTC. |

A calibração guarda o caminho do elemento, as classes, o texto e a posição na tela. Se a Quotex redesenhar a página, o bot procura o elemento por esses dados. Testado com a página redesenhada (outro aninhamento).

## 10. Limitações conhecidas

- Os preços vêm da Binance, não da Quotex, e a diferença pode mudar o resultado de operações de 1 minuto.
- A detecção de ativo e de conta na página da Quotex depende do título e da URL, que a Quotex pode mudar sem aviso. Esses pontos não foram verificados na Quotex real porque não há acesso a ela neste ambiente.
- O motor não considera notícias, spread nem latência de execução manual.
- O backtest mede o fechamento contra a abertura do candle seguinte. Na prática, a sua entrada manual acontece alguns segundos depois.
