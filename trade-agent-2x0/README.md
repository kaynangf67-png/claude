# TRADE AGENT 2x0

Sistema de análise e execução de Forex (EURUSD, GBPUSD, USDJPY) integrado ao MetaTrader 5, com gerenciamento diário 2x0.

> **Ambiente DEMO apenas.** O modo REAL é recusado pela configuração e pelo banco de dados. Nenhuma ordem é enviada nesta fase.

## Estado

| Fase | Situação |
|---|---|
| 1. Arquitetura, pastas, banco, documentação | **concluída** (`docs/RELATORIO-FASE-1.md`) |
| 2. Backend, autenticação, Risk Manager 2x0 | **concluída** (`docs/RELATORIO-FASE-2.md`) |
| 3. Painel web | a fazer |
| 4. MT5 + EA | a fazer |
| 5–10 | a fazer |

## Estrutura

```
backend/   API FastAPI, motores, migrations, testes
frontend/  painel Next.js (Fase 3)
mt5/       Expert Advisor MQL5 (Fase 4)
docs/      arquitetura e relatórios de fase
infrastructure/  Postgres local para desenvolvimento
scripts/   utilitários
```

## Rodar localmente

```bash
cd backend
pip install -r requirements.txt
# banco local: docker compose -f ../infrastructure/docker-compose.dev.yml up -d
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ta2x0
alembic upgrade head
export AUTH_SECRET=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')
python3 ../scripts/create_admin.py voce@exemplo.com
uvicorn app.main:app --reload        # documentação em http://localhost:8000/docs
TEST_DATABASE_URL=$DATABASE_URL python3 -m pytest -q
```

Leia `docs/ARQUITETURA.md` antes de mexer no código.
