# TRADE AGENT 2X0 — implantação e operação

Agente autônomo de **análise** Forex integrado ao Trade AI. Modo **ANALISTA AUTÔNOMO**: monitora, analisa, alerta, registra e **simula**.
**Não envia ordens reais.** Não existe código de corretora no projeto; a configuração `execution` é sempre `{enabled:false}` e o servidor
ignora qualquer tentativa de ligá-la (testado).

> **Leia antes de confiar nele.** O backtest do motor técnico (12 pares, 83 dias, custo de 1,2 pip) deu **−0,29R por operação**,
> 37% de acerto, 592 operações — expectativa negativa. O agente automatiza e disciplina o processo, mas **não cria vantagem estatística**.
> A meta "2 vitórias, 0 derrotas" não pode ser garantida: com 37% de acerto, a chance de as duas primeiras operações vencerem é ~14%.
> Os limites do gerenciador existem justamente para o prejuízo máximo do dia ser R$ 5,00 (1 loss) em dinheiro simulado.

## Arquitetura (o que existe de verdade)

| Componente pedido | Arquivo | Estado |
|---|---|---|
| TRADE AI ENGINE | `server/forex/*` (reaproveitado) | pronto; ganhou `newsWindow`, `setup` e gatilho com nível |
| TRADE AGENT (tick) | `server/agent/agent.ts` | pronto, sem estado em memória |
| MARKET DATA ENGINE | `server/forex/marketData.ts` (Yahoo Finance) | **polling**; sem WebSocket (ver "Dados") |
| NEWS INTELLIGENCE | `server/agent/news.ts` + `server/calendar.ts` | classificação, surpresa, bloqueio configurável, reação do preço |
| OPPORTUNITY RADAR | `server/agent/radar.ts` | A distante / B em formação / C confirmada, id único por setup |
| RISK MANAGER 2X0 | `server/agent/risk2x0.ts` | máquina de estados pura, 20 mil sequências aleatórias testadas |
| TRADE JOURNAL | `server/agent/store.ts` (tabelas `agent_*`) | PostgreSQL + memória (testes) |
| NOTIFICATION CENTER | `server/agent/telegram.ts` | Telegram Bot API; dedupe por chave no banco |
| DAILY REPORT | `server/agent/report.ts` | enviado uma vez após o fim do horário |
| BACKTEST ENGINE | `server/forex/backtest.ts` (reaproveitado) | pronto; ver "Backtest" |
| API / painel | `api/agent.ts`, painel "Agente" no escritório 3D | pronto |
| Runtime | GitHub Actions (`.github/workflows/trade-agent-tick.yml`) **ou** worker (`npm run agent:worker`) | você escolhe e configura |

### Como uma execução funciona (`runTick`)
1. Pega uma **trava no banco** (uma varredura por vez; vence sozinha em 4 min se a execução morrer).
2. Carrega ou **rola o dia** (fuso America/Sao_Paulo). Se há operação pendente do dia anterior, **não reinicia**.
3. **Reconcilia** operações abertas com as velas reais (M1, senão M5). Só o **Take 1** conta como WIN. Stop, stop+take na mesma vela
   e expiração de 1 h contam como LOSS para a meta 2x0 (o R real é registrado à parte). Sem confirmação após 90 min → `UNKNOWN`, que **bloqueia** tudo.
4. Pausado / mercado fechado / fora do horário / dia travado → não varre (só reconcilia e registra batimento).
5. Varre os pares habilitados (3 em paralelo), classifica A/B/C, aplica travas (notícia, idade dos dados, limite do dia) e abre **no máximo uma** entrada simulada.
   O limite do dia é gravado **antes** de qualquer notificação.
6. Alerta (uma vez por setup/classe/dia), invalidação, log de varredura, batimento de saúde.

## Gerenciamento 2X0 (fixo, no backend)
R$ 5,00 por operação · máx. 2 operações/dia · meta 2 vitórias · limite 1 derrota. Estados: `READY → FIRST_TRADE_ACTIVE → FIRST_WIN →
SECOND_TRADE_ACTIVE → TARGET_REACHED`, ou `DAILY_LOCKED` após qualquer LOSS; `WAIT_NEXT_DAY` em fim de semana. O estado é **derivado** das
operações gravadas, então reiniciar servidor/página não destrava nada. Nada disso é configurável pelo painel nem pela API (testado).
Resultado financeiro simulado = R líquido (com `costPips`, padrão 1,2) × R$ 5.

Decisão que cabe a você: operação que **expira** (1 h sem Take 1 nem Stop) conta como LOSS na meta. É a leitura mais conservadora; se preferir
tratá-la como "neutra", é uma mudança em `reconcile()` + um estado novo (hoje a tabela de estados do pedido não prevê isso).

## Dependências externas, custos e limites
Valores mudam: **confirme nas páginas oficiais antes de contratar.**

| Serviço | Para quê | Custo inicial | Limites / observações |
|---|---|---|---|
| **Vercel** (já em uso) | API `/api/agent` e site | Hobby grátis | Cron nativo da Hobby é **1 vez por dia** ([docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)): por isso o agendador é externo. A conta atingiu o limite diário de deploys várias vezes. Proteção de deploy ligada: chamadas externas precisam do *Protection Bypass for Automation* |
| **PostgreSQL** (obrigatório) | estado diário, diário, alertas | Neon free: 100 CU-h/mês, ~1 GB/projeto ([preços](https://neon.com/pricing)); Supabase free também serve | Use a URL **com pooler** em serverless. O agente usa 2 conexões por execução |
| **GitHub Actions** | agenda o tick a cada 5 min, seg–sex | grátis | Mínimo de 5 min, **sem garantia de pontualidade** (atrasos de 15–30 min relatados), só roda do **branch padrão**, e é desativado após ~60 dias sem atividade ([discussão](https://github.com/orgs/community/discussions/203473)). Se isso não basta: use o worker |
| **Worker persistente** (opcional) | intervalo de 30–60 s, sempre ligado | Fly.io / Railway / Render: a partir de poucos USD/mês | `npm run agent:worker` com `DATABASE_URL` + Telegram. Mesmo código e mesma trava do banco |
| **Telegram Bot API** | alertas | grátis | Crie o bot no @BotFather → `TELEGRAM_BOT_TOKEN`; mande uma mensagem ao bot e pegue o `chat_id` → `TELEGRAM_CHAT_ID`. Há limite de envio por chat; o agente já evita repetições |
| **Yahoo Finance (chart API)** | candles M1/M5/M15/H1 | grátis | **Não oficial**, sem SLA, pode atrasar ou bloquear. M1 só cobre ~5 dias; M5 ~60 dias. O agente bloqueia sinal com dado atrasado e alerta falha de dados |
| **Calendário Forex Factory** (`nfs.faireconomy.media`) | notícias | grátis | Feed público; traz esperado/anterior e, quando disponível, resultado. Se cair, as notícias ficam "NÃO verificadas" e **as entradas são bloqueadas** |
| **Claude API** (opcional) | texto explicativo da tese no painel manual | pago por uso | O agente autônomo **não depende** de IA para decidir: a decisão é do motor determinístico |

**WebSocket:** não implementado. Não encontrei fonte gratuita confiável de Forex em tempo real por WebSocket (as comparações disponíveis
divergem e não são oficiais — [exemplo](https://qveris.ai/guides/stock-api-free-comparison/)). Se contratar um provedor, o ponto de troca é
`fetchSeries` em `server/forex/marketData.ts`; o worker poderia então manter a conexão aberta.

## Implantação (passo a passo)
1. **Banco:** crie um projeto PostgreSQL (Neon ou Supabase) e copie a connection string com pooler.
2. **Vercel → Settings → Environment Variables** (Production): `DATABASE_URL`, `CRON_SECRET` (string longa aleatória), `AGENT_ADMIN_TOKEN`
   (outra string longa; é a senha dos botões Pausar/Configurar), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, e `ANTHROPIC_API_KEY` se usar a explicação por IA.
   **Nunca** coloque essas chaves em código, em chat ou no frontend.
3. **Deploy** da branch. As tabelas são criadas sozinhas na primeira chamada (`create table if not exists`; SQL em `server/agent/store.ts`).
4. **Agendador (opção A, GitHub Actions):** faça merge do workflow no branch padrão e cadastre os *secrets* do repositório:
   `AGENT_URL` (https://seu-dominio), `CRON_SECRET` (o mesmo da Vercel) e `VERCEL_AUTOMATION_BYPASS_SECRET`
   (Vercel → Settings → Deployment Protection → *Protection Bypass for Automation*). Teste com *Run workflow*.
   **Opção B (worker):** `DATABASE_URL=… TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=… npm run agent:worker` numa máquina sempre ligada.
5. Abra o painel (escritório 3D → monitor → **Agente**). Deve aparecer ONLINE depois da primeira execução. Teste um alerta pelo Telegram em modo pausado → retomar.
6. Antes de qualquer decisão financeira: rode o **backtest** (botão Backtest) e acompanhe o agente em modo simulado por semanas.

## Saúde e falhas
Cada execução grava um batimento (`heartbeat`). O painel mostra OFFLINE se não houver execução há mais de `max(15 min, 3×intervalo)` ou após 3 falhas seguidas.
Falha de dados em todos os pares gera alerta de saúde (no máximo 1 por hora). Falha do Telegram **não** derruba a varredura: o alerta fica gravado com o erro.
Reconexão é implícita: cada execução reconecta ao banco e às fontes; o worker captura erros e tenta de novo no próximo ciclo.

## Limitações conhecidas
- Dados Yahoo atrasam e variam alguns pips em relação à sua corretora; os preços do alerta são **da fonte**, não da corretora.
- Entradas simuladas assumem execução ao preço do fechamento da vela do gatilho; não modelam fila nem *requote*.
- O id do setup arredonda a região a 5 pips: em casos raros de fronteira o mesmo setup pode ganhar dois ids (dois alertas).
- O tick de 5 min pode perder o instante exato de um gatilho M1; o gatilho é lido nas últimas velas fechadas.
- O backtest histórico não tem M1 nem calendário de notícias históricos, e usa um período de ~83 dias.
- "Pattern History" usa o diário do próprio agente (só entra após 10 resultados do mesmo setup).
