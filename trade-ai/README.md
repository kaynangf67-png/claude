# TRADE AI — Global Market Scanner M5

Scanner de day trade em M5 com análise técnica por confluência, sinais com stop obrigatório,
gráfico com marcações, leitura de capturas com IA e simulador de operações **somente demo**.

```
trade-ai/
├── backend/      FastAPI + WebSocket + SQLAlchemy (PostgreSQL/SQLite)
├── frontend/     React + TypeScript + Tailwind + lightweight-charts
├── tradingview/  Pine Script que envia cada candle M5 fechado por webhook
└── docker-compose.yml  PostgreSQL + API
```

## Rodando

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp ../.env.example ../.env   # edite as chaves que tiver
set -a; . ../.env; set +a
.venv/bin/uvicorn app.main:app --port 8000
.venv/bin/python -m pytest -q          # 25 testes

# frontend (outro terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy para :8000)
npm run build
```

Com Docker: `docker compose up --build` sobe PostgreSQL + API; o frontend roda com `npm run dev`
ou é publicado estático (`dist/`) com `VITE_API_URL` apontando para a API.

Abra o painel e clique em **INICIAR SCANNER**.

## O que funciona de verdade e o que depende de você

| Parte | Estado | Precisa de |
|---|---|---|
| Motor M5: EMA 50/200, RSI, MACD, VWAP, ADX, ATR, volume, price action, S/R, rompimento e falso rompimento | Funciona, testado | — |
| Sinais COMPRA / VENDA / AGUARDAR com entrada, stop, alvo 1/2, R:R, validade, motivos | Funciona, testado | — |
| Cancelamento quando o preço sai da região de entrada, bate no stop, vence ou o dado fica velho | Funciona, testado | — |
| Cripto ao vivo (Binance, pares USDT de maior volume) | Implementado; **não testado contra a API real** (a rede desta sandbox bloqueia) | Nada. Se der HTTP 451, troque `BINANCE_BASE_URL` |
| Forex, ações EUA, índices, commodities (Twelve Data) | Implementado; **não testado contra a API real** | `TWELVEDATA_API_KEY` e plano compatível com o número de ativos |
| B3, futuros (WIN/WDO) e qualquer ativo do seu TradingView | Webhook + Pine Script + importação de CSV | `TRADINGVIEW_WEBHOOK_SECRET`, plano pago do TradingView com 2FA, um alerta por ativo |
| Leitura de capturas com IA | Implementado com Claude (saída em JSON validado + checagens do servidor) | `ANTHROPIC_API_KEY` |
| Conta demo: saldo configurável, risco %, stop/alvo automáticos, limite diário, emergência | Funciona, testado | — |
| Backtest separado da demo; "ao vivo" marcado como indisponível | Funciona | — |
| Login / multiusuário / cobrança (parte "SaaS") | **Não implementado** | Próxima etapa |

## Regras de confiabilidade (no código, não só na interface)

- **Pontuação ≠ probabilidade.** A confluência (0–100) mede quantos critérios concordam. A taxa de acerto vem só de operações encerradas.
- **Sem entrada atrasada.** Sinal nasce só no fechamento do candle; se o candle fechou há mais de `max_signal_delay_s`, não sai sinal. A demo executa ao preço atual e recusa fora da região de entrada.
- **Dado velho bloqueia.** Ativo sem cotação nova por mais de 2 candles (ou provedor com dado antigo) fica "sem dados atualizados": sem sinal, sem entrada demo, sinais ativos cancelados.
- **Stop obrigatório**, tamanho de posição pelo risco, limite diário trava novas entradas até o dia seguinte, emergência fecha tudo e trava.
- **Simulado nunca parece ao vivo.** O feed sintético é desligado por padrão; quando ligado, cada ativo, operação e backtest leva a etiqueta SIMULADO.
- **IA não inventa.** A captura é recusada (pede nova) se faltar ativo, timeframe, horário, se não for M5, se for antiga ou se o preço divergir mais de 1% do preço ao vivo.

## TradingView

1. `TRADINGVIEW_WEBHOOK_SECRET` no servidor.
2. Ativo no gráfico de 5 min → adicione `tradingview/trade_ai_feed_m5.pine` → preencha o segredo.
3. Alerta: condição "Any alert() function call", webhook `https://SEU-SERVIDOR/api/webhooks/tradingview`.
4. EMA 200 precisa de ~210 candles (17 h de M5). Para não esperar, exporte o gráfico em CSV e importe em **Mercados → Importar histórico**.

O TradingView não oferece API oficial de cotações para terceiros; o caminho suportado é alerta + webhook.

## API

`GET /api/status` · `POST /api/scanner/start|stop` · `GET /api/assets` · `GET /api/assets/{key}/chart` ·
`GET /api/signals` · `GET /api/markets` · `GET|PUT /api/settings/...` · `GET /api/demo/account` ·
`POST /api/demo/trades` · `POST /api/demo/emergency` · `GET /api/trades?mode=demo|backtest` · `GET /api/stats` ·
`POST /api/backtest` · `POST /api/webhooks/tradingview` · `POST /api/import/csv` · `POST /api/vision/analyze` · `WS /ws`
