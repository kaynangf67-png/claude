# TRADE AGENT 2x0: arquitetura técnica

Versão 0.1 (Fase 1). Ambiente **somente DEMO**: o modo REAL é recusado pelo código e pelo banco.

## 1. Visão geral

```
                 ┌──────────────── NUVEM (sempre ligada) ────────────────┐
 Navegador ──►   │  Painel Next.js ──HTTPS/WebSocket──► API FastAPI       │
 (opcional)      │                                       │                │
                 │   Scheduler ──► Orquestrador ─────────┤                │
                 │                    │                  ▼                │
                 │   Market Data ◄────┤           PostgreSQL              │
                 │   Trade Intelligence (propõe)   (estado, auditoria)    │
                 │   Risk Manager 2x0 (DECIDE) ──► trade_authorizations   │
                 │   Notificações (Telegram)                              │
                 └──────────────────────▲─────────────────────────────────┘
                                        │ HTTPS autenticado (polling + heartbeat)
                 ┌──────────── VPS WINDOWS ─────────────┐
                 │  MetaTrader 5 + Expert Advisor MQL5  │──► Corretora (conta DEMO)
                 └──────────────────────────────────────┘
```

O EA **puxa** autorizações do backend; o backend nunca abre conexão para dentro da VPS. Isso evita expor portas na VPS e deixa o EA ser a única peça que fala com a corretora.

## 2. Módulos e responsabilidades

| Módulo | Pasta | Faz | Não faz |
|---|---|---|---|
| A. Painel web | `frontend/` | mostra estado, sinais, execuções, relatórios; controles (pausa, emergência) | não mantém o agente vivo; não guarda segredo |
| B. API e orquestração | `backend/app/api`, `services` | autenticação, rotas, WebSocket, ciclo de análise | não contém regra técnica nem regra de risco |
| C. Trade Intelligence | `engines/trade_intelligence` | lê H1/M15/M5/M1, produz `TradeSignal` (BUY/SELL/NO TRADE) com justificativa | não autoriza ordem |
| D. Market Data | `engines/market_data` | candles, bid/ask, spread, especificação do símbolo; marca a fonte (LIVE/DEMO_FEED/HISTORICAL) | não inventa dado faltante |
| E. Strategy Comparison | `engines/strategy_comparison` | backtest e forward de SCALPING x HÍBRIDO, dentro e fora da amostra | não escolhe vencedor com amostra pequena |
| F. Risk Manager 2x0 | `engines/risk_manager` | máquina de estados persistente; calcula lote para R$ 5; emite `TradeAuthorization` | não lê gráfico |
| G. Execution Bridge | `engines/execution` | rotas do EA: entrega autorizações, recebe confirmações, reconcilia | não executa nada sozinho |
| H. Expert Advisor | `mt5/Experts` | valida e envia a ordem, reporta deals reais, heartbeat | não interpreta texto da IA |
| I. Banco | `backend/app/database` | schema, migrations, restrições | — |
| J. Notificações | `engines/notifications` | Telegram com deduplicação por `event_key` | — |
| K. Journal e Analytics | `engines/analytics` | métricas por ativo, sessão, modelo | — |

Contratos entre módulos: `backend/app/core/contracts.py`.

## 3. Fluxo de uma operação

1. O scheduler dispara o ciclo (ex.: a cada vela M1 fechada, nas sessões configuradas).
2. Market Data entrega candles e spread **com a fonte marcada**. Se o dado estiver atrasado ou incompleto, o ciclo registra a limitação e não segue.
3. Trade Intelligence devolve um `TradeSignal`. Pontuação técnica ≠ probabilidade; a confiança estatística só aparece com amostra suficiente.
4. O Risk Manager verifica o estado do dia, a pausa, a emergência, a notícia, a posição aberta, o stop válido e o lote mínimo contra R$ 5. Se tudo passar, grava uma `TradeAuthorization` (UUID, validade curta) **na mesma transação** da mudança de estado.
5. O EA busca a autorização, valida tudo de novo localmente (símbolo, stop, volume, validade, ID já executado?) e envia a ordem.
6. O EA reporta o **deal real** (ticket, preço, custos). Só então a operação conta. Resposta incerta → `RECONCILIATION_REQUIRED`.
7. No fechamento, o resultado **líquido** (com comissão e swap, convertido para BRL) define WIN/LOSS e a próxima transição 2x0.

## 4. Defesas em camadas (o que já está no banco nesta fase)

| Regra | Onde é garantida |
|---|---|
| Só conta DEMO | `accounts.account_mode CHECK = 'DEMO'`, `trade_authorizations.trading_mode CHECK = 'DEMO'`, `load_settings` recusa `TRADING_MODE=REAL` |
| Máximo 2 operações por dia, nunca a 3ª | `trade_authorizations.sequence IN (1,2)` + `UNIQUE (conta, dia, sequência)` |
| Nunca duas posições abertas | índice único parcial `positions (account_id) WHERE status='OPEN'` |
| Risco ≤ R$ 5 | `planned_risk_brl CHECK (> 0 AND <= 5)` |
| Sinal de entrada sempre com stop e alvo | `CHECK` em `trading_signals` |
| Idempotência no EA | `authorization_id` UUID; `orders.authorization_id UNIQUE`; `executions.broker_deal_ticket UNIQUE` |
| Estado 2x0 sem corrida | `daily_risk_states.version` (atualização só se a versão lida for a atual) |
| Auditoria imutável | trigger impede UPDATE/DELETE em `agent_events` |
| Notificação sem repetição | `notifications.event_key UNIQUE` |

As regras do código (Fase 2) ficam **por cima** destas. Se o código errar, o banco ainda recusa.

## 5. Decisões e o porquê

- **Python + FastAPI no backend**, como pedido. O projeto atual (`trade-ai/`, em TypeScript na Vercel) já tem motor de análise, 2x0 e agente funcionando. Ele **não será apagado**: serve de referência para portar a lógica testada (estruturas, liquidez, FVG, 2x0) e de painel até a Fase 3.
- **Vercel não serve para o backend novo.** Funções serverless não mantêm loop, WebSocket persistente nem conexão estável com o EA. O backend precisa de um processo sempre ligado (Render, Fly.io, Railway ou a própria VPS).
- **Supabase pode continuar como PostgreSQL** (já existe, com backup). As tabelas novas ficam num schema próprio ou num projeto separado, sem misturar com as do agente atual.
- **Um modelo por conta** (`accounts.active_model`): SCALPING e HÍBRIDO nunca dividem risco na mesma conta.
- **Horários**: tudo em UTC no banco; o dia operacional é a data em America/Sao_Paulo. As sessões de Londres e Nova York são calculadas com `zoneinfo` (Europe/London, America/New_York), então o horário de verão de cada região é respeitado sem horário fixo.

## 6. Componentes externos

| Componente | Para quê | Custo estimado* | Quem configura |
|---|---|---|---|
| Corretora com MT5 + conta **DEMO** | execução e dados reais | demo grátis | você escolhe a corretora e abre a conta |
| VPS Windows | rodar o MT5 24h | ~US$ 10–30/mês | você contrata; eu documento a instalação |
| Hospedagem do backend (processo contínuo) | API, scheduler, WebSocket | grátis a ~US$ 7–25/mês | você cria a conta; eu preparo o deploy |
| PostgreSQL (Supabase já existente) | persistência e backup | plano grátis atual; pago se crescer | já configurado |
| Hospedagem do painel (Vercel já existente) | Next.js | grátis no Hobby (com limite de deploys diário, que já nos travou) | já configurado |
| Telegram Bot | notificações | grátis | você cria o bot no @BotFather |
| Calendário econômico | proteção contra notícia | grátis (fonte atual) ou pago | a definir |

\*Valores aproximados, para planejamento. Confirme no site de cada provedor antes de contratar, porque preços mudam.

## 7. O que exige credencial ou ação manual sua

1. Conta DEMO na corretora: login, senha e servidor ficam **só no MT5 da VPS**. O backend nunca recebe a senha da corretora.
2. VPS Windows: acesso remoto, instalação do MT5, liberar o domínio do backend em *Ferramentas → Opções → Expert Advisors → WebRequest*.
3. `EA_SHARED_SECRET`: valor aleatório colocado na hospedagem do backend e no parâmetro do EA.
4. `DATABASE_URL`: nas variáveis da hospedagem. Nunca no chat.
5. Telegram: token do bot e chat id, nas variáveis da hospedagem.

## 8. Riscos do projeto (leitura honesta)

- **Não existe estratégia com resultado positivo comprovado.** O backtest do motor atual (EURUSD, GBPUSD, USDJPY) deu expectativa negativa em todos os perfis: de −0,18R a −0,55R por operação. Infraestrutura de execução não cria vantagem. A ordem recomendada é provar a vantagem fora da amostra (Fases 5, 6 e 8) **antes** de investir em VPS e EA (Fase 4).
- **R$ 5 de risco é pequeno para o lote mínimo.** Em EURUSD, 0,01 lote vale cerca de US$ 0,10 por pip. Com o dólar a ~R$ 5,X, R$ 5 cobre só uns 9 a 10 pips de stop, já descontados spread e comissão. Stops de M5/H1 maiores que isso serão recusados pelo Risk Manager. O número exato depende da cotação do dia e da corretora; o cálculo real será feito com a especificação do símbolo lida do MT5.
- **Scalping com spread e comissão** perde boa parte do alvo em custos. O backtest precisa usar os custos reais da corretora escolhida.
