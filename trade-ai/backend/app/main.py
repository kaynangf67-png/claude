"""API HTTP + WebSocket do Trade AI."""

from __future__ import annotations

import asyncio
import contextlib
import time
from contextlib import asynccontextmanager
from dataclasses import asdict

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from . import vision
from .analysis.engine import EngineSettings, analyze, series_for_chart
from .backtest import run_backtest, summarize
from .config import settings
from .core import Core
from .db import BacktestRunRow, EventLogRow, TradeRow
from .demo import DemoError
from .ingest import IngestError, check_secret, parse_csv, parse_market, parse_webhook


def create_app(core: Core | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.core = app.state.core or Core(settings)
        await app.state.core.startup()
        yield
        await app.state.core.shutdown()

    app = FastAPI(title="Trade AI", version="0.1.0", lifespan=lifespan)
    app.state.core = core
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                       allow_methods=["*"], allow_headers=["*"])

    def c(request: Request) -> Core:
        return request.app.state.core

    # ------------------------------------------------------------ status
    @app.get("/api/health")
    def health():
        return {"ok": True, "time": time.time()}

    @app.get("/api/status")
    def status(request: Request):
        return c(request).status()

    @app.post("/api/scanner/start")
    async def start(request: Request):
        await c(request).start_scanner()
        return c(request).status()

    @app.post("/api/scanner/stop")
    async def stop(request: Request):
        await c(request).stop_scanner()
        return c(request).status()

    @app.get("/api/markets")
    def markets(request: Request):
        core = c(request)
        return {"markets": core.markets_status(), "providers": core.providers_status()}

    # ------------------------------------------------------------ ativos
    @app.get("/api/assets")
    def assets(request: Request, market: str | None = None, q: str | None = None, trend: str | None = None,
               min_score: int = 0, decision: str | None = None, sort: str = "score", only_fresh: bool = False):
        core = c(request)
        rows = [core.asset_row(a) for a in core.store.assets.values()]
        if market:
            rows = [r for r in rows if r["market"] == market]
        if q:
            ql = q.lower()
            rows = [r for r in rows if ql in r["symbol"].lower() or ql in r["display"].lower()]
        if trend:
            rows = [r for r in rows if r["trend"] == trend]
        if min_score:
            rows = [r for r in rows if (r["score"] or 0) >= min_score]
        if decision:
            rows = [r for r in rows if r["decision"] == decision]
        if only_fresh:
            rows = [r for r in rows if not r["stale"]]
        if sort == "symbol":
            rows.sort(key=lambda r: r["symbol"])
        elif sort == "change":
            rows.sort(key=lambda r: abs(r["change_pct"] or 0), reverse=True)
        else:
            rank = {"COMPRA": 0, "VENDA": 0, "AGUARDAR": 1, None: 2}
            rows.sort(key=lambda r: (r["stale"], rank[r["decision"]], -(r["score"] or 0)))
        return {"assets": rows, "total": len(core.store.assets)}

    @app.get("/api/assets/{key:path}/chart")
    def chart(request: Request, key: str, limit: int = Query(300, le=600)):
        core = c(request)
        a = core.store.get(key)
        if a is None:
            raise HTTPException(404, "Ativo não encontrado")
        candles = list(a.candles)
        an = core.analyses.get(key) or analyze(candles, core.engine_settings, stale=a.is_stale())
        series = series_for_chart(candles)
        cut = candles[-limit:][0].time if candles else 0
        trimmed = {k: [p for p in v if p["time"] >= cut] for k, v in series.items()}
        sig = next((s for s in core.signals.recent(200) if s.asset_key == key), None)
        return {
            "asset": core.asset_row(a),
            "candles": [x.to_dict() for x in candles[-limit:]],
            "forming": a.forming.to_dict() if a.forming else None,
            "series": trimmed, "analysis": an.to_dict(),
            "signal": sig.to_dict() if sig else None,
        }

    # ------------------------------------------------------------ sinais
    @app.get("/api/signals")
    def signals(request: Request, status: str | None = None, limit: int = 100):
        sigs = c(request).signals.recent(limit)
        if status:
            sigs = [s for s in sigs if s.status == status]
        return {"signals": [s.to_dict() for s in sigs]}

    # ------------------------------------------------------------ configurações
    @app.get("/api/settings")
    def get_settings(request: Request):
        core = c(request)
        return {"engine": asdict(core.engine_settings), "demo": asdict(core.demo.settings),
                "integrations": {
                    "binance": settings.binance_enabled, "twelvedata": bool(settings.twelvedata_api_key),
                    "tradingview_webhook": bool(settings.tradingview_webhook_secret),
                    "vision": bool(settings.anthropic_api_key), "simulated_feed": settings.simulated_feed,
                    "database": settings.database_url.split(":")[0],
                }}

    @app.put("/api/settings/engine")
    def put_engine(request: Request, body: dict):
        core = c(request)
        merged = {**asdict(core.engine_settings), **body}
        try:
            es = EngineSettings.from_dict(merged)
        except TypeError as e:
            raise HTTPException(422, str(e)) from e
        if not (40 <= es.min_score <= 100):
            raise HTTPException(422, "Pontuação mínima deve ficar entre 40 e 100")
        if es.tp1_rr < 1 or es.tp2_rr < es.tp1_rr:
            raise HTTPException(422, "Alvo 1 precisa de R:R >= 1 e alvo 2 >= alvo 1")
        if es.stop_atr_mult <= 0:
            raise HTTPException(422, "Stop é obrigatório (multiplicador de ATR > 0)")
        core.engine_settings = es
        core.db.kv_set("engine_settings", asdict(es))
        core.analyze_all()
        return asdict(es)

    @app.put("/api/settings/demo")
    def put_demo(request: Request, body: dict):
        try:
            c(request).demo.update_settings(body)
        except (DemoError, TypeError) as e:
            raise HTTPException(422, str(e)) from e
        return asdict(c(request).demo.settings)

    # ------------------------------------------------------------ demo
    @app.get("/api/demo/account")
    def account(request: Request):
        core = c(request)
        st = core.demo.state()
        for t in st["open_trades"]:
            a = core.store.get(t["asset_key"])
            t["last_price"] = a.last_price if a else None
            t["data_ok"] = bool(a and not a.is_stale())
            if a and a.last_price is not None:
                sign = 1 if t["direction"] == "long" else -1
                t["unrealized"] = (a.last_price - t["entry"]) * t["qty"] * sign
        return st

    @app.post("/api/demo/trades")
    def open_trade(request: Request, body: dict):
        core = c(request)
        sig = core.signals.signals.get(body.get("signal_id", ""))
        if sig is None:
            raise HTTPException(404, "Sinal não encontrado")
        asset = core.store.get(sig.asset_key)
        if asset is None:
            raise HTTPException(404, "Ativo sem dados")
        try:
            row = core.demo.open_from_signal(sig, asset, core.provider_ok(asset))
        except DemoError as e:
            raise HTTPException(409, str(e)) from e
        core.signals.close(sig, "executado", "Executado na conta demo")
        return row.to_dict()

    @app.post("/api/demo/trades/{trade_id}/close")
    def close_trade(request: Request, trade_id: int):
        core = c(request)
        with core.db.session() as s:
            row = s.get(TradeRow, trade_id)
        if row is None:
            raise HTTPException(404, "Operação não encontrada")
        a = core.store.get(row.asset_key)
        if a is None or a.last_price is None or a.is_stale():
            raise HTTPException(409, "Sem preço atualizado para fechar; use o botão de emergência")
        try:
            return core.demo.close_trade(trade_id, a.last_price, "manual").to_dict()
        except DemoError as e:
            raise HTTPException(409, str(e)) from e

    @app.post("/api/demo/emergency")
    def emergency(request: Request):
        core = c(request)
        n = core.demo.emergency(core.store.assets)
        core.db.log("demo", f"EMERGÊNCIA: {n} operações fechadas, conta travada")
        return {"closed": n, "account": core.demo.state()}

    @app.post("/api/demo/unlock")
    def unlock(request: Request):
        try:
            c(request).demo.unlock()
        except DemoError as e:
            raise HTTPException(409, str(e)) from e
        return c(request).demo.state()

    @app.post("/api/demo/reset")
    def reset(request: Request, body: dict):
        try:
            c(request).demo.reset(float(body.get("initial_balance", 10000)))
        except (DemoError, ValueError) as e:
            raise HTTPException(422, str(e)) from e
        return c(request).demo.state()

    # ------------------------------------------------------------ histórico e estatísticas
    @app.get("/api/trades")
    def trades(request: Request, mode: str = "demo", limit: int = Query(200, le=2000)):
        with c(request).db.session() as s:
            rows = s.scalars(select(TradeRow).where(TradeRow.mode == mode)
                             .order_by(TradeRow.opened_at.desc()).limit(limit))
            return {"mode": mode, "trades": [r.to_dict() for r in rows]}

    @app.get("/api/stats")
    def stats(request: Request):
        core = c(request)
        with core.db.session() as s:
            demo = list(s.scalars(select(TradeRow).where(TradeRow.mode == "demo", TradeRow.status == "fechada")
                                  .order_by(TradeRow.closed_at)))
            bt = list(s.scalars(select(TradeRow).where(TradeRow.mode == "backtest")))
            runs = list(s.scalars(select(BacktestRunRow).order_by(BacktestRunRow.created_at.desc()).limit(20)))
        initial = core.demo.settings.initial_balance
        equity, eq = [], initial
        for t in demo:
            eq += t.pnl or 0
            equity.append({"time": t.closed_at, "value": eq})
        demo_sum = summarize([t.r_multiple or 0 for t in demo])
        demo_sum["pnl"] = sum(t.pnl or 0 for t in demo)
        demo_sum["simulated_feed_trades"] = sum(1 for t in demo if not t.data_is_live)
        return {
            "demo": demo_sum, "equity": equity, "initial_balance": initial,
            "backtest": summarize([t.r_multiple or 0 for t in bt]),
            "backtest_runs": [{"id": r.id, "asset_key": r.asset_key, "created_at": r.created_at, **r.summary}
                              for r in runs],
            "live": {"available": False,
                     "note": "Sem conexão com corretora: o Trade AI não executa ordens reais."},
        }

    @app.post("/api/backtest")
    async def backtest(request: Request, body: dict):
        core = c(request)
        a = core.store.get(body.get("asset_key", ""))
        if a is None:
            raise HTTPException(404, "Ativo não encontrado")
        try:
            return await run_in_threadpool(run_backtest, core.db, a, core.engine_settings,
                                           core.demo.settings.target)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e

    @app.get("/api/events")
    def events(request: Request, limit: int = 50):
        with c(request).db.session() as s:
            rows = s.scalars(select(EventLogRow).order_by(EventLogRow.at.desc()).limit(limit))
            return {"events": [{"at": r.at, "kind": r.kind, "message": r.message} for r in rows]}

    # ------------------------------------------------------------ TradingView
    @app.post("/api/webhooks/tradingview")
    async def tv_webhook(request: Request):
        try:
            payload = await request.json()
        except Exception as e:  # noqa: BLE001
            raise HTTPException(400, "Corpo precisa ser JSON") from e
        if not isinstance(payload, dict):
            raise HTTPException(400, "Corpo precisa ser um objeto JSON")
        try:
            check_secret(settings.tradingview_webhook_secret, payload.get("secret"))
            parsed = parse_webhook(payload)
        except PermissionError as e:
            raise HTTPException(401, str(e)) from e
        except IngestError as e:
            raise HTTPException(422 if settings.tradingview_webhook_secret else 503, str(e)) from e
        return c(request).ingest_webhook(parsed)

    @app.post("/api/import/csv")
    async def import_csv(request: Request, file: UploadFile = File(...), symbol: str = Form(...),
                         market: str = Form("b3")):
        raw = await file.read()
        if len(raw) > 10 * 1024 * 1024:
            raise HTTPException(413, "CSV acima de 10 MB")
        try:
            candles = parse_csv(raw.decode("utf-8-sig"))
        except (IngestError, UnicodeDecodeError) as e:
            raise HTTPException(422, str(e)) from e
        return c(request).import_candles(symbol, parse_market(market), candles)

    # ------------------------------------------------------------ visão
    @app.post("/api/vision/analyze")
    async def vision_analyze(request: Request, file: UploadFile = File(...), asset_key: str | None = Form(None)):
        data = await file.read()
        try:
            result = await run_in_threadpool(vision.analyze_image, data, file.content_type or "")
        except vision.VisionUnavailable as e:
            raise HTTPException(503, str(e)) from e
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        core = c(request)
        live = None
        if asset_key and (a := core.store.get(asset_key)) and not a.is_stale():
            live = a.last_price
        elif result.get("symbol"):
            sym = result["symbol"].upper().replace("/", "")
            match = next((a for a in core.store.assets.values()
                          if a.symbol.upper().replace("/", "") == sym and not a.is_stale()), None)
            live = match.last_price if match else None
        return vision.post_check(result, live, time.time())

    # ------------------------------------------------------------ websocket
    @app.websocket("/ws")
    async def ws(socket: WebSocket):
        await socket.accept()
        core: Core = socket.app.state.core
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        core.clients.add(q)
        try:
            await socket.send_json({"type": "snapshot", "status": core.status(),
                                    "signals": [s.to_dict() for s in core.signals.recent(30)],
                                    "account": core.demo.state()})
            while True:
                msg = await q.get()
                await socket.send_json(msg)
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            core.clients.discard(q)
            with contextlib.suppress(Exception):
                await socket.close()

    return app


app = create_app()
