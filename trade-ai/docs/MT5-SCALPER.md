# ZyonScalper: scalper dentro do MT5

O robô roda **dentro do MetaTrader 5**, com os ticks da sua corretora, sem atraso e sem passar pelo site.
Antes de deixar ele operar na demo ao vivo, ele **tem que passar no Testador de Estratégias**.

## A regra (rompimento da faixa de abertura)

1. Em Londres e em Nova York, marca a máxima e a mínima dos primeiros 15 minutos da sessão.
2. Depois disso, quando uma vela de M1 **fecha** fora da faixa (com folga de 0,5 pip), entra a favor do rompimento.
3. O stop fica no meio da faixa e o alvo vale 1,5 vez o risco.
4. Faz no máximo uma entrada por sessão e zera tudo 3 horas depois da abertura.

**Ele não entra quando:**
- a faixa tem menos de 5 pips (ruído) ou mais de 25 pips (stop grande demais);
- o spread está acima de 1,5 pip;
- já fez 2 entradas no dia ou já perdeu 1,5% no dia.

**Só funciona em conta demo:** em conta real o robô se recusa a iniciar. No Testador ele roda normalmente.

## Horários: confira antes de tudo

Os horários das sessões seguem o **relógio do servidor da corretora**, que é a hora mostrada na Observação do Mercado. O padrão (Londres 10:00, Nova York 16:30) vale para servidores no fuso GMT+2/+3, como o MetaQuotes-Demo e a maioria das corretoras. Se o seu servidor usa outro fuso, ajuste os dois horários.

## Passo 1: compilar

1. No MT5, abra **Ferramentas → MetaQuotes Language Editor** (F4).
2. Crie a pasta `MQL5/Experts/Zyon/` e coloque nela o arquivo `ZyonScalper.mq5`.
3. Abra o arquivo e clique em **Compilar** (F7). O resultado precisa ser **0 erros**. Se aparecer algum erro, mande o texto dele aqui.

## Passo 2: testar no Testador de Estratégias (obrigatório)

1. No MT5, vá em **Exibir → Testador de Estratégias** (Ctrl+R).
2. Configure assim:
   - **Expert:** Zyon\ZyonScalper
   - **Símbolo:** EURUSD (depois GBPUSD)
   - **Período:** M1
   - **Datas:** os últimos 12 meses
3. Em **Modelagem**, escolha **"Cada tick baseado em ticks reais"**. É o único modo que usa o spread real.
4. Em **Depósito**, coloque o mesmo valor da sua demo. Deixe o **Atraso** em "Atraso aleatório" ou em 50 a 100 ms.
5. Clique em **Iniciar**. Quando terminar, abra a aba **Backtest** e mande aqui os números, um print ou o relatório (clique com o botão direito → Relatório → HTML). Preciso destes números:
   - **Total de negociações** (precisa ser 100 ou mais para valer alguma coisa);
   - **Lucro líquido** e **Fator de lucro**;
   - **Rebaixamento máximo** do saldo e da equity;
   - **Negociações com lucro (%)**.

**Critério para passar (antes de olhar qualquer coisa ao vivo):**
- Fator de lucro **acima de 1,2** depois dos custos;
- pelo menos **100 operações**;
- resultado positivo **também nos 6 meses que não foram usados para ajustar parâmetros**.

**Não otimize parâmetros até ficar bonito.** Se você testar 500 combinações, alguma vai parecer ótima por puro acaso. Se o padrão não passar, a conclusão honesta é que a regra não tem vantagem nessa corretora.

## Passo 3: só se passou, colocar na demo ao vivo

1. Arraste o robô para um gráfico de EURUSD M1 na conta **demo**.
2. Marque **Permitir Algo Trading** e ligue o botão **Algo Trading** na barra do MT5.
3. Acompanhe pelo menos 100 operações e compare com o resultado do Testador. Se ao vivo der bem pior, é sinal de deslize e spread reais maiores que no teste.
