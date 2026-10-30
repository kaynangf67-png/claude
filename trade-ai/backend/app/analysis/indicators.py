"""Indicadores técnicos em Python puro. Todas as séries têm o mesmo tamanho da entrada;
posições sem dado suficiente valem None. Suavização de Wilder para RSI, ATR e ADX."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

Series = list[float | None]


def sma(values: Sequence[float], n: int) -> Series:
    out: Series = [None] * len(values)
    s = 0.0
    for i, v in enumerate(values):
        s += v
        if i >= n:
            s -= values[i - n]
        if i >= n - 1:
            out[i] = s / n
    return out


def ema(values: Sequence[float | None], n: int) -> Series:
    """EMA semeada com a SMA dos n primeiros valores válidos."""
    out: Series = [None] * len(values)
    k = 2 / (n + 1)
    seed: list[float] = []
    prev: float | None = None
    for i, v in enumerate(values):
        if v is None:
            continue
        if prev is None:
            seed.append(v)
            if len(seed) == n:
                prev = sum(seed) / n
                out[i] = prev
            continue
        prev = v * k + prev * (1 - k)
        out[i] = prev
    return out


def _wilder(values: Sequence[float], n: int, start: int = 0) -> Series:
    out: Series = [None] * len(values)
    if len(values) - start < n:
        return out
    prev = sum(values[start:start + n]) / n
    out[start + n - 1] = prev
    for i in range(start + n, len(values)):
        prev = (prev * (n - 1) + values[i]) / n
        out[i] = prev
    return out


def rsi(closes: Sequence[float], n: int = 14) -> Series:
    out: Series = [None] * len(closes)
    if len(closes) <= n:
        return out
    gains = [0.0] + [max(closes[i] - closes[i - 1], 0.0) for i in range(1, len(closes))]
    losses = [0.0] + [max(closes[i - 1] - closes[i], 0.0) for i in range(1, len(closes))]
    ag = _wilder(gains, n, start=1)
    al = _wilder(losses, n, start=1)
    for i in range(len(closes)):
        g, l_ = ag[i], al[i]
        if g is None or l_ is None:
            continue
        out[i] = 100.0 if l_ == 0 else 100 - 100 / (1 + g / l_)
    return out


def macd(closes: Sequence[float], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[Series, Series, Series]:
    ef, es = ema(closes, fast), ema(closes, slow)
    line: Series = [f - s if f is not None and s is not None else None for f, s in zip(ef, es)]
    sig = ema(line, signal)
    hist: Series = [m - s if m is not None and s is not None else None for m, s in zip(line, sig)]
    return line, sig, hist


def true_range(highs: Sequence[float], lows: Sequence[float], closes: Sequence[float]) -> list[float]:
    tr = [highs[0] - lows[0]] if highs else []
    for i in range(1, len(highs)):
        tr.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    return tr


def atr(highs: Sequence[float], lows: Sequence[float], closes: Sequence[float], n: int = 14) -> Series:
    return _wilder(true_range(highs, lows, closes), n, start=1) if len(highs) > n else [None] * len(highs)


def adx(highs: Sequence[float], lows: Sequence[float], closes: Sequence[float], n: int = 14) -> tuple[Series, Series, Series]:
    """Retorna (ADX, +DI, -DI)."""
    size = len(highs)
    none: Series = [None] * size
    if size < 2 * n + 1:
        return none, list(none), list(none)
    plus_dm = [0.0]
    minus_dm = [0.0]
    for i in range(1, size):
        up = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        plus_dm.append(up if up > down and up > 0 else 0.0)
        minus_dm.append(down if down > up and down > 0 else 0.0)
    tr = true_range(highs, lows, closes)
    s_tr, s_p, s_m = _wilder(tr, n, 1), _wilder(plus_dm, n, 1), _wilder(minus_dm, n, 1)
    pdi: Series = [None] * size
    mdi: Series = [None] * size
    dx: list[float] = [0.0] * size
    first = None
    for i in range(size):
        t, p, m = s_tr[i], s_p[i], s_m[i]
        if t is None or p is None or m is None or t == 0:
            continue
        pdi[i] = 100 * p / t
        mdi[i] = 100 * m / t
        tot = pdi[i] + mdi[i]
        dx[i] = 0.0 if tot == 0 else 100 * abs(pdi[i] - mdi[i]) / tot
        if first is None:
            first = i
    adx_s: Series = _wilder(dx, n, start=first) if first is not None else list(none)
    return adx_s, pdi, mdi


def vwap(times: Sequence[int], highs: Sequence[float], lows: Sequence[float], closes: Sequence[float],
         volumes: Sequence[float]) -> Series:
    """VWAP de sessão, reiniciada a cada dia UTC. None quando o provedor não envia volume."""
    out: Series = [None] * len(closes)
    day = None
    pv = vol = 0.0
    for i in range(len(closes)):
        d = datetime.fromtimestamp(times[i], tz=timezone.utc).date()
        if d != day:
            day, pv, vol = d, 0.0, 0.0
        typical = (highs[i] + lows[i] + closes[i]) / 3
        pv += typical * volumes[i]
        vol += volumes[i]
        out[i] = pv / vol if vol > 0 else None
    return out
