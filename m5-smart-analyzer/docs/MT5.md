# Forex ao vivo pelo seu MetaTrader 5 (somente leitura)

O MT5 não fala direto com o app. O caminho é este:

```
MT5  →  script M5Exportador (grava um arquivo)  →  agente ou ponte local (lê o arquivo)  →  app / agente de simulação
```

**O que isto faz:** leva os candles de 1 minuto do seu MT5 para o app, que monta os M5 e o candle em formação. Assim o modo simples e o agente de simulação enxergam forex ao vivo.

**O que isto NÃO faz:** não abre, fecha nem modifica ordens; não usa senha, chave, DLL nem internet; não se conecta à Quotex. O script só lê o histórico do terminal e escreve um arquivo CSV. Existe um teste automático (`src/agent/mt5.test.ts`) que reprova se aparecer qualquer chamada de ordem, DLL ou rede no script.

## Aviso importante sobre os preços

O preço é o da **corretora do seu MT5**. A Quotex tem feed próprio, e o par que você opera lá (principalmente em OTC) pode diferir em centavos de pip ou mais. O app **não consegue** garantir que o candle que ele vê é o mesmo da Quotex. Antes de confiar em qualquer sinal, compare o gráfico do app com o da Quotex por alguns dias. Se divergirem nos toques de zona, o sinal não serve para a Quotex.

## Passo a passo (Windows)

1. **Copie o script.** Arquivo `mql5/M5Exportador.mq5` deste projeto. No MT5: *Arquivo → Abrir pasta de dados* → `MQL5` → `Scripts` e cole lá.
2. **Compile.** No MT5 aperte **F4** (abre o MetaEditor), abra o arquivo e aperte **F7**. Deve aparecer "0 errors". **Eu não consegui compilar este script aqui** (não há MetaEditor neste ambiente): se aparecer erro, copie a mensagem e me mande.
3. **Rode.** Abra o gráfico do par (ex.: EURUSD) no MT5. No painel *Navegador → Scripts*, arraste **M5Exportador** para o gráfico. Na janela, aba *Entradas*:
   - `InpSymbols`: os pares como aparecem no seu MT5, separados por vírgula (ex.: `EURUSD,GBPUSD`). Corretoras às vezes usam sufixo (`EURUSD.a`, `EURUSDm`): use o nome exato.
   - `InpBars`: deixe 720 (cerca de 12 horas de M1).
   - Deixe o botão de **algotrading** (negociação algorítmica) do MT5 como estiver: o script não precisa dele, pois não negocia. Se pedir "Permitir trading", não é necessário marcar.
4. **Confira o arquivo.** Em *Arquivo → Abrir pasta de dados*, suba um nível e abra `Terminal\Common\Files`. Deve existir `m5exp_EURUSD_M1.csv`, atualizado a cada segundo. O caminho costuma ser `C:\Users\SEU_USUARIO\AppData\Roaming\MetaQuotes\Terminal\Common\Files`.
5. **Deixe o script rodando** enquanto quiser dados. Para parar, tire o script do gráfico. O MT5 precisa estar aberto e conectado à corretora.

## Indicador no gráfico do MT5 (sem app, sem ponte)

`mql5/M5Retracao.mq5` desenha as zonas e mostra o sinal **direto no gráfico do MT5**: VENDA/COMPRA AGORA, ZONA TOCADA, NÃO ENTRE ou AGUARDE, o cronômetro do M5 e a lista de critérios. Também toca alerta quando dá entrada e desenha uma **seta** no candle (▼ venda, ▲ compra) no preço em que o sinal surgiu. Quando o candle fecha, escreve ao lado **ganhou** ou **perdeu** (fechamento do M5 contra o preço da seta) e o painel soma os sinais do gráfico. Os sinais só existem a partir do momento em que o indicador está rodando (não há como recriar o passado, porque a entrada depende do candle em formação). Somente leitura: não negocia.

1. MetaEditor (**F4**) → **Arquivo → Novo → Indicador personalizado → Avançar**. No nome, mantenha o começo `Indicators\` e troque o final para **`Indicators\M5Retracao`**. Avançar até **Concluir**.
2. **Ctrl+A**, apague, cole o conteúdo de `mql5/M5Retracao.mq5`, **Ctrl+S** e **F7**. Precisa dar `0 errors`.
3. No MT5: **Ctrl+N** → **Indicadores** → botão direito → **Atualizar** → arraste **M5Retracao** para o gráfico. Use o gráfico em **M5** para ver as zonas no lugar certo (ele sempre calcula com velas M5, mesmo em outro tempo gráfico).

O que você precisa saber:
- É uma versão **simplificada** do motor do app. Calcula: zonas, toques com retração, zona armada (2 toques), cronômetro 2:30, F1, F2, F3, velas anteriores e 2 toques com pavio. **Não** avalia a vela lenta/parada (F4) nem os filtros de contexto do app. Por isso pode mostrar ENTRADA onde o app mostraria outra coisa. Em caso de dúvida, o app é a referência.
- Os valores de zona e retração são os **exploratórios** (não vêm da aula), os mesmos do modo simples. Dá para mudar na aba **Parâmetros de entrada**.
- Não foi compilado aqui (não há MetaEditor neste ambiente). Se der erro no F7, mande a mensagem.

### Filtros e padrões: medir antes de exigir

Em cada seta o indicador **anota** (não bloqueia) o que havia no último candle fechado:
- **Médias 9/21 a favor** (rápida abaixo da lenta para venda, acima para compra);
- **Rejeição**: pavio do lado da zona com pelo menos 50% da amplitude;
- **Engolfo a favor**: o último candle tem a cor da operação e o corpo cobre o corpo do anterior, de cor oposta;
- **Doji**: corpo com no máximo 10% da amplitude;
- **No pavio da vela H1**: o preço de entrada está dentro do pavio da **última vela H1 fechada** do mesmo lado (pavio de cima para venda, de baixo para compra). Ideia sua, não da aula. Os dois pavios aparecem desenhados no gráfico com borda pontilhada.
- **Exaustão**: o último candle fechado tem amplitude de pelo menos 1,5× a média dos 10 anteriores (`InpExhaustMult`);
- **RSI extremo**: RSI(14) de Wilder no último candle fechado ≥ 70 numa venda ou ≤ 30 numa compra.

Sequência de velas da mesma cor não entrou como anotação porque a aula 2 já usa isso como filtro de NÃO entrada (F3: 3 velas iguais bloqueiam).

Quando dá ENTRADA, o painel mostra **"Entre até HH:MM:SS | expira HH:MM:SS"**: até quando ainda restam 2:30 no candle e quando o M5 fecha, no relógio do computador.

Para limpar o gráfico, o indicador desenha **só as zonas armadas** (2+ toques). Para ver todas, ponha `InpOnlyArmed = false`.

O painel mostra, para cada um, *com* × *sem* (ganhou/perdeu). Cada sinal resolvido também é gravado em **`m5sinais_PAR.csv`** (pasta comum). Em **Histórico → Sinais do indicador MT5** o app abre esse arquivo e diz, com intervalo de confiança, se a diferença é real ou ruído.

Só depois de umas 50 ou mais entradas, e se um filtro separar com folga, ligue-o como obrigatório nos parâmetros (`InpUseMA`, `InpReqRejection`, `InpReqEngulf`, `InpReqH1`; exaustão e RSI por enquanto só são registrados). As definições acima são fixas de propósito: mudar até "dar certo" é a forma mais comum de se enganar.

## Usar no app (modo simples)

1. Na pasta do projeto, em outro terminal: `npm run ponte` (usa a pasta padrão acima; senão `npm run ponte -- --pasta "CAMINHO\Common\Files"`). Ou dê dois cliques em `agent\iniciar-ponte.bat`.
2. Abra o app e toque em **Cripto** no topo para mudar para **Forex · MT5**. Os pares aparecem como chips; o resto da tela é igual.
3. Se aparecer "ponte não encontrada", a ponte não está rodando. Se aparecer "dados parados", o script está parado ou o mercado está fechado (fim de semana).

Detalhes técnicos que importam:
- A ponte escuta **somente** em `127.0.0.1:8765`. Nada sai do seu computador, e ela só aceita pedidos do app publicado, de `localhost` ou do modo de desenvolvimento.
- O app publicado na Vercel é HTTPS e a ponte é HTTP local. Chrome e Edge costumam permitir isso para o seu próprio computador e, em versões recentes, podem pedir uma permissão para acessar a rede local: aceite. **Não testei em navegador real com a ponte; testei só no Chromium automatizado. Safari e navegadores de celular podem bloquear.** Para esses casos, rode o app localmente (`npm run dev`).
- O app aberto no **celular** não enxerga a ponte do seu PC. Para o celular, a opção é o agente de simulação no PC (abaixo), que grava o diário.

## Usar no agente de simulação 24 h

```
npm run agente -- --exploratorio --fonte mt5 --simbolos EURUSD
npm run agente -- --exploratorio --fonte mt5 --pasta "C:\...\Common\Files" --simbolos EURUSD,GBPUSD
```

O agente lê o mesmo arquivo, registra entradas **virtuais** e resolve no fechamento do M5. Se o arquivo ficar parado por mais de 3 minutos, ele **não analisa** (registra aviso) em vez de usar dado velho.

## Limitações conhecidas

- **Buracos no M1.** O MT5 não cria candle de 1 minuto sem negociação. Em pares menos líquidos ou fora do horário ativo, alguns minutos faltam. O leitor **descarta** o M5 incompleto em vez de inventar o minuto; isso deixa lacunas, e uma lacuna dentro da janela analisada faz o app marcar o cenário como **não avaliável** (decisão de segurança: ele não analisa sobre dado com buraco). Em pares muito parados isso pode acontecer com frequência; nesse caso o par simplesmente não serve para este método.
- **Horário.** O script converte o horário do servidor do MT5 para UTC usando a diferença atual (`TimeTradeServer() - TimeGMT()`). Se houver mudança de horário de verão do servidor dentro das últimas 12 horas exportadas, as horas anteriores à mudança ficam deslocadas em 1 h. Não afeta o candle em formação.
- **Volume** é volume de ticks, não volume real.
- **Corretora x Quotex**: ver o aviso no topo. Isso é o maior risco do plano, e nenhum código resolve.
- O script não foi compilado nem executado em um MT5 real por mim. O leitor e a ponte foram testados com arquivos no mesmo formato.

## TradingView

Não implementei. Para ler dados do TradingView seria preciso um indicador em Pine Script mais alertas/webhook ou exportação manual de CSV, e o que está disponível depende do seu plano; eu não consigo testar Pine aqui. Se o MT5 resolver, não há motivo para trocar.
