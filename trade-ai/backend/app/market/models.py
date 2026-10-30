from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

M5 = 300  # segundos


class Market(str, Enum):
    FOREX = "forex"
    CRYPTO = "crypto"
    B3 = "b3"
    US_STOCKS = "us_stocks"
    INDICES = "indices"
    FUTURES = "futures"
    COMMODITIES = "commodities"


MARKET_LABELS = {
    Market.FOREX: "Forex",
    Market.CRYPTO: "Criptomoedas",
    Market.B3: "Ações brasileiras",
    Market.US_STOCKS: "Ações americanas",
    Market.INDICES: "Índices",
    Market.FUTURES: "Futuros",
    Market.COMMODITIES: "Commodities",
}


def parse_market(value: str | None, default: Market = Market.CRYPTO) -> Market:
    if not value:
        return default
    v = value.strip().lower()
    aliases = {
        "fx": Market.FOREX, "forex": Market.FOREX,
        "crypto": Market.CRYPTO, "cripto": Market.CRYPTO,
        "b3": Market.B3, "bovespa": Market.B3, "bmfbovespa": Market.B3,
        "us_stocks": Market.US_STOCKS, "stocks": Market.US_STOCKS, "nasdaq": Market.US_STOCKS, "nyse": Market.US_STOCKS,
        "indices": Market.INDICES, "index": Market.INDICES,
        "futures": Market.FUTURES, "futuros": Market.FUTURES,
        "commodities": Market.COMMODITIES, "commodity": Market.COMMODITIES,
    }
    return aliases.get(v, default)


@dataclass
class Candle:
    time: int  # abertura do candle, epoch em segundos (UTC), múltiplo de 300
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    @property
    def close_time(self) -> int:
        return self.time + M5

    def to_dict(self) -> dict:
        return {
            "time": self.time, "open": self.open, "high": self.high,
            "low": self.low, "close": self.close, "volume": self.volume,
        }


def bucket(ts: float) -> int:
    """Início do candle M5 que contém o instante ts."""
    return int(ts) // M5 * M5
