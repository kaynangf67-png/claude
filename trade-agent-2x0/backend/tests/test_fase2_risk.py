"""Testes da Fase 2: Risk Manager 2x0 com banco real (PostgreSQL), sessões, sizing, autenticação e rotas.

Numeração = testes obrigatórios da especificação (seção 16).
"""
from __future__ import annotations

import os
import subprocess
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import psycopg
import pytest

from app.core.contracts import Decision, RiskState, SymbolSpec
from app.core.security import RateLimiter, hash_password, issue_token, read_token, verify_password
from app.core.sessions import active_sessions, sessions_for, trading_day
from app.engines.risk_manager.service import RiskManagerService, derive_state
from app.engines.risk_manager.sizing import ExecCosts, size_position, validate_levels

BACKEND = Path(__file__).resolve().parents[1]
DB = os.environ.get("TEST_DATABASE_URL")
needs_db = pytest.mark.skipif(not DB, reason="defina TEST_DATABASE_URL para os testes de banco")

SPEC = SymbolSpec("EURUSD", tick_size=0.00001, tick_value=1.0, contract_size=100_000, volume_min=0.01,
                  volume_step=0.01, volume_max=100, account_currency="USD")
COSTS = ExecCosts(spread_price=0.0001, slippage_price=0.00002, commission_per_lot=7.0)
FX = 5.5  # USD→BRL só para teste


class Clock:
    def __init__(self, t: datetime):
        self.t = t

    def __call__(self) -> datetime:
        return self.t


# ---------- puros: sizing, níveis, estado, sessões, segurança ----------

def test_sizing_arredonda_para_baixo_e_nunca_passa_de_5():
    r = size_position(spec=SPEC, entry=1.1, stop=1.0995, costs=COSTS, fx_to_brl=FX, max_risk_brl=5)
    assert r.ok and r.lots == 0.01 and r.planned_risk_brl <= 5  # 62 ticks + 7 USD = 69 USD/lote → R$ 3,80


def test_11_volume_acima_do_risco_nunca_e_calculado():
    for stop_pips in range(1, 9):
        r = size_position(spec=SPEC, entry=1.1, stop=1.1 - stop_pips * 0.0001, costs=COSTS, fx_to_brl=FX, max_risk_brl=5)
        if r.ok:
            assert r.planned_risk_brl <= 5.0


def test_12_volume_minimo_incompativel_com_5_reais():
    r = size_position(spec=SPEC, entry=1.1, stop=1.097, costs=COSTS, fx_to_brl=FX, max_risk_brl=5)
    assert not r.ok and "volume mínimo" in r.reason and r.planned_risk_brl > 5


def test_sem_cambio_valido_recusa():
    assert not size_position(spec=SPEC, entry=1.1, stop=1.0995, costs=COSTS, fx_to_brl=0, max_risk_brl=5).ok


@pytest.mark.parametrize("d,e,sl,tp", [
    (Decision.BUY, 1.1, 1.101, 1.102),   # stop acima na compra
    (Decision.SELL, 1.1, 1.099, 1.098),  # stop abaixo na venda
    (Decision.BUY, 1.1, 0, 1.102),       # stop zero
    (Decision.NO_TRADE, 1.1, 1.099, 1.102),
])
def test_10_stop_loss_invalido(d, e, sl, tp):
    assert validate_levels(d, e, sl, tp) is not None


def test_derive_state_cobre_a_tabela_2x0():
    assert derive_state([], None) is RiskState.READY
    assert derive_state([], 1) is RiskState.FIRST_TRADE_ACTIVE
    assert derive_state(["WIN"], None) is RiskState.FIRST_WIN
    assert derive_state(["WIN"], 2) is RiskState.SECOND_TRADE_ACTIVE
    assert derive_state(["WIN", "WIN"], None) is RiskState.TARGET_REACHED
    assert derive_state(["LOSS"], None) is RiskState.DAILY_LOCKED
    assert derive_state(["WIN", "LOSS"], None) is RiskState.DAILY_LOCKED


def test_19_sessoes_mudam_com_o_horario_de_verao():
    # Em 2026, os EUA voltam do horário de verão em 1º/nov e Londres em 25/out.
    ny_verao = next(w for w in sessions_for(date(2026, 10, 20)) if w.name == "Nova York")
    ny_inverno = next(w for w in sessions_for(date(2026, 11, 4)) if w.name == "Nova York")
    assert (ny_verao.start.hour, ny_inverno.start.hour) == (9, 10)  # Brasília não tem horário de verão
    lon_verao = next(w for w in sessions_for(date(2026, 7, 1)) if w.name == "Londres")
    lon_inverno = next(w for w in sessions_for(date(2026, 12, 1)) if w.name == "Londres")
    assert (lon_verao.start.hour, lon_inverno.start.hour) == (4, 5)
    # Semana entre as duas mudanças (27/out): Londres já saiu do verão, NY ainda não → sobreposição muda
    ov = next(w for w in sessions_for(date(2026, 10, 27)) if w.name.startswith("Sobreposição"))
    assert (ov.start.hour, ov.end.hour) == (9, 14)
    assert sessions_for(date(2026, 11, 7)) == []  # sábado
    assert active_sessions(datetime(2026, 11, 4, 14, 0, tzinfo=timezone.utc)) == ["Londres", "Nova York",
                                                                                  "Sobreposição Londres/Nova York"]


def test_dia_operacional_e_o_de_sao_paulo():
    assert trading_day(datetime(2026, 11, 5, 2, 59, tzinfo=timezone.utc)) == date(2026, 11, 4)  # 23:59 em SP
    assert trading_day(datetime(2026, 11, 5, 3, 0, tzinfo=timezone.utc)) == date(2026, 11, 5)
    with pytest.raises(ValueError):
        trading_day(datetime(2026, 11, 5))


def test_senha_e_token():
    h = hash_password("senha-forte-123")
    assert verify_password("senha-forte-123", h) and not verify_password("outra-senha-1", h)
    with pytest.raises(ValueError):
        hash_password("curta")
    s = "x" * 40
    t = issue_token(s, "u1", "admin", now=1000)
    assert read_token(s, t, now=1001)["role"] == "admin"
    assert read_token("y" * 40, t, now=1001) is None                 # assinatura errada
    assert read_token(s, t, now=1000 + 9 * 3600) is None             # expirado
    body, sig = t.split(".")
    assert read_token(s, body[:-2] + "AA." + sig, now=1001) is None  # adulterado


def test_limite_de_tentativas():
    rl = RateLimiter(2, 60)
    assert rl.allow("ip", 0) and rl.allow("ip", 1) and not rl.allow("ip", 2) and rl.allow("ip", 61)


# ---------- banco ----------

@pytest.fixture(scope="module")
def url():
    u = DB.replace("postgresql+psycopg://", "postgresql://")
    env = {**os.environ, "DATABASE_URL": u}
    with psycopg.connect(u, autocommit=True) as c0:
        c0.execute("drop schema public cascade; create schema public")
    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND, env=env, check=True, capture_output=True)
    return u


@pytest.fixture
def clock():
    return Clock(datetime(2026, 11, 4, 14, 0, tzinfo=timezone.utc))  # 11:00 em São Paulo


@pytest.fixture
def rm(url, clock):
    return RiskManagerService(url, clock=clock)


@pytest.fixture
def account(url):
    with psycopg.connect(url, autocommit=True) as c:
        u = c.execute("insert into users(email,password_hash,role) values (%s,%s,'operator') returning id",
                      (f"{uuid.uuid4()}@t.com", hash_password("senha-forte-123"))).fetchone()[0]
        b = c.execute("insert into brokers(name,server) values (%s,'demo') returning id", (str(uuid.uuid4()),)).fetchone()[0]
        a = c.execute("insert into accounts(user_id,broker_id,login,currency) values (%s,%s,'1','USD') returning id",
                      (u, b)).fetchone()[0]
    return {"id": a, "user": u}


def signal(url, direction="BUY", entry=1.1, sl=1.0995, tp=1.101, valid_minutes=5, clock=None):
    now = clock() if clock else datetime.now(timezone.utc)
    with psycopg.connect(url, autocommit=True) as c:
        asset = c.execute("select id from assets where symbol='EURUSD'").fetchone()[0]
        model = c.execute("select id from strategy_models where code='SCALPING'").fetchone()[0]
        an = c.execute("insert into technical_analyses(asset_id,model_id,data_source,context) values (%s,%s,'HISTORICAL','{}') returning id",
                       (asset, model)).fetchone()[0]
        return c.execute("""insert into trading_signals(analysis_id,decision,entry_timeframe,rationale,reference_price,stop_loss,
                            take_profit,technical_score,valid_until) values (%s,%s,'M1','teste',%s,%s,%s,60,%s) returning id""",
                         (an, direction, entry, sl, tp, now + timedelta(minutes=valid_minutes))).fetchone()[0]


def authorize(rm, url, acc, clock, **kw):
    return rm.authorize(account_id=acc["id"], signal_id=signal(url, clock=clock, **kw), spec=SPEC, costs=COSTS, fx_to_brl=FX)


def open_and_close(rm, auth, clock, result_usd):
    rm.mark_picked_up(auth.authorization_id)
    t = clock()
    rm.on_position_opened(auth.authorization_id, position_ticket=f"P{uuid.uuid4().hex[:8]}", deal_ticket=f"D{uuid.uuid4().hex[:8]}",
                          price=1.1, volume_lots=auth.volume_lots, commission=0.07, opened_at=t)
    return rm.on_position_closed(auth.authorization_id, deal_ticket=f"X{uuid.uuid4().hex[:8]}", price=1.101,
                                 gross_result=result_usd, costs=0.07, fx_to_brl=FX, closed_at=t)


def state(rm, acc):
    return RiskState(rm.today(acc["id"])["state"])


@needs_db
def test_1_primeira_operacao_vencedora(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    assert d.authorized and d.state is RiskState.FIRST_TRADE_ACTIVE and d.authorization.volume_lots == 0.01
    assert open_and_close(rm, d.authorization, clock, 1.0) is RiskState.FIRST_WIN
    t = rm.today(account["id"])
    assert (t["wins"], t["losses"], t["trades_taken"], t["entries_allowed"]) == (1, 0, 1, True)


@needs_db
def test_2_primeira_operacao_perdedora_trava_o_dia(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    assert open_and_close(rm, d.authorization, clock, -0.5) is RiskState.DAILY_LOCKED
    nova = authorize(rm, url, account, clock)
    assert not nova.authorized and "DAILY_LOCKED" in nova.reason


@needs_db
def test_empate_liquido_conta_como_derrota(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    assert open_and_close(rm, d.authorization, clock, 0.07) is RiskState.DAILY_LOCKED  # bruto 0,07 − custo 0,07 = 0


@needs_db
def test_3_segunda_vencedora_atinge_a_meta(rm, url, account, clock):
    open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, 1.0)
    d2 = authorize(rm, url, account, clock)
    assert d2.authorized and d2.state is RiskState.SECOND_TRADE_ACTIVE
    assert open_and_close(rm, d2.authorization, clock, 1.0) is RiskState.TARGET_REACHED


@needs_db
def test_4_segunda_perdedora_trava_o_dia(rm, url, account, clock):
    open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, 1.0)
    assert open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, -0.5) is RiskState.DAILY_LOCKED


@needs_db
def test_5_terceira_operacao_e_recusada(rm, url, account, clock):
    open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, 1.0)
    open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, 1.0)
    d3 = authorize(rm, url, account, clock)
    assert not d3.authorized and "TARGET_REACHED" in d3.reason


@needs_db
def test_nunca_duas_entradas_ao_mesmo_tempo(rm, url, account, clock):
    assert authorize(rm, url, account, clock).authorized
    d = authorize(rm, url, account, clock)
    assert not d.authorized and "FIRST_TRADE_ACTIVE" in d.reason


@needs_db
def test_6_reinicio_durante_operacao_mantem_o_estado(url, account, clock):
    rm1 = RiskManagerService(url, clock=clock)
    d = authorize(rm1, url, account, clock)
    rm1.mark_picked_up(d.authorization.authorization_id)
    rm1.on_position_opened(d.authorization.authorization_id, position_ticket="P-REINICIO", deal_ticket="D-REINICIO",
                           price=1.1, volume_lots=0.01, commission=0.07, opened_at=clock())
    del rm1  # "servidor caiu"
    rm2 = RiskManagerService(url, clock=clock)
    assert state(rm2, account) is RiskState.FIRST_TRADE_ACTIVE
    assert not authorize(rm2, url, account, clock).authorized
    assert rm2.on_position_closed(d.authorization.authorization_id, deal_ticket="X-REINICIO", price=1.101, gross_result=1,
                                  costs=0.07, fx_to_brl=FX, closed_at=clock()) is RiskState.FIRST_WIN


@needs_db
def test_7e8_resposta_incerta_bloqueia_ate_reconciliar(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    rm.mark_picked_up(d.authorization.authorization_id)
    assert rm.on_order_uncertain(d.authorization.authorization_id, reason="timeout") is RiskState.RECONCILIATION_REQUIRED
    assert not authorize(rm, url, account, clock).authorized
    ok, msg = rm.reconcile(account["id"], "user:teste")
    assert not ok and "incerto" in msg
    rm.resolve_uncertain_order(d.authorization.authorization_id, position_exists=False, actor="user:teste")
    ok, _ = rm.reconcile(account["id"], "user:teste")
    assert ok and state(rm, account) is RiskState.READY  # a ordem nunca virou posição: a vaga volta


@needs_db
def test_9_ordem_duplicada_nao_duplica(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    aid = d.authorization.authorization_id
    assert rm.mark_picked_up(aid) and not rm.mark_picked_up(aid)  # o EA não pega a mesma autorização duas vezes
    kw = dict(position_ticket="P-DUP", deal_ticket="D-DUP", price=1.1, volume_lots=0.01, commission=0.07, opened_at=clock())
    rm.on_position_opened(aid, **kw)
    assert rm.on_position_opened(aid, **kw) is RiskState.FIRST_TRADE_ACTIVE  # aviso repetido é ignorado
    close = dict(deal_ticket="X-DUP", price=1.101, gross_result=1, costs=0.07, fx_to_brl=FX, closed_at=clock())
    rm.on_position_closed(aid, **close)
    assert rm.on_position_closed(aid, **close) is RiskState.FIRST_WIN
    t = rm.today(account["id"])
    assert (t["trades_taken"], t["wins"]) == (1, 1)
    # mesma autorização com OUTRA posição → divergência → reconciliação
    assert rm.on_position_opened(aid, **{**kw, "position_ticket": "P-OUTRA", "deal_ticket": "D-OUTRA"}) is RiskState.RECONCILIATION_REQUIRED


@needs_db
def test_volume_executado_acima_do_autorizado_bloqueia(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    st = rm.on_position_opened(d.authorization.authorization_id, position_ticket="P-VOL", deal_ticket="D-VOL", price=1.1,
                               volume_lots=0.05, commission=0.3, opened_at=clock())
    assert st is RiskState.RECONCILIATION_REQUIRED


@needs_db
def test_10_sinal_com_stop_invalido_e_recusado(rm, url, account, clock):
    d = authorize(rm, url, account, clock, sl=1.1005)  # compra com stop acima
    assert not d.authorized and "Stop Loss abaixo" in d.reason
    assert state(rm, account) is RiskState.READY


@needs_db
def test_12_volume_minimo_incompativel_recusa_no_servico(rm, url, account, clock):
    d = authorize(rm, url, account, clock, sl=1.097)
    assert not d.authorized and "volume mínimo" in d.reason


@needs_db
def test_autorizacao_vencida_libera_a_vaga(rm, url, account, clock):
    assert authorize(rm, url, account, clock).authorized
    clock.t += timedelta(minutes=2)  # passou do TTL sem o EA pegar
    assert state(rm, account) is RiskState.READY
    assert authorize(rm, url, account, clock).authorized


@needs_db
def test_sinal_vencido_e_recusado(rm, url, account, clock):
    d = authorize(rm, url, account, clock, valid_minutes=-1)
    assert not d.authorized and "vencido" in d.reason


@needs_db
def test_rejeicao_da_corretora_libera_a_vaga(rm, url, account, clock):
    d = authorize(rm, url, account, clock)
    rm.mark_picked_up(d.authorization.authorization_id)
    assert rm.on_order_rejected(d.authorization.authorization_id, retcode=10019, message="sem margem") is RiskState.READY


@needs_db
def test_13_virada_do_dia_com_posicao_aberta(rm, url, account, clock):
    clock.t = datetime(2026, 11, 5, 2, 30, tzinfo=timezone.utc)  # 23:30 do dia 4 em SP
    d = authorize(rm, url, account, clock)
    rm.mark_picked_up(d.authorization.authorization_id)
    rm.on_position_opened(d.authorization.authorization_id, position_ticket="P-VIRADA", deal_ticket="D-VIRADA", price=1.1,
                          volume_lots=0.01, commission=0.07, opened_at=clock())
    clock.t = datetime(2026, 11, 5, 3, 30, tzinfo=timezone.utc)  # 00:30 do dia 5
    hoje = rm.today(account["id"])
    assert hoje["trading_day"] == "2026-11-05" and hoje["state"] == "RECONCILIATION_REQUIRED" and not hoje["entries_allowed"]
    assert not authorize(rm, url, account, clock).authorized
    ok, msg = rm.reconcile(account["id"], "user:teste")
    assert not ok and "aberta" in msg
    # a posição fecha com lucro: conta no DIA 4, não no dia 5
    rm.on_position_closed(d.authorization.authorization_id, deal_ticket="X-VIRADA", price=1.101, gross_result=1, costs=0.07,
                          fx_to_brl=FX, closed_at=clock())
    ok, _ = rm.reconcile(account["id"], "user:teste")
    assert ok
    with psycopg.connect(url) as c:
        d4 = c.execute("select state, wins from daily_risk_states where account_id=%s and trading_day='2026-11-04'",
                       (account["id"],)).fetchone()
    assert d4 == ("FIRST_WIN", 1)
    assert state(rm, account) is RiskState.READY  # dia 5 começa limpo


@needs_db
def test_14_reconciliacao_preserva_resultados(rm, url, account, clock):
    open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, 1.0)
    rm.require_reconciliation(account["id"], "divergência simulada")
    assert state(rm, account) is RiskState.RECONCILIATION_REQUIRED
    ok, _ = rm.reconcile(account["id"], "user:teste")
    assert ok and state(rm, account) is RiskState.FIRST_WIN  # volta ao estado dos fatos, sem zerar a vitória


@needs_db
def test_15e16_pausa_e_retomada(rm, url, account, clock):
    rm.pause(account["id"], "user:teste")
    d = authorize(rm, url, account, clock)
    assert not d.authorized and "pausadas" in d.reason
    rm.resume(account["id"], "user:teste")
    assert authorize(rm, url, account, clock).authorized


@needs_db
def test_emergencia_bloqueia_e_fica_registrada(rm, url, account, clock):
    rm.emergency_stop(account["id"], "user:teste", "mercado estranho")
    assert not authorize(rm, url, account, clock).authorized
    with psycopg.connect(url) as c:
        kinds = [r[0] for r in c.execute("select kind from agent_events where account_id=%s", (account["id"],))]
    assert "EMERGENCY_STOP" in kinds and "AUTHORIZATION_DENIED" in kinds
    rm.clear_emergency(account["id"], "user:admin")
    assert authorize(rm, url, account, clock).authorized


@needs_db
def test_transicoes_sao_auditadas(rm, url, account, clock):
    open_and_close(rm, authorize(rm, url, account, clock).authorization, clock, 1.0)
    with psycopg.connect(url) as c:
        rows = c.execute("select kind, from_state, to_state from agent_events where account_id=%s order by id",
                         (account["id"],)).fetchall()
    assert ("AUTHORIZATION_ISSUED", "READY", "FIRST_TRADE_ACTIVE") in rows
    assert ("POSITION_CLOSED", "FIRST_TRADE_ACTIVE", "FIRST_WIN") in rows


def test_17_falha_do_banco_nao_autoriza_nada(clock):
    rm = RiskManagerService("postgresql://ninguem:x@127.0.0.1:1/nada", clock=clock)
    with pytest.raises(psycopg.OperationalError):
        rm.authorize(account_id=uuid.uuid4(), signal_id=uuid.uuid4(), spec=SPEC, costs=COSTS, fx_to_brl=FX)


# ---------- rotas ----------

@needs_db
def test_rotas_login_estado_e_controles(url, account, monkeypatch):
    from fastapi.testclient import TestClient

    from app.api import routes
    from app.main import app
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("AUTH_SECRET", "s" * 40)
    routes.login_limiter.hits.clear()
    c = TestClient(app)
    with psycopg.connect(url) as conn:
        email = conn.execute("select email from users where id=%s", (account["user"],)).fetchone()[0]
    assert c.post("/api/v1/auth/login", json={"email": email, "password": "errada-errada"}).status_code == 401
    tok = c.post("/api/v1/auth/login", json={"email": email, "password": "senha-forte-123"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    aid = str(account["id"])
    assert c.get(f"/api/v1/accounts/{aid}/risk/today").status_code == 401
    assert c.get(f"/api/v1/accounts/{aid}/risk/today", headers=h).json()["state"] == "READY"
    assert c.post(f"/api/v1/accounts/{aid}/control/pause", headers=h).json()["ok"]
    assert c.get(f"/api/v1/accounts/{aid}/risk/today", headers=h).json()["entries_allowed"] is False
    assert c.post(f"/api/v1/accounts/{aid}/control/emergency", headers=h, json={"reason": "teste"}).json()["ok"]
    assert c.post(f"/api/v1/accounts/{aid}/control/emergency/clear", headers=h).status_code == 403  # operador não libera
    outra = str(uuid.uuid4())
    assert c.get(f"/api/v1/accounts/{outra}/risk/today", headers=h).status_code == 404  # conta de outro
    for _ in range(5):
        c.post("/api/v1/auth/login", json={"email": email, "password": "errada-errada"})
    assert c.post("/api/v1/auth/login", json={"email": email, "password": "senha-forte-123"}).status_code == 429
