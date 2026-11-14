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
| qualquer ativo **OTC** | sinais, gráfico e tendência com o **preço lido da tela da corretora**; o resultado de cada sinal é conferido nesse mesmo preço |
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

## Tendência

Em qualquer ativo o painel mostra **tendência de alta**, **tendência de baixa** ou **lateralizado**, olhando as
últimas 15 velas fechadas: quão reto foi o movimento (índice de eficiência) e a EMA 9 contra a EMA 21.
Em OTC as velas são montadas a partir do preço que a corretora mostra na tela, então a tendência aparece
depois de ~16 minutos com o painel aberto naquele ativo (o histórico fica salvo). Se o preço não for achado,
use **Ajustes → Apontar preço** e clique no número do preço atual. Se a corretora desenha o preço só dentro
do gráfico (imagem), não há como lê-lo.

## Sinais em OTC

O indicador precisa de 30 velas para funcionar: em OTC elas são montadas com o preço da tela, então os sinais
começam depois de ~30 minutos com o painel aberto naquele ativo (as velas ficam salvas). O backtest também
roda nessas velas a partir de 60. O preço OTC é feito pela corretora: acompanhe a taxa de acerto real.

## Analisar próxima vela

Botão na aba Sinal. Ao clicar, ele procura no histórico do ativo (5.000 velas, ou as velas lidas da corretora em
OTC) todas as vezes em que RSI, Bollinger e EMA estavam como agora e conta o que o preço fez na expiração atual.
Mostra COMPRA ou VENDA, quantas vezes o padrão foi visto, a taxa e se ela passa do empate do payout. Até a vela
abrir a resposta acompanha o preço ao vivo, a expiração e o mercado da corretora; na abertura a entrada é travada e
o resultado é conferido como os outros sinais. O backtest mostra como esse botão foi em dados que ele não tinha visto.
