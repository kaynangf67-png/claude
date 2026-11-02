"""
Feed de dados M1 via Yahoo Finance (grátis, sem API key).
Suporta forex, cripto e índices.
"""

import time
import requests
import pandas as pd
from datetime import datetime, timezone


YAHOO_MAP = {
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "XAUUSD": "GC=F",
    "GBPJPY": "GBPJPY=X",
    "AUDCAD": "AUDCAD=X",
}


def fetch_m1(asset: str, bars: int = 100) -> pd.DataFrame:
    ticker = YAHOO_MAP.get(asset.upper(), asset)
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?interval=1m&range=2d&includePrePost=false"
    )
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    result = data["chart"]["result"][0]
    ts     = result["timestamp"]
    ohlcv  = result["indicators"]["quote"][0]

    df = pd.DataFrame({
        "time":   pd.to_datetime(ts, unit="s", utc=True),
        "open":   ohlcv["open"],
        "high":   ohlcv["high"],
        "low":    ohlcv["low"],
        "close":  ohlcv["close"],
        "volume": ohlcv["volume"],
    }).dropna().tail(bars).reset_index(drop=True)

    return df


def seconds_to_next_candle() -> float:
    now = datetime.now(timezone.utc)
    return 60 - now.second - now.microsecond / 1_000_000
