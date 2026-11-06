"""Schema inicial do TRADE AGENT 2x0 (Fase 1).

Revision ID: 0001
Create Date: 2026-11-03

Decisões:
- Horários em TIMESTAMPTZ (UTC); o dia operacional (America/Sao_Paulo) é gravado como DATE em trading_day.
- daily_risk_states: uma linha por (conta, dia) com versão para controle otimista (CAS).
- trade_authorizations.authorization_id é a chave de idempotência do EA (UNIQUE).
- Restrições de banco reforçam as regras 2x0: no máximo 2 autorizações executáveis por conta/dia,
  e nunca mais de uma posição aberta por conta.
- account_mode só aceita DEMO enquanto a autorização do modo REAL não existir.
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = r"""
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- argon2/bcrypt; nunca texto puro
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','operator','viewer')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  server TEXT NOT NULL,
  symbol_suffix TEXT NOT NULL DEFAULT '',   -- ex.: ".m", "-ECN"
  commission_per_lot NUMERIC(12,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, server)
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  login TEXT NOT NULL,                      -- número da conta MT5; a SENHA da corretora não é guardada aqui
  account_mode TEXT NOT NULL DEFAULT 'DEMO' CHECK (account_mode = 'DEMO'),
  currency TEXT NOT NULL,
  active_model TEXT CHECK (active_model IN ('SCALPING','HIBRIDO')),  -- um único modelo por conta
  ea_key_hash TEXT,                         -- hash do segredo do EA desta conta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (broker_id, login)
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE CHECK (symbol IN ('EURUSD','GBPUSD','USDJPY')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE market_candles (
  asset_id UUID NOT NULL REFERENCES assets(id),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('H1','M15','M5','M1')),
  open_time TIMESTAMPTZ NOT NULL,
  open NUMERIC(18,8) NOT NULL, high NUMERIC(18,8) NOT NULL, low NUMERIC(18,8) NOT NULL, close NUMERIC(18,8) NOT NULL,
  volume NUMERIC(20,2),
  source TEXT NOT NULL CHECK (source IN ('LIVE','DEMO_FEED','HISTORICAL')),
  PRIMARY KEY (asset_id, timeframe, open_time, source)
);

CREATE TABLE market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id),
  taken_at TIMESTAMPTZ NOT NULL,
  bid NUMERIC(18,8) NOT NULL, ask NUMERIC(18,8) NOT NULL,
  spread_points NUMERIC(12,2),
  atr_m5 NUMERIC(18,8),
  source TEXT NOT NULL CHECK (source IN ('LIVE','DEMO_FEED','HISTORICAL'))
);
CREATE INDEX ON market_snapshots (asset_id, taken_at DESC);

CREATE TABLE strategy_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (code IN ('SCALPING','HIBRIDO')),
  version TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);

CREATE TABLE technical_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  model_id UUID NOT NULL REFERENCES strategy_models(id),
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_source TEXT NOT NULL CHECK (data_source IN ('LIVE','DEMO_FEED','HISTORICAL')),
  context JSONB NOT NULL,                    -- leitura por timeframe, estruturas, indicadores
  limitations TEXT[] NOT NULL DEFAULT '{}'   -- ex.: "M1 indisponível", "amostra insuficiente"
);
CREATE INDEX ON technical_analyses (asset_id, analyzed_at DESC);

CREATE TABLE trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES technical_analyses(id),
  decision TEXT NOT NULL CHECK (decision IN ('BUY','SELL','NO_TRADE')),
  entry_timeframe TEXT NOT NULL,
  trigger TEXT, rationale TEXT NOT NULL,
  factors_for TEXT[] NOT NULL DEFAULT '{}', factors_against TEXT[] NOT NULL DEFAULT '{}',
  reference_price NUMERIC(18,8), stop_loss NUMERIC(18,8), take_profit NUMERIC(18,8), risk_reward NUMERIC(8,3),
  technical_score NUMERIC(5,2) NOT NULL CHECK (technical_score BETWEEN 0 AND 100),
  statistical_confidence NUMERIC(5,4) CHECK (statistical_confidence BETWEEN 0 AND 1),
  sample_size INT,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'NO_TRADE' OR (stop_loss IS NOT NULL AND take_profit IS NOT NULL AND reference_price IS NOT NULL)),
  CHECK (statistical_confidence IS NULL OR sample_size IS NOT NULL)
);

CREATE TABLE strategy_backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES strategy_models(id),
  asset_id UUID REFERENCES assets(id),
  period_start TIMESTAMPTZ NOT NULL, period_end TIMESTAMPTZ NOT NULL,
  sample_kind TEXT NOT NULL CHECK (sample_kind IN ('IN_SAMPLE','OUT_OF_SAMPLE','FORWARD_DEMO')),
  cost_assumptions JSONB NOT NULL,           -- spread, comissão, slippage usados
  metrics JSONB NOT NULL,                    -- n, acerto, líquido, expectativa, PF, DD, por sessão/ativo
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_sessions (
  account_id UUID NOT NULL REFERENCES accounts(id),
  trading_day DATE NOT NULL,                 -- dia em America/Sao_Paulo
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (account_id, trading_day)
);

CREATE TABLE daily_risk_states (
  account_id UUID NOT NULL,
  trading_day DATE NOT NULL,
  state TEXT NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','FIRST_TRADE_ACTIVE','FIRST_WIN','SECOND_TRADE_ACTIVE','TARGET_REACHED','DAILY_LOCKED','RECONCILIATION_REQUIRED')),
  trades_taken SMALLINT NOT NULL DEFAULT 0 CHECK (trades_taken BETWEEN 0 AND 2),
  wins SMALLINT NOT NULL DEFAULT 0 CHECK (wins BETWEEN 0 AND 2),
  losses SMALLINT NOT NULL DEFAULT 0 CHECK (losses BETWEEN 0 AND 2),
  net_result_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,            -- controle otimista: UPDATE só se a versão lida ainda for a atual
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, trading_day),
  FOREIGN KEY (account_id, trading_day) REFERENCES daily_sessions(account_id, trading_day)
);

CREATE TABLE trade_authorizations (
  authorization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- idempotência no EA
  account_id UUID NOT NULL REFERENCES accounts(id),
  trading_day DATE NOT NULL,
  sequence SMALLINT NOT NULL CHECK (sequence IN (1,2)),          -- nunca uma terceira
  signal_id UUID NOT NULL REFERENCES trading_signals(id),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('BUY','SELL')),
  volume_lots NUMERIC(10,2) NOT NULL CHECK (volume_lots > 0),
  stop_loss NUMERIC(18,8) NOT NULL,
  take_profit NUMERIC(18,8) NOT NULL,
  planned_risk_brl NUMERIC(10,2) NOT NULL CHECK (planned_risk_brl > 0 AND planned_risk_brl <= 5),
  trading_mode TEXT NOT NULL DEFAULT 'DEMO' CHECK (trading_mode = 'DEMO'),
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','PICKED_UP','EXECUTED','REJECTED','EXPIRED','CANCELLED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, trading_day, sequence),
  FOREIGN KEY (account_id, trading_day) REFERENCES daily_risk_states(account_id, trading_day)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL UNIQUE REFERENCES trade_authorizations(authorization_id),
  broker_order_ticket TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('SENT','ACCEPTED','REJECTED','UNKNOWN')),  -- UNKNOWN => reconciliação
  broker_retcode INT, broker_message TEXT
);

CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  broker_deal_ticket TEXT NOT NULL UNIQUE,   -- confirmação vem do deal real da corretora
  kind TEXT NOT NULL CHECK (kind IN ('ENTRY','EXIT')),
  price NUMERIC(18,8) NOT NULL, volume_lots NUMERIC(10,2) NOT NULL,
  commission NUMERIC(12,4) NOT NULL DEFAULT 0, swap NUMERIC(12,4) NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  authorization_id UUID NOT NULL UNIQUE REFERENCES trade_authorizations(authorization_id),
  broker_position_ticket TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  opened_at TIMESTAMPTZ NOT NULL, closed_at TIMESTAMPTZ
);
-- nunca duas posições abertas ao mesmo tempo na mesma conta
CREATE UNIQUE INDEX one_open_position_per_account ON positions (account_id) WHERE status = 'OPEN';

CREATE TABLE trade_results (
  position_id UUID PRIMARY KEY REFERENCES positions(id),
  gross_result NUMERIC(12,4) NOT NULL,
  costs NUMERIC(12,4) NOT NULL,              -- comissão + swap
  net_result_account_ccy NUMERIC(12,4) NOT NULL,
  fx_to_brl NUMERIC(14,6) NOT NULL,
  net_result_brl NUMERIC(12,2) NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('WIN','LOSS')),  -- pelo líquido confirmado
  confirmed_by_broker BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_events (                  -- trilha de auditoria; só INSERT
  id BIGSERIAL PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  trading_day DATE,
  kind TEXT NOT NULL,                        -- STATE_TRANSITION, PAUSE, EMERGENCY_STOP, RECONCILE, ...
  from_state TEXT, to_state TEXT,
  actor TEXT NOT NULL,                       -- 'risk_manager', 'ea', 'user:<id>'
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON agent_events (account_id, created_at DESC);

CREATE TABLE system_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('DEBUG','INFO','WARNING','ERROR','CRITICAL')),
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON system_logs (created_at DESC);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,            -- deduplicação: o mesmo evento não sai duas vezes
  channel TEXT NOT NULL DEFAULT 'telegram',
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- auditoria só cresce
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'agent_events é somente inserção'; END $$;
CREATE TRIGGER agent_events_append_only BEFORE UPDATE OR DELETE ON agent_events
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

INSERT INTO assets (symbol) VALUES ('EURUSD'), ('GBPUSD'), ('USDJPY');
INSERT INTO strategy_models (code, version) VALUES ('SCALPING', '0.0.0'), ('HIBRIDO', '0.0.0');
"""

TABLES = [
    "settings", "notifications", "system_logs", "agent_events", "trade_results", "positions", "executions",
    "orders", "trade_authorizations", "daily_risk_states", "daily_sessions", "strategy_backtests",
    "trading_signals", "technical_analyses", "strategy_models", "market_snapshots", "market_candles",
    "assets", "accounts", "brokers", "users",
]


def upgrade() -> None:
    op.execute(SCHEMA)


def downgrade() -> None:
    for t in TABLES:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
    op.execute("DROP FUNCTION IF EXISTS forbid_change()")
