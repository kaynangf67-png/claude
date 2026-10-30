"""Feed SINTÉTICO para desenvolvimento e demonstração offline.

Desligado por padrão (ENABLE_SIMULATED_FEED). Todo ativo daqui é marcado is_live=False e
fonte "simulado"; a interface mostra a etiqueta SIMULADO em todos os lugares onde ele aparece.
"""

from __future__ import annotations

import math
import random
import time

from ..models import M5, Candle, Market, bucket
from ..store import CandleStore
from .base import Provider, ProviderStatus

UNIVERSE = [
    ("SIM-EURUSD", Market.FOREX, 1.0850, 0.00035, False),
    ("SIM-BTCUSD", Market.CRYPTO, 68000.0, 0.0018, True),
    ("SIM-PETR4", Market.B3, 37.5, 0.0012, True),
    ("SIM-AAPL", Market.US_STOCKS, 228.0, 0.0010, True),
    ("SIM-US500", Market.INDICES, 5800.0, 0.0006, True),
    ("SIM-WIN", Market.FUTURES, 131000.0, 0.0008, True),
    ("SIM-XAUUSD", Market.COMMODITIES, 2650.0, 0.0007, True),
]


def generate(seed: int, start_price: float, vol: float, bars: int, end_time: int,
             with_volume: bool = True) -> list[Candle]:
    """Passeio aleatório com regimes de tendência, para o motor ter o que analisar."""
    rnd = random.Random(seed)
    price = start_price
    out: list[Candle] = []
    drift = 0.0
    t0 = end_time - bars * M5
    for i in range(bars):
        if i % 60 == 0:
            drift = rnd.choice([-1, 0, 1]) * vol * 0.35
        o = price
        c = o * math.exp(drift + rnd.gauss(0, vol))
        hi = max(o, c) * (1 + abs(rnd.gauss(0, vol * 0.5)))
        lo = min(o, c) * (1 - abs(rnd.gauss(0, vol * 0.5)))
        volume = abs(rnd.gauss(1000, 300)) * (1.8 if abs(c - o) > o * vol * 1.5 else 1) if with_volume else 0.0
        out.append(Candle(t0 + i * M5, o, hi, lo, c, volume))
        price = c
    return out


class SimulatedProvider(Provider):
    def __init__(self) -> None:
        self.status = ProviderStatus(
            name="simulado", label="Feed simulado (NÃO é mercado real)", markets=list(Market),
            is_live=False, configured=True,
        )
        self._rnd = random.Random()
        self._vol: dict[str, float] = {}

    async def start(self, store: CandleStore) -> None:
        end = bucket(time.time())
        for i, (sym, market, p0, vol, has_vol) in enumerate(UNIVERSE):
            a = store.ensure(sym, market, "simulado", is_live=False)
            store.load_history(a, generate(i + 7, p0, vol, 320, end, has_vol))
            a.last_price = a.candles[-1].close
            a.last_update = time.time()
            self._vol[a.key] = vol
        self.status.symbols = len(UNIVERSE)
        self.ok("Gerando cotações sintéticas")

    async def poll(self, store: CandleStore) -> None:
        now = time.time()
        for a in store.assets.values():
            if a.source != "simulado":
                continue
            last = a.forming or a.candles[-1]
            vol = self._vol.get(a.key, 0.001) / 4
            price = last.close * math.exp(self._rnd.gauss(0, vol))
            b = bucket(now)
            if a.forming is None or a.forming.time != b:
                if a.forming is not None:
                    store.upsert_bar(a, a.forming, closed=True, now=now)
                a.forming = Candle(b, price, price, price, price, 0.0)
            f = a.forming
            f.high, f.low, f.close = max(f.high, price), min(f.low, price), price
            f.volume += abs(self._rnd.gauss(80, 25)) if a.has_volume else 0.0
            store.upsert_bar(a, f, closed=False, now=now)
        self.ok("Gerando cotações sintéticas")
