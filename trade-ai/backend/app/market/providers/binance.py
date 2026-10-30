"""Criptomoedas via API pública da Binance (sem chave).

Universo: pares USDT com maior volume em 24h (BINANCE_MAX_SYMBOLS). Candles M5 oficiais
da exchange (klines 5m). Obs.: api.binance.com recusa acessos de alguns países (HTTP 451);
nesse caso use BINANCE_BASE_URL=https://data-api.binance.vision.
"""

from __future__ import annotations

import asyncio
import time

import httpx

from ..models import Candle, Market
from ..store import CandleStore
from .base import Provider, ProviderStatus

EXCLUDE_SUFFIXES = ("UPUSDT", "DOWNUSDT", "BULLUSDT", "BEARUSDT")
STABLES = {"USDCUSDT", "FDUSDUSDT", "TUSDUSDT", "BUSDUSDT", "USDPUSDT", "DAIUSDT", "EURUSDT", "AEURUSDT",
           "USD1USDT", "XUSDUSDT", "RLUSDUSDT"}
UNIVERSE_REFRESH_S = 3600


def parse_klines(rows: list, now_ms: int) -> list[tuple[Candle, bool]]:
    out = []
    for r in rows:
        c = Candle(int(r[0]) // 1000, float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[5]))
        out.append((c, int(r[6]) < now_ms))
    return out


class BinanceProvider(Provider):
    def __init__(self, base_url: str, max_symbols: int, client: httpx.AsyncClient | None = None) -> None:
        self.base = base_url.rstrip("/")
        self.max_symbols = max_symbols
        self.client = client or httpx.AsyncClient(timeout=10)
        self.status = ProviderStatus(name="binance", label="Binance (dados públicos)", markets=[Market.CRYPTO],
                                     is_live=True, configured=True)
        self.symbols: list[str] = []
        self._universe_at = 0.0
        self._sem = asyncio.Semaphore(8)

    async def _get(self, path: str, params: dict | None = None):
        r = await self.client.get(self.base + path, params=params)
        if r.status_code == 451:
            raise RuntimeError("Binance bloqueou a região (HTTP 451). Use BINANCE_BASE_URL=https://data-api.binance.vision")
        r.raise_for_status()
        return r.json()

    async def _universe(self) -> None:
        data = await self._get("/api/v3/ticker/24hr")
        pairs = [d for d in data if d["symbol"].endswith("USDT") and not d["symbol"].endswith(EXCLUDE_SUFFIXES)
                 and d["symbol"] not in STABLES and float(d.get("quoteVolume", 0)) > 0]
        pairs.sort(key=lambda d: float(d["quoteVolume"]), reverse=True)
        self.symbols = [d["symbol"] for d in pairs[: self.max_symbols]]
        self._universe_at = time.time()
        self.status.symbols = len(self.symbols)

    async def _fetch(self, store: CandleStore, symbol: str, limit: int, initial: bool) -> None:
        async with self._sem:
            rows = await self._get("/api/v3/klines", {"symbol": symbol, "interval": "5m", "limit": limit})
        asset = store.ensure(symbol, Market.CRYPTO, "binance", is_live=True,
                             display=symbol.replace("USDT", "/USDT"))
        parsed = parse_klines(rows, int(time.time() * 1000))
        if initial:
            store.load_history(asset, [c for c, closed in parsed if closed])
            asset.last_update = time.time()
            for c, closed in parsed:
                if not closed:
                    store.upsert_bar(asset, c, closed=False)
            if parsed:
                asset.last_price = parsed[-1][0].close
            return
        for c, closed in parsed:
            store.upsert_bar(asset, c, closed=closed)

    async def start(self, store: CandleStore) -> None:
        self.status.state = "conectando"
        try:
            await self._universe()
            await asyncio.gather(*(self._fetch(store, s, 400, True) for s in self.symbols))
            self.ok(f"{len(self.symbols)} pares monitorados")
        except Exception as e:  # noqa: BLE001
            self.fail(f"Falha ao conectar: {e}")

    async def poll(self, store: CandleStore) -> None:
        try:
            if not self.symbols or time.time() - self._universe_at > UNIVERSE_REFRESH_S:
                known = set(self.symbols)
                await self._universe()
                new = [s for s in self.symbols if s not in known]
                await asyncio.gather(*(self._fetch(store, s, 400, True) for s in new))
            results = await asyncio.gather(*(self._fetch(store, s, 3, False) for s in self.symbols),
                                           return_exceptions=True)
            errors = [r for r in results if isinstance(r, Exception)]
            if errors and len(errors) == len(results):
                self.fail(f"Sem resposta da Binance: {errors[0]}")
            else:
                self.ok(f"{len(self.symbols) - len(errors)}/{len(self.symbols)} pares atualizados")
        except Exception as e:  # noqa: BLE001
            self.fail(f"Falha na atualização: {e}")

    async def close(self) -> None:
        await self.client.aclose()
