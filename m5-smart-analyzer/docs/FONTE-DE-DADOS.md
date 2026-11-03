# Fonte de dados: limitações e plano de integração

## Estado atual
- Fontes: **CSV** (candles M5 fechados), **feed ao vivo da Binance** (cripto, API pública, consulta a cada 5 s, sem chave) e, no teste histórico, **CSV de 1 minuto do MT5** ou a Binance.
- O feed ao vivo dá o candle em formação e o cronômetro, mas é **cripto**: se você opera forex/ações na Quotex, ele não representa o seu ativo.
- A importação de CSV principal (`timestamp, open, high, low, close[, volume]`).
- O aplicativo **não está conectado à Quotex**. A Binance é só uma fonte pública de cotações de cripto, sem relação com a corretora. Não pede login, senha, cookies ou tokens; não automatiza cliques nem ordens; não faz scraping.
- **Não há garantia de que os preços de um CSV sejam iguais aos da Quotex.** Preços de corretoras e, sobretudo, de ativos **OTC** (cotados pela própria corretora)
  podem diferir de qualquer outra fonte. O app mostra a origem informada por você e não presume equivalência.
- Dados fictícios (demonstração e CSV marcado como sintético) são identificados em toda a interface, gravados como `synthetic` no histórico e **nunca entram** nas comparações.

## Validação da importação
Rejeita o arquivo inteiro se houver: coluna ausente, valor não numérico, preço ≤ 0, `high` < `open/close`, `low` > `open/close`, timestamp inválido/duplicado ou sem fuso (quando necessário).
Ordena cronologicamente (e avisa). Lacunas são **listadas, nunca preenchidas**; uma lacuna dentro da janela analisada torna a análise "não avaliável".
Limites: 100 000 linhas / 10 MB.

## Integração futura (viabilidade)
- Pesquisei e **não encontrei uma API pública oficial da Quotex** ([resumo de terceiros](https://www.classace.io/answers/api-quotex)); isso **não foi confirmado** no site oficial. Existem bibliotecas **não oficiais** (engenharia reversa de WebSocket),
  que podem violar os termos de uso, quebrar a qualquer momento e exigem credenciais. **Não serão usadas.**
- Caminho viável: uma fonte **autorizada** (provedor de cotações com API documentada, ou exportação de uma plataforma de gráficos que permita), mapeada para o tipo `Candle`
  (`src/core/types.ts`) por um adaptador que entregue `Candle[]` fechados. O motor não precisa mudar.
- Para o filtro de candle em formação (F2/F4) e o gatilho (G1/G3) é preciso **dados em tempo real intra-candle** (ticks ou candle parcial). Isso requer backend/stream autorizado; documentar antes de implementar.
- Comparar preços de um provedor com o gráfico da Quotex ao longo de um período é pré-requisito para qualquer afirmação de equivalência.

## Licença do gráfico
O gráfico usa `lightweight-charts` (TradingView, Apache-2.0). O logo de atribuição do próprio gráfico está **mantido ligado** (opção `attributionLogo`), o que a documentação indica como forma de cumprir a exigência de crédito; não o desligue sem ler a LICENSE.

## Ao vivo e ativos reais da Quotex
- Pesquisa: [Twelve Data](https://support.twelvedata.com/en/articles/5335783-trial) só tem WebSocket completo a partir do plano pago Pro (o grátis tem 8 créditos/dia); Finnhub: fontes divergentes sobre forex ao vivo no plano grátis (não confirmado). A Binance tem dados públicos de cripto sem chave ([docs](https://developers.binance.com/docs/binance-spot-api-docs/faqs/market_data_only)).
- Antes de confiar em qualquer fonte para o seu ativo, compare o gráfico dela com o da Quotex por alguns dias (topos, fundos, pavios e horário dos candles).
- Dado do MT5: o horário exportado é o do **servidor** da corretora do MT5, não UTC; serve para alinhar velas, não para ler a hora real.

## Forex via MetaTrader 5

Existe um caminho de leitura para forex: script MQL5 somente leitura → arquivo → agente/ponte local. Passo a passo, limites e riscos (principalmente: preço da corretora do MT5 ≠ preço da Quotex) em [`MT5.md`](MT5.md).
