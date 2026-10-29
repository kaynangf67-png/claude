# M5 Smart Analyzer

Aplicativo de **análise técnica informativa** de candles M5 para o operacional de retração. Interface em português do Brasil.

> **Aviso:** análise técnica não garante resultados e operações de curto prazo podem causar perdas financeiras. O aplicativo **não executa operações**, **não está conectado à Quotex** (nem a nenhuma corretora) e não pede credenciais. Ele analisa candles que **você importa em CSV**.

Subprojeto independente dentro do repositório (não depende dos outros projetos da raiz).

## Instalação e execução

```bash
cd m5-smart-analyzer
npm install
npm run dev        # http://localhost:5173
npm test           # 236 testes do núcleo, do agente, do simulador e das camadas do gráfico
npm run build      # typecheck + build de produção (dist/)
npm run preview    # serve o build
```

Requer Node 22+. Para começar sem dados: **Demonstração** (fictícia) no Dashboard, ou **Configurações → Fonte de dados → Importar** com
[`public/exemplo-sintetico.csv`](public/exemplo-sintetico.csv) (240 candles fictícios; é marcado como sintético automaticamente).
Regenerar o exemplo: `npx jiti scripts/gerar-exemplo.ts`.

## Como usar

**Modo simples (tela inicial):** abre sozinho, conecta à Binance e mostra uma tela só: o **sinal** (VENDA agora, COMPRA agora, Zona tocada, NÃO ENTRE, Aguarde), o cronômetro do candle, o gráfico com as zonas e 7 critérios com ✓/✕. Sem botões de configuração. Também tem **🔔 Alerta** (som, vibração e título piscando quando surge ENTRADA em qualquer par; o navegador exige um toque para liberar o som) e o **limite do dia**: você registra cada operação real (+ Ganhei / − Perdi / Empate) e, ao bater o limite que definir (padrão: 3 perdas; opcional em R$), a tela mostra **PARE POR HOJE** até a meia-noite. O **Modo avançado** (link no topo) traz todas as abas abaixo.

1. Importe um CSV (`timestamp,open,high,low,close[,volume]`). Se os horários não trouxerem fuso (`Z`, `-03:00`), escolha o fuso do arquivo.
2. Em **Configurações**, defina os parâmetros que a aula não fornece (ou use os valores *exploratórios*, que **não vêm da aula**). Sem isso, os filtros ficam **pendentes**.
3. **Ao vivo** (opcional): conecta à API pública da Binance (**cripto**) ou, para **forex**, ao seu MetaTrader 5 por um script somente leitura ([`docs/MT5.md`](docs/MT5.md)). Nenhuma das duas fontes é a Quotex e mostra, por par, o cenário, o cronômetro do candle M5 e os critérios do gatilho, com diário automático de resultados.
4. **Dashboard**: estado (Favorável / Desfavorável / Aguardar / Não avaliável), motivos, contagens e gatilho. **Gráfico**: candles, topos/fundos, zonas, tooltip OHLC. **Filtros**: explicação, evidência, regra e detalhes técnicos de cada um.
5. **Filtro de média móvel (hipótese, desligado por padrão):** EMA 9/21 como contexto a favor da tendência; o Teste histórico compara com e sem o filtro em treino e confirmação separados (ver `docs/REGRAS.md`).
6. **Histórico → Teste histórico** mede o resultado das regras em velas passadas (Binance ou CSV de 1 minuto do MT5) contra o ponto de equilíbrio do seu payout, e **Reprodução histórica** refaz a análise candle a candle sem ver o futuro e mostra a distribuição dos estados (não mede acerto).
7. **Registrar análise** guarda o resultado, a versão das regras e uma cópia da configuração. No **Histórico**: filtros, resultado posterior manual, comparação por classificação e exportação CSV.

## Estrutura

```
src/core/            núcleo puro (sem React/DOM) — testável
  candle.ts          corpo, pavios, direção, sequências, validação OHLC
  csv.ts, time.ts    importação estrita, lacunas, fusos
  swings.ts          topos/fundos (candidato × validado, sem look-ahead)
  zones.ts           zonas, toques, aproximações, rompimentos, retração
  rules/             uma regra = um RuleDefinition (aula01, naoEntrada, gatilho, horario, index = registro)
  engine.ts          motor de decisão (4 estados) + gatilho
  config.ts          parâmetros com origem, hash, persistência validada
  history.ts         registros, filtros, comparação, exportação CSV segura
  replay.ts          reprodução ponto-no-tempo (distribuição de estados)
  backtest.ts, stats.ts   teste histórico com resultado, Wilson e equilíbrio
  banca.ts           simulador de banca (Monte Carlo, cenários por intervalo de confiança)
  sinal.ts           resume a análise em um sinal simples (modo simples)
  journal.ts, session.ts, relatorio.ts   diário ao vivo, sessão de simulação injetável e resumo do agente
  htf.ts             candles M15/H1 a partir de M5 fechados e confluência de zonas (hipótese)
  binance.ts, mt5.ts, arquivoM1.ts adaptadores puros (klines da Binance; CSV M1 do MT5; arquivo exportado pelo script do MT5)
  dataStore.ts       persistência validada dos candles carregados
  demo.ts            dados FICTÍCIOS com semente fixa
src/ui/              React + Tailwind + lightweight-charts
docs/                REGRAS, PENDENCIAS, NOVAS-TRANSCRICOES, FONTE-DE-DADOS
```

## Agente de simulação 24 h

Programa de linha de comando que fica rodando sozinho no seu computador (Windows): lê a Binance, detecta toques em zonas armadas e registra entradas **virtuais**, resolvidas no fechamento do M5, com estatística contra o ponto de equilíbrio. **Não envia ordens e não usa chaves.** Veja [`docs/AGENTE.md`](docs/AGENTE.md) e `agent/iniciar-agente.bat`.

```bash
npm run agente -- --exploratorio   # Ctrl+C encerra e salva
```

## Documentação

- [`docs/REGRAS.md`](docs/REGRAS.md) — o que está implementado, de qual aula, e o que é operacionalização provisória.
- [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md) — dúvidas sobre as anotações, parâmetros ausentes, regras não verificáveis.
- [`docs/NOVAS-TRANSCRICOES.md`](docs/NOVAS-TRANSCRICOES.md) — como incorporar novas aulas.
- [`docs/BANCA.md`](docs/BANCA.md) — simulador de banca: o que calcula e os limites.
- [`docs/AGENTE.md`](docs/AGENTE.md) — agente de simulação 24 h (instalação no Windows e leitura do resultado).
- [`docs/FONTE-DE-DADOS.md`](docs/FONTE-DE-DADOS.md) — limitações dos dados e plano de integração.

## Resultado da verificação (última execução)

- `npm test`: **236 testes passando** (20 arquivos, sinais do indicador MT5 com x sem cada filtro, limite de risco do dia, filtro de média móvel com treino/confirmação, incluindo leitor do MT5, ponte local e uma checagem estática de que o script MQL5 não tem chamadas de ordem) — cálculo de corpo/pavios, direção e sequências, topos/fundos, candles inválidos, duplicatas, estados do motor, prioridade dos filtros de não entrada, ausência de confirmação de gatilho, look-ahead, importação CSV, persistência (configurações, histórico e candles), histórico e exportação.
- `npm run build`: typecheck estrito + build OK.
- Verificação ponta a ponta em Chromium: 29 checagens do fluxo principal, 19 do ao vivo com a Binance **simulada** (a rede deste ambiente não alcança a Binance) e as de zonas/persistência/reprodução, mais 10 do modo forex com a ponte local lendo um arquivo M1 **simulado** (não testei com um MT5 de verdade; o script `.mq5` não foi compilado aqui). Não testei o feed contra a Binance de verdade: estado vazio, demonstração e selo de dados fictícios, parâmetros e validação, gráfico/tooltip, filtros, registro, histórico, resultado manual, exportação CSV, persistência após recarregar, importação inválida, fuso obrigatório, CSV de exemplo, ausência de rolagem horizontal em 390 px, sem erros de console.

## Limitações importantes

- Os dados importados **não são comprovadamente iguais** aos da Quotex (principalmente em OTC).
- Com candles fechados (CSV), o **gatilho nunca é confirmado** (o "pico de vela" e F1/F2/F4 exigem o candle em formação); só o feed ao vivo (cripto) o avalia por completo.
- A maior parte dos limites numéricos **não existe nas aulas**; os valores exploratórios são só para teste. Nada foi otimizado nem validado estatisticamente; **não há taxa de acerto**.
- Tudo é guardado no `localStorage` do navegador. Os candles carregados persistem só até 5000 candles (acima disso é preciso reimportar), e os avisos/lacunas da importação não são guardados.
