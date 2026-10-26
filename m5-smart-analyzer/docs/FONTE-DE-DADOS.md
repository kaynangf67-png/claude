# Fonte de dados: limitações e plano de integração

## Estado atual
- A única fonte real é **importação de CSV** (`timestamp, open, high, low, close[, volume]`).
- O aplicativo **não está conectado à Quotex**. Não pede login, senha, cookies ou tokens; não automatiza cliques nem ordens; não faz scraping.
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
