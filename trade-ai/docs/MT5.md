# Ponte MetaTrader 5 (execução automática da mesa Zyon)

**Somente conta DEMO.** O robô (`mt5/ZyonBridge.mq5`) recusa iniciar em conta real, e o servidor não entrega ordens se a conta informada não for demo.

## Como funciona

1. A mesa Zyon roda um ciclo (especialistas → Master → News → Risk Guard).
2. Se o Risk Guard aprovar e a ponte estiver **ligada**, a ordem entra numa fila no servidor (validade de 2 minutos).
3. O robô no MT5 consulta a fila a cada 10 segundos, confere tudo de novo (conta demo, spread, distância do preço, stop e alvo, lote mínimo) e executa.
4. O robô calcula o lote para arriscar **0,5% do saldo** até o stop, com os dados reais do símbolo na corretora.
5. Ele reporta a execução e o fechamento. A posição fecha no stop, no alvo ou em 60 minutos.

O servidor nunca conecta no seu computador: é o MT5 que chama o site. A senha da conta não sai do MetaTrader.

## Passo a passo

1. Abra uma conta **demo** na corretora e entre nela no MT5.
2. Na Vercel (Settings → Environment Variables), crie `MT5_BRIDGE_TOKEN` com um texto longo e aleatório e faça um novo deploy. Não envie o token nem a senha por chat.
3. No MT5: **Ferramentas → Opções → Expert Advisors** → marque "Permitir WebRequest para as URLs listadas" e adicione `https://trade-ai-five.vercel.app`.
4. **Arquivo → Abrir Pasta de Dados → MQL5 → Experts**: copie `ZyonBridge.mq5` para lá. Abra no MetaEditor e clique em **Compilar**.
5. Arraste o ZyonBridge para um gráfico qualquer. Em "Parâmetros de entrada", cole o token em `BridgeToken`. Se a corretora usa sufixo nos símbolos (ex.: `EURUSD.m`), preencha `SymbolSuffix`.
6. Ligue o botão **Algo Trading** do MT5.
7. No escritório: monitor → "Zyon · Mesa de agentes" → **Ligar a ponte MT5**.

## Para rodar 24h

O MT5 precisa ficar aberto. Com o computador desligado, nada é executado. Para funcionar o tempo todo, use uma VPS Windows (cerca de US$ 10 a 30 por mês) com o MT5 instalado.

## Limites e riscos

- As estratégias atuais não mostraram vantagem nos backtests. A ponte serve para medir em demo, não para gerar renda.
- Slippage e spread reais podem diferir da simulação.
- O robô foi escrito e revisado, mas **não foi compilado nem testado num MT5 real** neste ambiente (não há Windows aqui). O primeiro teste é na sua conta demo.
- Conta real: bloqueada no robô e no servidor. Só será liberada depois de meses de demo com resultado medido.
