import json
import time

import httpx
import pytest

from app.analysis import indicators as ind
from app.analysis.engine import EngineSettings, analyze
from app.backtest import simulate
from app.config import Settings
from app.core import Core
from app.db import Database
from app.demo import DemoAccount, DemoError
from app.ingest import IngestError, check_secret, parse_csv, parse_webhook
from app.market.models import M5, Candle, Market, bucket
from app.market.providers.binance import BinanceProvider, parse_klines
from app.market.providers.simulated import generate
from app.market.providers.twelvedata import parse_series, parse_symbols
from app.market.store import CandleStore
from app.signals import SignalBook
from app.vision import post_check


@pytest.fixture
def db(tmp_path):
    return Database(f"sqlite:///{tmp_path}/t.db")


def trending(n=300, up=True, start=100.0):
    """Série com tendência limpa e um empurrão final com volume, para gerar sinal."""
    out = []
    p = start
    t0 = bucket(time.time()) - n * M5
    step = 0.05 if up else -0.05
    for i in range(n):
        wiggle = 0.12 if i % 4 < 2 else -0.08
        o = p
        c = p + step + (wiggle if up else -wiggle)
        out.append(Candle(t0 + i * M5, o, max(o, c) + 0.03, min(o, c) - 0.03, c, 1000))
        p = c
    return out


def find_setup(decision: str) -> list[Candle]:
    """Procura, em séries sintéticas determinísticas, um trecho que o motor aprova."""
    end = bucket(time.time())
    for seed in range(60):
        bars = generate(seed, 100, 0.002, 400, end)
        for i in range(250, 400):
            cut = bars[:i]
            if analyze(cut, EngineSettings(), now=cut[-1].close_time + 5).decision == decision:
                shift = end - cut[-1].close_time
                return [Candle(b.time + shift, b.open, b.high, b.low, b.close, b.volume) for b in cut]
    raise AssertionError("nenhum setup encontrado")


# ---------------------------------------------------------------- indicadores
def test_ema_and_sma_basic():
    vals = [float(i) for i in range(1, 11)]
    assert ind.sma(vals, 3)[2] == 2.0
    e = ind.ema(vals, 3)
    assert e[1] is None and e[2] == 2.0
    assert e[3] == pytest.approx(4 * 0.5 + 2.0 * 0.5)


def test_rsi_extremes():
    up = [float(i) for i in range(30)]
    assert ind.rsi(up)[-1] == 100.0
    down = [float(30 - i) for i in range(30)]
    assert ind.rsi(down)[-1] == pytest.approx(0.0)


def test_adx_strong_trend_and_atr():
    bars = trending(120)
    h, lo, cl = [b.high for b in bars], [b.low for b in bars], [b.close for b in bars]
    a, pdi, mdi = ind.adx(h, lo, cl)
    assert a[-1] is not None and a[-1] > 25 and pdi[-1] > mdi[-1]
    assert ind.atr(h, lo, cl)[-1] > 0


def test_vwap_none_without_volume():
    bars = trending(30)
    v = ind.vwap([b.time for b in bars], [b.high for b in bars], [b.low for b in bars],
                 [b.close for b in bars], [0.0] * 30)
    assert all(x is None for x in v)


# ---------------------------------------------------------------- motor
def test_insufficient_history_waits():
    a = analyze(trending(100), EngineSettings())
    assert a.decision == "AGUARDAR" and "insuficiente" in a.blockers[0]


def test_uptrend_produces_buy_with_stop_and_targets():
    bars = find_setup("COMPRA")
    a = analyze(bars, EngineSettings(), now=bars[-1].close_time + 5)
    assert a.decision == "COMPRA", a.blockers
    assert a.score >= 70 and a.reasons
    p = a.plan
    assert p.stop < p.entry < p.tp1 < p.tp2
    assert p.zone_low < p.entry < p.zone_high
    assert (p.tp1 - p.entry) / (p.entry - p.stop) == pytest.approx(1.5)


def test_downtrend_produces_sell():
    bars = find_setup("VENDA")
    a = analyze(bars, EngineSettings(), now=bars[-1].close_time + 5)
    assert a.decision == "VENDA", a.blockers
    assert a.plan.tp1 < a.plan.entry < a.plan.stop


def test_late_bar_blocks_signal():
    bars = find_setup("COMPRA")
    a = analyze(bars, EngineSettings(), now=bars[-1].close_time + 600)
    assert a.decision == "AGUARDAR"
    assert any("janela de entrada" in b for b in a.blockers)


def test_stale_data_blocks_signal():
    bars = find_setup("COMPRA")
    a = analyze(bars, EngineSettings(), now=bars[-1].close_time + 5, stale=True)
    assert a.decision == "AGUARDAR"


def test_score_is_not_probability_and_bounded():
    for seed in range(5):
        bars = generate(seed, 100, 0.002, 300, bucket(time.time()))
        a = analyze(bars, EngineSettings())
        assert 0 <= a.score <= 100


# ---------------------------------------------------------------- candles
def test_ticks_build_m5_candles():
    st = CandleStore()
    a = st.ensure("X", Market.B3, "tradingview", True)
    t0 = bucket(time.time()) - 3 * M5
    st.ingest_tick(a, 10.0, 1, t0 + 1)
    st.ingest_tick(a, 12.0, 1, t0 + 100)
    st.ingest_tick(a, 9.0, 1, t0 + 200)
    st.ingest_tick(a, 11.0, 1, t0 + 299)
    assert not a.candles
    closed = st.ingest_tick(a, 11.5, 1, t0 + M5 + 3)
    assert closed and len(a.candles) == 1
    c = a.candles[0]
    assert (c.open, c.high, c.low, c.close, c.volume) == (10.0, 12.0, 9.0, 11.0, 4)


def test_staleness_uses_data_time():
    st = CandleStore()
    a = st.ensure("X", Market.CRYPTO, "binance", True)
    old = bucket(time.time()) - 10 * M5
    st.upsert_bar(a, Candle(old, 1, 1, 1, 1), closed=True)  # chegou agora, mas é dado velho
    assert a.is_stale()
    st.upsert_bar(a, Candle(bucket(time.time()), 1, 1, 1, 1), closed=False)
    assert not a.is_stale()


# ---------------------------------------------------------------- sinais
def _signal_setup(db):
    st = CandleStore()
    a = st.ensure("TEST", Market.CRYPTO, "binance", True)
    bars = find_setup("COMPRA")
    st.load_history(a, bars)
    a.last_price, a.last_update = bars[-1].close, time.time()
    st.upsert_bar(a, Candle(bucket(time.time()), bars[-1].close, bars[-1].close, bars[-1].close,
                            bars[-1].close), closed=False)
    an = analyze(list(a.candles), EngineSettings())
    assert an.decision == "COMPRA", an.blockers
    book = SignalBook(db)
    sig = book.on_analysis(a, an)
    return st, a, book, sig


def test_signal_cancelled_when_price_runs_past_zone(db):
    st, a, book, sig = _signal_setup(db)
    assert sig.status == "ativo"
    assert book.on_analysis(a, analyze(list(a.candles), EngineSettings())) is None
    a.last_price = sig.zone_high + 0.01
    book.on_price(a)
    assert sig.status == "cancelado" and "região de entrada" in sig.status_reason


def test_signal_expires(db):
    st, a, book, sig = _signal_setup(db)
    book.on_price(a, now=sig.valid_until + 1)
    assert sig.status == "expirado"


# ---------------------------------------------------------------- demo
def test_demo_requires_zone_and_hits_target_and_stop(db):
    st, a, book, sig = _signal_setup(db)
    acc = DemoAccount(db)
    acc.update_settings({"initial_balance": 10000, "risk_pct": 1, "daily_loss_limit_pct": 3})
    acc.balance = 10000
    trade = acc.open_from_signal(sig, a, provider_ok=True)
    assert trade.qty == pytest.approx(100 / abs(trade.entry - sig.stop))
    with pytest.raises(DemoError):
        acc.open_from_signal(sig, a, provider_ok=True)  # mesmo ativo
    a.last_price = sig.tp1 + 0.001
    acc.on_price(a)
    closed = [t for t in acc.open_trades()]
    assert closed == []
    assert acc.balance > 10000


def test_demo_blocks_when_connection_bad(db):
    st, a, book, sig = _signal_setup(db)
    acc = DemoAccount(db)
    with pytest.raises(DemoError, match="Conexão"):
        acc.open_from_signal(sig, a, provider_ok=False)


def test_demo_daily_limit_and_emergency(db):
    st, a, book, sig = _signal_setup(db)
    acc = DemoAccount(db)
    acc.update_settings({"risk_pct": 2, "daily_loss_limit_pct": 3})
    acc.open_from_signal(sig, a, provider_ok=True)
    a.last_price = sig.stop - 0.01
    acc.on_price(a)
    assert acc.today_pnl() == pytest.approx(-acc.settings.initial_balance * 0.02, rel=1e-6)
    # segunda perda de 2% passaria do limite de 3% -> recusada antes de entrar
    a.last_price = sig.entry
    with pytest.raises(DemoError, match="limite diário"):
        acc.open_from_signal(sig, a, provider_ok=True)
    sig2 = book.on_analysis(a, analyze(list(a.candles), EngineSettings()))
    assert sig2 is None  # mesmo candle não gera sinal duplicado
    assert acc.emergency(st.assets) == 0
    assert acc.locked and "emergência" in acc.lock_reason
    acc.unlock()
    assert not acc.locked


# ---------------------------------------------------------------- backtest
def test_backtest_runs_and_reports():
    bars = generate(3, 100, 0.002, 600, bucket(time.time()))
    trades, summary = simulate(bars, EngineSettings())
    assert summary["trades"] == len(trades)
    if trades:
        assert 0 <= summary["hit_rate"] <= 1


# ---------------------------------------------------------------- ingestão
def test_webhook_secret_and_parse():
    with pytest.raises(IngestError):
        check_secret("", "x")
    with pytest.raises(PermissionError):
        check_secret("abc", "abd")
    check_secret("abc", "abc")
    p = parse_webhook({"symbol": "win1!", "exchange": "BMFBOVESPA", "timeframe": "5", "time": 1_700_000_100_000,
                       "open": 1, "high": 2, "low": 0.5, "close": 1.5, "volume": 10})
    assert p["market"] == Market.FUTURES and p["candle"].time == 1_700_000_100
    assert parse_webhook({"symbol": "PETR4", "exchange": "BMFBOVESPA", "timeframe": "5", "time": 1, "open": 1,
                          "high": 1, "low": 1, "close": 1})["market"] == Market.B3
    with pytest.raises(IngestError, match="M5"):
        parse_webhook({"symbol": "X", "timeframe": "15", "time": 1, "open": 1, "high": 1, "low": 1, "close": 1})
    with pytest.raises(IngestError, match="ausente"):
        parse_webhook({"symbol": "X", "timeframe": "5", "time": 1, "open": 1})
    with pytest.raises(IngestError, match="inconsistente"):
        parse_webhook({"symbol": "X", "timeframe": "5", "time": 1, "open": 5, "high": 2, "low": 1, "close": 1})


def test_csv_import_requires_m5():
    rows = "time,open,high,low,close,Volume\n" + "\n".join(
        f"{1_700_000_000 + i * 300},1,2,0.5,1.5,10" for i in range(10))
    assert len(parse_csv(rows)) == 10
    bad = "time,open,high,low,close\n" + "\n".join(f"{1_700_000_000 + i * 3600},1,2,0.5,1.5" for i in range(10))
    with pytest.raises(IngestError, match="M5"):
        parse_csv(bad)


# ---------------------------------------------------------------- provedores
def test_binance_parse_and_provider_with_mock():
    now_ms = int(time.time() * 1000)
    b = bucket(time.time())

    def kl(t):
        return [t * 1000, "1", "2", "0.5", "1.5", "100", t * 1000 + 299_999, "0", 1, "0", "0", "0"]

    rows = [kl(b - 300 * i) for i in range(400, 0, -1)] + [kl(b)]
    parsed = parse_klines(rows, now_ms)
    assert parsed[-1][1] is False and parsed[-2][1] is True

    def handler(req: httpx.Request):
        if req.url.path.endswith("ticker/24hr"):
            return httpx.Response(200, json=[{"symbol": "BTCUSDT", "quoteVolume": "9"},
                                             {"symbol": "USDCUSDT", "quoteVolume": "99"},
                                             {"symbol": "ETHUSDT", "quoteVolume": "5"}])
        return httpx.Response(200, json=rows)

    import asyncio
    p = BinanceProvider("https://x", 10, client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    st = CandleStore()
    asyncio.run(p.start(st))
    assert p.status.state == "conectado" and p.symbols == ["BTCUSDT", "ETHUSDT"]
    assert len(st.get("binance:BTCUSDT").candles) == 400
    assert not st.get("binance:BTCUSDT").is_stale()


def test_binance_451_reports_region_block():
    import asyncio
    p = BinanceProvider("https://x", 10, client=httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(451))))
    asyncio.run(p.start(CandleStore()))
    assert p.status.state == "erro" and "451" in p.status.message


def test_twelvedata_parsers():
    assert parse_symbols("forex:EUR/USD, us_stocks:AAPL") == [(Market.FOREX, "EUR/USD"), (Market.US_STOCKS, "AAPL")]
    payload = {"status": "ok", "values": [
        {"datetime": "2026-01-01 10:05:00", "open": "1", "high": "2", "low": "0.5", "close": "1.5"},
        {"datetime": "2026-01-01 10:00:00", "open": "1", "high": "2", "low": "0.5", "close": "1.5", "volume": "3"},
    ]}
    out = parse_series(payload, now=1767261900)  # 10:05 UTC exatos
    assert out[0][0].time == 1767261600 and out[0][1] is True and out[1][1] is False
    with pytest.raises(RuntimeError):
        parse_series({"status": "error", "message": "bad key"}, 0)


# ---------------------------------------------------------------- visão (pós-checagem)
def test_vision_post_check_requests_new_capture():
    base = {"is_chart": True, "symbol": "EURUSD", "timeframe": "15", "last_price": 1.10,
            "visible_datetime_utc": None, "request_new_capture": False}
    r = post_check(dict(base), live_price=1.08, now=time.time())
    assert r["request_new_capture"]
    joined = " ".join(r["server_checks"])
    assert "M5" in joined and "Horário" in joined and "difere" in joined
    ok = post_check({**base, "timeframe": "5m", "last_price": 1.0801,
                     "visible_datetime_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, 1.08, time.time())
    assert ok["server_checks"] == [] and not ok["request_new_capture"]


# ---------------------------------------------------------------- API
def test_api_smoke(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    import app.main as main
    cfg = Settings(database_url=f"sqlite:///{tmp_path}/api.db", binance_enabled=False, simulated_feed=True,
                   tradingview_webhook_secret="s3cret")
    monkeypatch.setattr(main, "settings", cfg)
    core = Core(cfg)
    app = main.create_app(core)
    with TestClient(app) as client:
        assert client.get("/api/status").json()["running"] is False
        st = client.post("/api/scanner/start").json()
        assert st["running"] and st["simulated_present"]
        assets = client.get("/api/assets").json()["assets"]
        assert len(assets) == 7 and all(a["is_live"] is False for a in assets)
        key = assets[0]["key"]
        ch = client.get(f"/api/assets/{key}/chart").json()
        assert ch["candles"] and "ema200" in ch["series"]
        mk = {m["market"]: m for m in client.get("/api/markets").json()["markets"]}
        assert mk["crypto"]["coverage"] == "simulado"
        r = client.post("/api/webhooks/tradingview", json={"secret": "nope", "symbol": "PETR4"})
        assert r.status_code == 401
        r = client.post("/api/webhooks/tradingview", content=json.dumps({
            "secret": "s3cret", "symbol": "PETR4", "exchange": "BMFBOVESPA", "timeframe": "5",
            "time": (bucket(time.time()) - 300) * 1000, "open": 37, "high": 38, "low": 36.5, "close": 37.5,
            "volume": 1000}))
        assert r.status_code == 200 and r.json()["asset"] == "tradingview:PETR4"
        assert client.get("/api/stats").json()["live"]["available"] is False
        r = client.post("/api/vision/analyze", files={"file": ("a.png", b"x", "image/png")})
        assert r.status_code == 503  # sem ANTHROPIC_API_KEY: avisa em vez de inventar
        r = client.put("/api/settings/engine", json={"stop_atr_mult": 0})
        assert r.status_code == 422
        bt = client.post("/api/backtest", json={"asset_key": key})
        assert bt.status_code == 200 and "hit_rate" in bt.json()
        with client.websocket_connect("/ws") as ws:
            assert ws.receive_json()["type"] == "snapshot"
