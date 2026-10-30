"""Entrada de dados do TradingView: webhook de alertas (Pine Script) e importação de CSV exportado."""

from __future__ import annotations

import csv
import hmac
import io
from datetime import datetime, timezone

from .market.models import M5, Candle, Market, parse_market

EXCHANGE_MARKET = {
    "BMFBOVESPA": Market.B3, "BOVESPA": Market.B3, "B3": Market.B3,
    "BINANCE": Market.CRYPTO, "BYBIT": Market.CRYPTO, "COINBASE": Market.CRYPTO, "KRAKEN": Market.CRYPTO,
    "BITSTAMP": Market.CRYPTO, "OKX": Market.CRYPTO,
    "FX": Market.FOREX, "FX_IDC": Market.FOREX, "OANDA": Market.FOREX, "FOREXCOM": Market.FOREX,
    "FXCM": Market.FOREX, "PEPPERSTONE": Market.FOREX, "ICMARKETS": Market.FOREX,
    "NASDAQ": Market.US_STOCKS, "NYSE": Market.US_STOCKS, "AMEX": Market.US_STOCKS, "BATS": Market.US_STOCKS,
    "CME": Market.FUTURES, "CME_MINI": Market.FUTURES, "CBOT": Market.FUTURES, "NYMEX": Market.FUTURES,
    "COMEX": Market.FUTURES, "EUREX": Market.FUTURES,
    "TVC": Market.INDICES, "SP": Market.INDICES, "DJ": Market.INDICES, "CBOE": Market.INDICES,
}


class IngestError(ValueError):
    pass


def check_secret(expected: str, given: str | None) -> None:
    if not expected:
        raise IngestError("Webhook desativado: defina TRADINGVIEW_WEBHOOK_SECRET no servidor")
    if not given or not hmac.compare_digest(expected.encode(), str(given).encode()):
        raise PermissionError("Segredo do webhook inválido")


def infer_market(exchange: str | None, symbol: str, explicit: str | None) -> Market:
    if explicit:
        return parse_market(explicit, Market.CRYPTO)
    ex = (exchange or "").upper()
    if ex in {"BMFBOVESPA", "B3"} and symbol.endswith("!"):
        return Market.FUTURES  # WIN1!, WDO1!
    if ex in EXCHANGE_MARKET:
        return EXCHANGE_MARKET[ex]
    if symbol.endswith("!"):
        return Market.FUTURES
    return Market.CRYPTO


def _ts(value) -> float:
    v = float(value)
    return v / 1000 if v > 1e11 else v  # Pine envia milissegundos


def parse_webhook(payload: dict) -> dict:
    """Valida e normaliza o JSON do alerta. Não inventa campos ausentes."""
    symbol = str(payload.get("symbol") or "").strip().upper()
    if not symbol:
        raise IngestError("Campo 'symbol' ausente")
    kind = payload.get("type", "bar")
    exchange = payload.get("exchange")
    market = infer_market(exchange, symbol, payload.get("market"))
    base = {"symbol": symbol, "exchange": exchange, "market": market}
    try:
        if kind == "bar":
            tf = str(payload.get("timeframe", "")).strip().upper()
            if tf not in {"5", "5M", "M5"}:
                raise IngestError(f"Timeframe '{tf}' recusado: o Trade AI só aceita barras M5")
            c = Candle(int(_ts(payload["time"])), float(payload["open"]), float(payload["high"]),
                       float(payload["low"]), float(payload["close"]), float(payload.get("volume") or 0))
            if not (c.low <= min(c.open, c.close) and c.high >= max(c.open, c.close)):
                raise IngestError("Barra inconsistente (máxima/mínima não contêm abertura/fechamento)")
            return {**base, "type": "bar", "candle": c}
        if kind == "tick":
            return {**base, "type": "tick", "price": float(payload["price"]),
                    "volume": float(payload.get("volume") or 0),
                    "time": _ts(payload["time"]) if payload.get("time") else None}
    except KeyError as e:
        raise IngestError(f"Campo obrigatório ausente: {e.args[0]}") from e
    except (TypeError, ValueError) as e:
        if isinstance(e, IngestError):
            raise
        raise IngestError(f"Valor inválido: {e}") from e
    raise IngestError("Campo 'type' deve ser 'bar' ou 'tick'")


def parse_csv(text: str) -> list[Candle]:
    """CSV exportado do TradingView (time,open,high,low,close,Volume). Exige resolução M5."""
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise IngestError("CSV vazio")
    cols = {k.strip().lower(): k for k in reader.fieldnames}
    for need in ("time", "open", "high", "low", "close"):
        if need not in cols:
            raise IngestError(f"Coluna '{need}' ausente no CSV")
    vol_col = cols.get("volume") or cols.get("vol")
    out: list[Candle] = []
    for row in reader:
        raw_t = row[cols["time"]].strip()
        try:
            t = _ts(raw_t)
        except ValueError:
            dt = datetime.fromisoformat(raw_t.replace("Z", "+00:00"))
            t = (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp()
        try:
            out.append(Candle(int(t), float(row[cols["open"]]), float(row[cols["high"]]), float(row[cols["low"]]),
                              float(row[cols["close"]]), float(row[vol_col] or 0) if vol_col else 0.0))
        except ValueError:
            continue  # linhas com NaN no fim do export
    if len(out) < 2:
        raise IngestError("CSV sem candles suficientes")
    out.sort(key=lambda c: c.time)
    gaps = [b.time - a.time for a, b in zip(out, out[1:])]
    m5 = sum(1 for g in gaps if g == M5)
    if m5 < 0.5 * len(gaps):
        raise IngestError("O CSV não está em M5: exporte o gráfico no tempo gráfico de 5 minutos")
    return out
