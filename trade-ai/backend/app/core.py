"""Orquestrador: provedores -> candles -> motor -> sinais -> demo -> WebSocket."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from dataclasses import asdict

from .analysis.engine import Analysis, EngineSettings, analyze
from .config import Settings
from .db import Database
from .demo import DemoAccount
from .market.models import MARKET_LABELS, M5, Candle, Market
from .market.providers.base import Provider, ProviderStatus
from .market.providers.binance import BinanceProvider
from .market.providers.simulated import SimulatedProvider
from .market.providers.twelvedata import TwelveDataProvider
from .market.store import STALE_AFTER, Asset, CandleStore
from .signals import Signal, SignalBook

log = logging.getLogger("trade_ai")

# Mercados sem provedor REST embutido: dependem do webhook do TradingView ou de um provedor futuro.
WEBHOOK_ONLY = {Market.B3, Market.FUTURES}


class Core:
    def __init__(self, cfg: Settings, db: Database | None = None, providers: list[Provider] | None = None) -> None:
        self.cfg = cfg
        self.db = db or Database(cfg.database_url)
        self.store = CandleStore()
        self.engine_settings = EngineSettings.from_dict(self.db.kv_get("engine_settings", {}))
        self.signals = SignalBook(self.db)
        self.demo = DemoAccount(self.db)
        self.analyses: dict[str, Analysis] = {}
        self.running = False
        self.started_at: float | None = None
        self.last_cycle: float | None = None
        self.cycles = 0
        self.clients: set = set()
        self._task: asyncio.Task | None = None
        self._dirty = False
        self.providers = providers if providers is not None else self._build_providers()
        self.tv_status = ProviderStatus(
            name="tradingview", label="TradingView (webhook Pine Script)", markets=list(Market), is_live=True,
            configured=bool(cfg.tradingview_webhook_secret),
            requires=[] if cfg.tradingview_webhook_secret else ["TRADINGVIEW_WEBHOOK_SECRET"],
            state="aguardando" if cfg.tradingview_webhook_secret else "sem_credencial",
            message="Aguardando o primeiro alerta" if cfg.tradingview_webhook_secret
            else "Defina TRADINGVIEW_WEBHOOK_SECRET para receber alertas",
        )
        self.store.on_close.append(self._on_close)
        self.store.on_price.append(self._on_price)
        self.signals.listeners.append(self._on_signal)
        self.demo.listeners.append(self._on_trade)

    def _build_providers(self) -> list[Provider]:
        ps: list[Provider] = []
        if self.cfg.binance_enabled:
            ps.append(BinanceProvider(self.cfg.binance_base_url, self.cfg.binance_max_symbols))
        ps.append(TwelveDataProvider(self.cfg.twelvedata_api_key, self.cfg.twelvedata_symbols,
                                     self.cfg.twelvedata_credits_per_minute))
        if self.cfg.simulated_feed:
            ps.append(SimulatedProvider())
        return ps

    # ------------------------------------------------------------------ ciclo
    async def startup(self) -> None:
        self._restore_webhook_candles()
        self._task = asyncio.create_task(self._loop())

    async def shutdown(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        for p in self.providers:
            await p.close()

    async def start_scanner(self) -> None:
        if self.running:
            return
        self.running = True
        self.started_at = time.time()
        await asyncio.gather(*(p.start(self.store) for p in self.providers if p.status.configured))
        self.analyze_all()
        self.db.log("scanner", "Scanner iniciado")
        await self.broadcast_snapshot()

    async def stop_scanner(self) -> None:
        self.running = False
        for s in self.signals.active():
            self.signals.close(s, "cancelado", "Scanner parado")
        self.db.log("scanner", "Scanner parado")
        await self.broadcast_snapshot()

    async def _loop(self) -> None:
        while True:
            try:
                await self.cycle()
            except Exception:  # noqa: BLE001
                log.exception("erro no ciclo do scanner")
            await asyncio.sleep(self.cfg.scan_interval_s)

    async def cycle(self) -> None:
        # Sem scanner, os provedores só são consultados se houver operação demo aberta
        # (stop e alvo continuam sendo vigiados).
        if self.running or self.demo.open_trades():
            await asyncio.gather(*(p.poll(self.store) for p in self.providers if p.status.configured))
        self.store.roll_forming()
        self.signals.sweep(self.store.assets)
        self._refresh_tv_status()
        self.cycles += 1
        self.last_cycle = time.time()
        await self.broadcast_snapshot()

    # ------------------------------------------------------------- callbacks
    def provider_ok(self, asset: Asset) -> bool:
        if asset.source == "tradingview":
            return not asset.is_stale()
        for p in self.providers:
            if p.status.name == asset.source:
                return p.status.state == "conectado"
        return False

    def analyze_asset(self, asset: Asset, create_signal: bool = True) -> Analysis:
        stale = asset.is_stale() or not self.provider_ok(asset)
        a = analyze(list(asset.candles), self.engine_settings, now=time.time(), stale=stale)
        self.analyses[asset.key] = a
        if create_signal and self.running:
            self.signals.on_analysis(asset, a)
        return a

    def analyze_all(self) -> None:
        for asset in list(self.store.assets.values()):
            self.analyze_asset(asset)

    def _on_close(self, asset: Asset, candle: Candle) -> None:
        if asset.source == "tradingview":
            self.db.save_candles(asset.key, asset.symbol, asset.market.value, asset.source, [candle])
        if self.running:
            self.analyze_asset(asset)
        self._dirty = True

    def _on_price(self, asset: Asset) -> None:
        self.signals.on_price(asset)
        self.demo.on_price(asset)

    def _on_signal(self, sig: Signal, event: str) -> None:
        self._queue({"type": "signal", "event": event, "signal": sig.to_dict()})

    def _on_trade(self, event: str, row) -> None:
        self._queue({"type": "trade", "event": event, "trade": row.to_dict()})

    # ----------------------------------------------------- webhook / restauração
    def _restore_webhook_candles(self) -> None:
        for key, rows in self.db.load_candles("tradingview").items():
            r0 = rows[0]
            asset = self.store.ensure(r0.symbol, Market(r0.market), "tradingview", is_live=True)
            self.store.load_history(asset, [Candle(r.time, r.open, r.high, r.low, r.close, r.volume) for r in rows])
            asset.last_update = None  # fica "sem dados atualizados" até chegar alerta novo

    def _refresh_tv_status(self) -> None:
        tv = [a for a in self.store.assets.values() if a.source == "tradingview"]
        if not self.tv_status.configured:
            return
        self.tv_status.symbols = len(tv)
        fresh = [a for a in tv if not a.is_stale()]
        if fresh:
            self.tv_status.state = "conectado"
            self.tv_status.message = f"{len(fresh)}/{len(tv)} ativos recebendo alertas"
        elif tv:
            self.tv_status.state = "sem_dados"
            self.tv_status.message = "Nenhum alerta recente: verifique os alertas no TradingView"

    def ingest_webhook(self, parsed: dict) -> dict:
        asset = self.store.ensure(parsed["symbol"], parsed["market"], "tradingview", is_live=True)
        if parsed["type"] == "bar":
            c: Candle = parsed["candle"]
            closed = c.time + M5 <= time.time() + 5
            new = self.store.upsert_bar(asset, c, closed=closed)
        else:
            new = self.store.ingest_tick(asset, parsed["price"], parsed["volume"], parsed["time"])
        self.tv_status.last_ok = time.time()
        self._refresh_tv_status()
        return {"asset": asset.key, "new_closed_candle": new, "candles": len(asset.candles)}

    def import_candles(self, symbol: str, market: Market, candles: list[Candle]) -> dict:
        asset = self.store.ensure(symbol.upper(), market, "tradingview", is_live=True)
        self.store.load_history(asset, candles)
        self.db.save_candles(asset.key, asset.symbol, market.value, "tradingview", candles)
        self.analyze_asset(asset, create_signal=False)
        return {"asset": asset.key, "candles": len(asset.candles)}

    # ----------------------------------------------------------- serialização
    def asset_row(self, a: Asset) -> dict:
        an = self.analyses.get(a.key)
        candles = a.candles
        ref = candles[-288].close if len(candles) >= 288 else (candles[0].close if candles else None)
        change = ((a.last_price - ref) / ref * 100) if a.last_price and ref else None
        return {
            "key": a.key, "symbol": a.symbol, "display": a.display or a.symbol, "market": a.market.value,
            "market_label": MARKET_LABELS[a.market], "source": a.source, "is_live": a.is_live,
            "last_price": a.last_price, "change_pct": change, "last_update": a.last_update,
            "data_time": a.data_time, "stale": a.is_stale(), "candles": len(candles), "has_volume": a.has_volume,
            "decision": an.decision if an else None, "direction": an.direction if an else None,
            "score": an.score if an else None, "trend": an.trend if an else None,
            "blocker": an.blockers[0] if an and an.blockers else None,
        }

    def providers_status(self) -> list[dict]:
        return [p.status.to_dict() for p in self.providers] + [self.tv_status.to_dict()]

    def markets_status(self) -> list[dict]:
        out = []
        statuses = self.providers_status()
        for m in Market:
            assets = [a for a in self.store.assets.values() if a.market == m]
            provs = [p for p in statuses if m.value in p["markets"] and p["configured"]
                     and (p["name"] != "tradingview" or any(a.source == "tradingview" for a in assets))]
            live = [p for p in provs if p["is_live"]]
            if not provs:
                coverage = "sem_provedor"
                note = ("Disponível via webhook do TradingView (Pine Script)" if m in WEBHOOK_ONLY
                        else "Configure TWELVEDATA_API_KEY ou o webhook do TradingView")
            elif not live:
                coverage, note = "simulado", "Somente dados SIMULADOS"
            else:
                coverage, note = "ao_vivo", ""
            out.append({
                "market": m.value, "label": MARKET_LABELS[m], "coverage": coverage, "note": note,
                "providers": [p["name"] for p in provs], "assets": len(assets),
                "stale": sum(1 for a in assets if a.is_stale()),
            })
        return out

    def status(self) -> dict:
        assets = list(self.store.assets.values())
        return {
            "running": self.running, "started_at": self.started_at, "last_cycle": self.last_cycle,
            "cycles": self.cycles, "timeframe": "M5", "server_time": time.time(),
            "assets_total": len(assets), "assets_live": sum(1 for a in assets if a.is_live and not a.is_stale()),
            "assets_stale": sum(1 for a in assets if a.is_stale()),
            "simulated_present": any(not a.is_live for a in assets),
            "active_signals": len(self.signals.active()),
            "providers": self.providers_status(), "stale_after_s": STALE_AFTER,
            "engine": asdict(self.engine_settings),
        }

    # -------------------------------------------------------------- websocket
    def _queue(self, msg: dict) -> None:
        for q in list(self.clients):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(msg)

    async def broadcast_snapshot(self) -> None:
        if not self.clients:
            return
        self._queue({"type": "snapshot", "status": self.status(),
                     "signals": [s.to_dict() for s in self.signals.recent(30)],
                     "account": self.demo.state()})
