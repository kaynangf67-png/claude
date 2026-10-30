"""Armazena candles M5 por ativo e constrói candles a partir de ticks.

Regras:
- Só candles FECHADOS entram na análise. O candle em formação fica separado.
- Cada ativo carrega a fonte e se é ao vivo ou simulado; isso nunca é perdido.
- Um ativo é "sem dados atualizados" quando a última atualização passou de STALE_AFTER.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable

from .models import M5, Candle, Market, bucket

MAX_CANDLES = 600
STALE_AFTER = 2 * M5 + 60  # dois candles sem dado + folga


@dataclass
class Asset:
    symbol: str
    market: Market
    source: str
    is_live: bool  # False = dados simulados/importados, nunca exibidos como ao vivo
    display: str = ""
    candles: deque[Candle] = field(default_factory=lambda: deque(maxlen=MAX_CANDLES))
    forming: Candle | None = None
    last_price: float | None = None
    last_update: float | None = None  # relógio do servidor quando o dado chegou
    has_volume: bool = True

    @property
    def key(self) -> str:
        return f"{self.source}:{self.symbol}"

    @property
    def data_time(self) -> int | None:
        """Fim do período coberto pelo dado mais recente (não a hora em que chegou)."""
        if self.forming is not None:
            return self.forming.close_time
        return self.candles[-1].close_time if self.candles else None

    def is_stale(self, now: float | None = None) -> bool:
        """Sem atualização recente OU o provedor só devolve dado antigo (mercado fechado, feed travado)."""
        now = now or time.time()
        if self.last_update is None or now - self.last_update > STALE_AFTER:
            return True
        dt = self.data_time
        return dt is None or now - dt > STALE_AFTER

    @property
    def last_closed_time(self) -> int | None:
        return self.candles[-1].time if self.candles else None


class CandleStore:
    def __init__(self) -> None:
        self.assets: dict[str, Asset] = {}
        # chamado com (asset, candle_fechado) sempre que um candle novo fecha
        self.on_close: list[Callable[[Asset, Candle], None]] = []
        # chamado com (asset) a cada atualização de preço
        self.on_price: list[Callable[[Asset], None]] = []

    def ensure(self, symbol: str, market: Market, source: str, is_live: bool, display: str = "") -> Asset:
        asset = Asset(symbol=symbol, market=market, source=source, is_live=is_live, display=display or symbol)
        return self.assets.setdefault(asset.key, asset)

    def get(self, key: str) -> Asset | None:
        return self.assets.get(key)

    # --- candles prontos (REST de provedor, webhook de barra, importação CSV) ---
    def upsert_bar(self, asset: Asset, bar: Candle, closed: bool, now: float | None = None) -> bool:
        """Insere/atualiza um candle. Retorna True se um novo candle FECHADO entrou."""
        now = now or time.time()
        bar.time = bucket(bar.time)
        asset.last_update = now
        asset.last_price = bar.close
        if bar.volume:
            asset.has_volume = True
        new_close = False
        if closed:
            if asset.candles and asset.candles[-1].time == bar.time:
                asset.candles[-1] = bar
            elif not asset.candles or bar.time > asset.candles[-1].time:
                asset.candles.append(bar)
                new_close = True
            else:
                self._insert_old(asset, bar)
            if asset.forming and asset.forming.time <= bar.time:
                asset.forming = None
        else:
            if not asset.candles or bar.time > asset.candles[-1].time:
                asset.forming = bar
        if new_close:
            for cb in self.on_close:
                cb(asset, bar)
        for cb in self.on_price:
            cb(asset)
        return new_close

    def load_history(self, asset: Asset, bars: list[Candle]) -> None:
        """Carga inicial em lote, sem disparar callbacks de fechamento."""
        merged = {c.time: c for c in asset.candles}
        for b in bars:
            b.time = bucket(b.time)
            merged[b.time] = b
        asset.candles.clear()
        asset.candles.extend(sorted(merged.values(), key=lambda c: c.time)[-MAX_CANDLES:])
        if bars:
            asset.has_volume = any(c.volume for c in asset.candles)

    @staticmethod
    def _insert_old(asset: Asset, bar: Candle) -> None:
        items = [c for c in asset.candles if c.time != bar.time] + [bar]
        items.sort(key=lambda c: c.time)
        asset.candles.clear()
        asset.candles.extend(items[-MAX_CANDLES:])

    # --- ticks (webhook de preço, streams) -> candles M5 ---
    def ingest_tick(self, asset: Asset, price: float, volume: float = 0.0, ts: float | None = None) -> bool:
        ts = ts or time.time()
        b = bucket(ts)
        closed_new = False
        f = asset.forming
        if f is not None and b > f.time:
            closed_new = self.upsert_bar(asset, f, closed=True, now=time.time())
            f = None
        if f is None or f.time != b:
            asset.forming = Candle(time=b, open=price, high=price, low=price, close=price, volume=volume)
        else:
            f.high = max(f.high, price)
            f.low = min(f.low, price)
            f.close = price
            f.volume += volume
        asset.last_price = price
        asset.last_update = time.time()
        for cb in self.on_price:
            cb(asset)
        return closed_new

    def roll_forming(self, now: float | None = None) -> None:
        """Fecha candles em formação cujo período já terminou (feeds por tick)."""
        now = now or time.time()
        for asset in self.assets.values():
            f = asset.forming
            if f is not None and f.close_time <= now and asset.source in {"tradingview"}:
                self.upsert_bar(asset, f, closed=True, now=asset.last_update or now)
