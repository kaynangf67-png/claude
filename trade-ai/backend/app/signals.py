"""Ciclo de vida dos sinais: ativo -> executado | cancelado | expirado.

Um sinal nasce só no fechamento de um candle M5 e só vale enquanto o preço estiver
na região de entrada. Se o preço passar da região, bater no stop antes da entrada,
o sinal vencer ou os dados ficarem velhos, ele é cancelado. Não existe entrada atrasada.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from .analysis.engine import Analysis
from .db import Database, SignalRow
from .market.models import M5, MARKET_LABELS
from .market.store import Asset


@dataclass
class Signal:
    id: str
    asset_key: str
    symbol: str
    market: str
    market_label: str
    source: str
    is_live: bool
    timeframe: str
    decision: str
    direction: str
    score: int
    entry: float
    zone_low: float
    zone_high: float
    stop: float
    tp1: float
    tp2: float
    rr1: float
    rr2: float
    bar_time: int
    created_at: float
    valid_until: int
    reasons: list[str]
    confirmation: str
    status: str = "ativo"
    status_reason: str = ""
    closed_at: float | None = None
    trend: str = ""
    factors: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class SignalBook:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.signals: dict[str, Signal] = {}
        self.listeners: list = []  # callables(signal, event)

    def active(self) -> list[Signal]:
        return [s for s in self.signals.values() if s.status == "ativo"]

    def recent(self, limit: int = 50) -> list[Signal]:
        return sorted(self.signals.values(), key=lambda s: s.created_at, reverse=True)[:limit]

    def _emit(self, sig: Signal, event: str) -> None:
        self._persist(sig)
        for cb in self.listeners:
            cb(sig, event)

    def _persist(self, sig: Signal) -> None:
        with self.db.session() as s:
            row = s.get(SignalRow, sig.id)
            if row:
                row.status, row.payload = sig.status, sig.to_dict()
            else:
                s.add(SignalRow(id=sig.id, asset_key=sig.asset_key, created_at=sig.created_at, status=sig.status,
                                payload=sig.to_dict()))
            s.commit()

    def on_analysis(self, asset: Asset, a: Analysis, now: float | None = None) -> Signal | None:
        now = now or time.time()
        if a.decision == "AGUARDAR" or a.plan is None or a.bar_time is None:
            return None
        for other in self.active():
            if other.asset_key == asset.key and other.direction != a.direction:
                self.close(other, "cancelado", "Sinal contrário confirmado")
        sid = f"{asset.key}@{a.bar_time}"
        if sid in self.signals:
            return None
        p = a.plan
        hhmm = datetime.fromtimestamp(a.bar_time + M5, tz=timezone.utc).strftime("%H:%M")
        sig = Signal(
            id=sid, asset_key=asset.key, symbol=asset.symbol, market=asset.market.value,
            market_label=MARKET_LABELS[asset.market], source=asset.source, is_live=asset.is_live, timeframe="M5",
            decision=a.decision, direction=a.direction or "", score=a.score, entry=p.entry, zone_low=p.zone_low,
            zone_high=p.zone_high, stop=p.stop, tp1=p.tp1, tp2=p.tp2, rr1=p.rr1, rr2=p.rr2, bar_time=a.bar_time,
            created_at=now, valid_until=p.valid_until, reasons=a.reasons,
            confirmation=f"Confirmado no fechamento do candle M5 das {hhmm} UTC", trend=a.trend,
            factors=[{"label": f.label, "ok": f.ok, "available": f.available, "weight": f.weight,
                      "detail": f.detail} for f in a.factors],
        )
        self.signals[sid] = sig
        self._emit(sig, "novo")
        return sig

    def close(self, sig: Signal, status: str, reason: str) -> None:
        if sig.status != "ativo":
            return
        sig.status, sig.status_reason, sig.closed_at = status, reason, time.time()
        self._emit(sig, status)

    def on_price(self, asset: Asset, now: float | None = None) -> None:
        now = now or time.time()
        price = asset.last_price
        for sig in self.active():
            if sig.asset_key != asset.key:
                continue
            if asset.is_stale(now):
                self.close(sig, "cancelado", "Dados desatualizados: sinal invalidado")
            elif now > sig.valid_until:
                self.close(sig, "expirado", "Validade do sinal terminou sem execução")
            elif price is None:
                continue
            elif sig.direction == "long" and price > sig.zone_high:
                self.close(sig, "cancelado", "Preço ultrapassou a região de entrada")
            elif sig.direction == "short" and price < sig.zone_low:
                self.close(sig, "cancelado", "Preço ultrapassou a região de entrada")
            elif (sig.direction == "long" and price <= sig.stop) or (sig.direction == "short" and price >= sig.stop):
                self.close(sig, "cancelado", "Preço atingiu o stop antes da entrada")

    def sweep(self, assets: dict[str, Asset], now: float | None = None) -> None:
        """Expira/cancela sinais mesmo quando o ativo parou de mandar preço."""
        now = now or time.time()
        for sig in self.active():
            asset = assets.get(sig.asset_key)
            if asset is None or asset.is_stale(now):
                self.close(sig, "cancelado", "Dados desatualizados: sinal invalidado")
            elif now > sig.valid_until:
                self.close(sig, "expirado", "Validade do sinal terminou sem execução")
