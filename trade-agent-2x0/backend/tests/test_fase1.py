"""Testes da Fase 1: configuração segura, API mínima e proteções do schema.

Os testes de banco precisam de TEST_DATABASE_URL (um banco vazio dedicado); sem ele, são pulados.
"""
from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import pytest

from app.core.config import ConfigError, TradingMode, load_settings

BACKEND = Path(__file__).resolve().parents[1]


# ---------- configuração ----------

def test_padrao_e_demo():
    s = load_settings({})
    assert s.trading_mode is TradingMode.DEMO
    assert s.public_view()["real_execution_enabled"] is False


def test_modo_real_e_recusado():
    with pytest.raises(ConfigError, match="REAL bloqueado"):
        load_settings({"TRADING_MODE": "REAL"})


def test_modo_invalido_e_recusado():
    with pytest.raises(ConfigError):
        load_settings({"TRADING_MODE": "LIVE"})


@pytest.mark.parametrize("valor", ["0", "-1", "5.01", "50"])
def test_risco_fora_do_limite_e_recusado(valor):
    with pytest.raises(ConfigError):
        load_settings({"RISK_PER_TRADE_BRL": valor})


def test_segredos_nao_aparecem_na_visao_publica():
    s = load_settings({"EA_SHARED_SECRET": "segredo-super", "TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "c",
                       "DATABASE_URL": "postgres://u:senha@h/db"})
    texto = str(s.public_view())
    assert "segredo-super" not in texto and "senha" not in texto
    assert s.public_view()["ea_auth_configured"] is True


# ---------- API ----------

def test_api_health_e_system(monkeypatch):
    monkeypatch.delenv("TRADING_MODE", raising=False)
    from fastapi.testclient import TestClient

    from app.main import app
    c = TestClient(app)
    assert c.get("/api/v1/health").json()["trading_mode"] == "DEMO"
    body = c.get("/api/v1/system").json()
    assert body["real_execution_enabled"] is False
    assert "não implementado" in body["modules"]["mt5_bridge"]


def test_api_nao_sobe_em_modo_real():
    r = subprocess.run([sys.executable, "-c", "import app.main"], cwd=BACKEND, capture_output=True, text=True,
                       env={**os.environ, "TRADING_MODE": "REAL"})
    assert r.returncode != 0 and "REAL bloqueado" in r.stderr


# ---------- banco ----------

DB = os.environ.get("TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not DB, reason="defina TEST_DATABASE_URL para os testes de banco")


@pytest.fixture(scope="module")
def conn():
    import psycopg
    url = DB.replace("postgresql+psycopg://", "postgresql://")
    env = {**os.environ, "DATABASE_URL": url}
    with psycopg.connect(url, autocommit=True) as c0:
        c0.execute("drop schema public cascade; create schema public")
    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND, env=env, check=True, capture_output=True)
    with psycopg.connect(url, autocommit=True) as c:
        yield c


def _account_day(c):
    """Cria usuário, corretora, conta DEMO, sessão e estado 2x0 do dia; devolve (account_id, dia, signal_id)."""
    u = c.execute("insert into users(email,password_hash) values (%s,'x') returning id", (f"{uuid.uuid4()}@t",)).fetchone()[0]
    b = c.execute("insert into brokers(name,server) values (%s,'demo') returning id", (str(uuid.uuid4()),)).fetchone()[0]
    a = c.execute("insert into accounts(user_id,broker_id,login,currency) values (%s,%s,'1','USD') returning id", (u, b)).fetchone()[0]
    day = "2026-11-04"
    c.execute("insert into daily_sessions(account_id,trading_day) values (%s,%s)", (a, day))
    c.execute("insert into daily_risk_states(account_id,trading_day) values (%s,%s)", (a, day))
    asset = c.execute("select id from assets where symbol='EURUSD'").fetchone()[0]
    model = c.execute("select id from strategy_models where code='SCALPING'").fetchone()[0]
    an = c.execute("insert into technical_analyses(asset_id,model_id,data_source,context) values (%s,%s,'HISTORICAL','{}') returning id",
                   (asset, model)).fetchone()[0]
    sig = c.execute("""insert into trading_signals(analysis_id,decision,entry_timeframe,rationale,reference_price,stop_loss,take_profit,technical_score)
                       values (%s,'BUY','M1','teste',1.1,1.09,1.12,60) returning id""", (an,)).fetchone()[0]
    return a, day, sig


def _authorize(c, a, day, sig, seq, risk=5):
    return c.execute("""insert into trade_authorizations(account_id,trading_day,sequence,signal_id,symbol,direction,volume_lots,
                        stop_loss,take_profit,planned_risk_brl,expires_at)
                        values (%s,%s,%s,%s,'EURUSD','BUY',0.01,1.09,1.12,%s, now()+interval '5 min') returning authorization_id""",
                     (a, day, seq, sig, risk)).fetchone()[0]


@needs_db
def test_schema_tem_as_21_tabelas(conn):
    n = conn.execute("select count(*) from information_schema.tables where table_schema='public' and table_name<>'alembic_version'").fetchone()[0]
    assert n == 21


@needs_db
def test_autorizacao_expirada_libera_a_vaga(conn):
    a, day, sig = _account_day(conn)
    z1 = _authorize(conn, a, day, sig, 1)
    conn.execute("update trade_authorizations set status='EXPIRED' where authorization_id=%s", (z1,))
    _authorize(conn, a, day, sig, 1)  # ordem não executada não ocupa a vaga


@needs_db
def test_conta_real_e_recusada_pelo_banco(conn):
    import psycopg
    a, _, _ = _account_day(conn)
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("update accounts set account_mode='REAL' where id=%s", (a,))


@needs_db
def test_terceira_operacao_e_recusada_pelo_banco(conn):
    import psycopg
    a, day, sig = _account_day(conn)
    z1 = _authorize(conn, a, day, sig, 1)
    with pytest.raises(psycopg.errors.UniqueViolation):  # nunca duas autorizações pendentes
        _authorize(conn, a, day, sig, 2)
    conn.execute("update trade_authorizations set status='EXECUTED' where authorization_id=%s", (z1,))
    z2 = _authorize(conn, a, day, sig, 2)
    conn.execute("update trade_authorizations set status='EXECUTED' where authorization_id=%s", (z2,))
    with pytest.raises(psycopg.errors.CheckViolation):
        _authorize(conn, a, day, sig, 3)
    with pytest.raises(psycopg.errors.UniqueViolation):  # nem repetir a sequência 2
        _authorize(conn, a, day, sig, 2)


@needs_db
def test_risco_acima_de_5_e_recusado(conn):
    import psycopg
    a, day, sig = _account_day(conn)
    with pytest.raises(psycopg.errors.CheckViolation):
        _authorize(conn, a, day, sig, 1, risk=5.01)


@needs_db
def test_duas_posicoes_abertas_sao_recusadas(conn):
    import psycopg
    a, day, sig = _account_day(conn)
    z1 = _authorize(conn, a, day, sig, 1)
    conn.execute("update trade_authorizations set status='EXECUTED' where authorization_id=%s", (z1,))
    z2 = _authorize(conn, a, day, sig, 2)
    conn.execute("insert into positions(account_id,authorization_id,broker_position_ticket,status,opened_at) values (%s,%s,%s,'OPEN',now())",
                 (a, z1, str(uuid.uuid4())))
    with pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute("insert into positions(account_id,authorization_id,broker_position_ticket,status,opened_at) values (%s,%s,%s,'OPEN',now())",
                     (a, z2, str(uuid.uuid4())))


@needs_db
def test_sinal_buy_sem_stop_e_recusado(conn):
    import psycopg
    an = conn.execute("select id from technical_analyses limit 1").fetchone()[0]
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("""insert into trading_signals(analysis_id,decision,entry_timeframe,rationale,reference_price,take_profit,technical_score)
                        values (%s,'BUY','M1','x',1.1,1.12,60)""", (an,))


@needs_db
def test_auditoria_e_somente_insercao(conn):
    import psycopg
    conn.execute("insert into agent_events(kind,actor) values ('TESTE','pytest')")
    with pytest.raises(psycopg.errors.RaiseException):
        conn.execute("delete from agent_events")


@needs_db
def test_notificacao_duplicada_e_recusada(conn):
    import psycopg
    conn.execute("insert into notifications(event_key,text) values ('k1','a')")
    with pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute("insert into notifications(event_key,text) values ('k1','a')")
