"""Forex, ações americanas, índices e commodities via Twelve Data (requer TWELVEDATA_API_KEY).

O plano gratuito dá poucos créditos por minuto/dia: com ele não dá para varrer dezenas de
ativos em M5. O agendador respeita TWELVEDATA_CREDITS_PER_MINUTE e atualiza cada ativo
uma vez por candle, priorizando os que estão há mais tempo sem atualização.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import httpx

from ..models import M5, Candle, Market, bucket, parse_market
from ..store import CandleStore
from .base import Provider, ProviderStatus

BASE = "https://api.twelvedata.com"


def parse_symbols(spec: str) -> list[tuple[Market, str]]:
    out = []
    for item in spec.split(","):
        item = item.strip()
        if not item:
            continue
        market, _, sym = item.partition(":") if ":" in item else ("forex", "", item)
        out.append((parse_market(market, Market.FOREX), sym.strip()))
    return out


def parse_series(payload: dict, now: float) -> list[tuple[Candle, bool]]:
    if payload.get("status") == "error":
        raise RuntimeError(payload.get("message", "erro Twelve Data"))
    out = []
    for v in reversed(payload.get("values", [])):  # API devolve do mais novo para o mais antigo
        t = int(datetime.strptime(v["datetime"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).timestamp())
        c = Candle(t, float(v["open"]), float(v["high"]), float(v["low"]), float(v["close"]),
                   float(v.get("volume") or 0))
        out.append((c, t + M5 <= now))
    return out


class TwelveDataProvider(Provider):
    def __init__(self, api_key: str, spec: str, credits_per_minute: int,
                 client: httpx.AsyncClient | None = None) -> None:
        self.key = api_key
        self.items = parse_symbols(spec)
        self.cpm = max(1, credits_per_minute)
        self.client = client or httpx.AsyncClient(timeout=15)
        markets = sorted({m for m, _ in self.items}, key=lambda m: m.value) or [Market.FOREX]
        self.status = ProviderStatus(
            name="twelvedata", label="Twelve Data", markets=markets, is_live=True, configured=bool(api_key),
            symbols=len(self.items), requires=[] if api_key else ["TWELVEDATA_API_KEY"],
        )
        if not api_key:
            self.status.state = "sem_credencial"
            self.status.message = "Defina TWELVEDATA_API_KEY para ativar forex, ações EUA, índices e commodities"
        self._done_bucket: dict[str, int] = {}
        self._loaded: set[str] = set()
        self._calls: list[float] = []

    def _budget(self) -> int:
        now = time.time()
        self._calls = [t for t in self._calls if now - t < 60]
        return self.cpm - len(self._calls)

    async def _fetch(self, store: CandleStore, market: Market, sym: str) -> None:
        initial = sym not in self._loaded
        self._calls.append(time.time())
        r = await self.client.get(f"{BASE}/time_series", params={
            "symbol": sym, "interval": "5min", "outputsize": 400 if initial else 3,
            "timezone": "UTC", "apikey": self.key})
        r.raise_for_status()
        parsed = parse_series(r.json(), time.time())
        asset = store.ensure(sym, market, "twelvedata", is_live=True)
        if initial:
            store.load_history(asset, [c for c, closed in parsed if closed])
            asset.last_update = time.time()
            self._loaded.add(sym)
        for c, closed in parsed:
            store.upsert_bar(asset, c, closed=closed)

    async def start(self, store: CandleStore) -> None:
        if self.key:
            await self.poll(store)

    async def poll(self, store: CandleStore) -> None:
        if not self.key:
            return
        current = bucket(time.time())
        due = [(m, s) for m, s in self.items if self._done_bucket.get(s, 0) < current]
        due.sort(key=lambda it: self._done_bucket.get(it[1], 0))
        errors = 0
        for market, sym in due:
            if self._budget() <= 0:
                break
            try:
                await self._fetch(store, market, sym)
                self._done_bucket[sym] = current
            except Exception as e:  # noqa: BLE001
                errors += 1
                self.status.last_error = f"{sym}: {e}"
        pending = sum(1 for _, s in self.items if self._done_bucket.get(s, 0) < current)
        if errors and errors == len(due):
            self.fail(self.status.last_error or "erro")
        else:
            msg = f"{len(self.items) - pending}/{len(self.items)} ativos no candle atual"
            if pending:
                msg += f" ({pending} aguardando cota de créditos)"
            self.ok(msg)

    async def close(self) -> None:
        await self.client.aclose()
