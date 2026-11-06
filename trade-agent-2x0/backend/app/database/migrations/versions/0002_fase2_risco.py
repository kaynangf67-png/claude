"""Fase 2: controles de pausa/emergência por conta, motivo de reconciliação e vagas de autorização.

Revision ID: 0002
Revises: 0001

- Pausa e emergência ficam na CONTA (persistem entre dias e reinícios), não no dia.
- A vaga (conta, dia, sequência) só fica ocupada por autorização viva ou executada: uma autorização
  EXPIRADA ou REJEITADA (nunca virou posição) libera a vaga, porque ordem enviada não é operação.
- No máximo UMA autorização pendente por conta: nunca duas ordens em voo ao mesmo tempo.
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(r"""
ALTER TABLE accounts
  ADD COLUMN entries_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN emergency_reason TEXT;

ALTER TABLE daily_risk_states ADD COLUMN reconciliation_reason TEXT;

ALTER TABLE trade_authorizations DROP CONSTRAINT trade_authorizations_account_id_trading_day_sequence_key;
CREATE UNIQUE INDEX one_live_auth_per_slot ON trade_authorizations (account_id, trading_day, sequence)
  WHERE status IN ('ISSUED','PICKED_UP','EXECUTED');
CREATE UNIQUE INDEX one_pending_auth_per_account ON trade_authorizations (account_id)
  WHERE status IN ('ISSUED','PICKED_UP');
""")


def downgrade() -> None:
    op.execute(r"""
DROP INDEX IF EXISTS one_pending_auth_per_account;
DROP INDEX IF EXISTS one_live_auth_per_slot;
ALTER TABLE trade_authorizations ADD CONSTRAINT trade_authorizations_account_id_trading_day_sequence_key
  UNIQUE (account_id, trading_day, sequence);
ALTER TABLE daily_risk_states DROP COLUMN reconciliation_reason;
ALTER TABLE accounts DROP COLUMN emergency_reason, DROP COLUMN emergency_stop, DROP COLUMN entries_paused;
""")
