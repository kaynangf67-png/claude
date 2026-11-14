# Sinal Honesto — extensão

Painel flutuante de sinais M1 por cima de qualquer corretora na web. Ele lê o ativo e o payout que a
corretora mostra na tela, troca junto quando você troca de ativo e mostra UP/DOWN, contagem
e a taxa de acerto real. **Não opera sozinho e não clica em nada na corretora.**

## Instalar (Chrome, Edge, Brave ou Opera no computador)

1. Baixe `sinal-honesto-extensao.zip` e descompacte numa pasta.
2. Abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ligue o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha a pasta descompactada.
5. Fixe o ícone do robô na barra.

## Usar

- Abra a corretora, clique no ícone (ou **Alt+S**). O painel aparece; arraste pela barra de título,
  redimensione pelo canto, minimize com "–".
- Com **"Seguir mercado, payout e valor da corretora"** marcado, cada mercado que você abre aparece no
  painel com o payout e o valor da entrada. Sozinho, ele procura o maior "XXX/YYY" (ou Bitcoin, Gold…)
  visível, o "92%" mais próximo e o campo "Valor / Investimento / Amount".
- Expiração ("00:01:00", "1 min", "M1") e fuso ("UTC-3") também são lidos da corretora; na aba **Ajustes** aparece o que foi lido.
- **Apontar** (funciona em qualquer corretora e com qualquer mercado, inclusive ações como "Apple OTC"):
  clique em **Apontar mercado** e depois no nome do mercado na corretora; faça o mesmo com **Apontar payout**
  **Apontar valor** e **Apontar expiração**. Ele lembra esses pontos para aquele site. **Esquecer pontos** volta ao automático.
- Depois de recarregar a página da corretora, clique no ícone de novo.

## O que ele segue

| Na corretora | No painel |
|---|---|
| BTC/USD, ETH/USD, SOL/USD, BNB/USD, XRP/USD | o par em USDT da Binance |
| EUR/USD | EUR/USDT (segue o EUR/USD) |
| XAU/USD (ouro) | PAXG/USDT |
| qualquer ativo **OTC** | sinais e gráfico com o **preço lido da tela da corretora**; o resultado de cada sinal é conferido nesse mesmo preço |
| outros pares (AUD/CHF, GBP/JPY…) | igual ao OTC |

## Privacidade

Permissões só `activeTab` e `scripting`: a extensão só roda na aba em que você clicou no ícone.
Ela não lê senhas nem saldo, não envia nada da página para lugar nenhum; o único acesso à internet é
o preço público da Binance.

## Celular

O Chrome do Android não aceita extensões. No celular, use a página `sinais.html` do site.

## Atualizar

O painel é a mesma página do site (`frontend/public/sinais.html` + `sinais.js`).
Depois de mudar a página, rode `./build.sh` para copiar para cá e gerar o zip.

## Sinais em OTC

O indicador precisa de 30 velas para funcionar: em OTC elas são montadas com o preço da tela, então os sinais
começam depois de ~30 minutos com o painel aberto naquele ativo (as velas ficam salvas). O backtest também
roda nessas velas a partir de 60. O preço OTC é feito pela corretora: acompanhe a taxa de acerto real.

## Sinalizar entrada

Botão na aba Sinal. Ao clicar, o scanner percorre as velas e dá a entrada na hora (COMPRA ou VENDA ao preço atual,
com a expiração da corretora). Ordem da leitura:
1. **Padrões de vela** nas últimas velas fechadas: estrela da manhã/noite, três soldados/corvos, engolfo, harami,
   pinça de fundo/topo, martelo, estrela cadente, martelo invertido, enforcado, doji e marubozu. O padrão aparece
   marcado no gráfico e, quando há histórico, quanto ele acertou neste ativo.
2. Sem padrão claro: a leitura RSI/Bollinger/EMA no histórico.
3. Sem histórico: a direção das últimas velas.
Precisa de só 7 velas fechadas, então em OTC sai entrada rápido (em S5, menos de 1 minuto).

O painel segue o **tempo gráfico** da corretora (S5, S15, S30, M1, M5, M15, H1…). Se não for achado, use
**Ajustes → Apontar tempo gráfico**.
