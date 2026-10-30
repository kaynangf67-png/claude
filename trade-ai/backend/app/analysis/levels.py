"""Suportes, resistências, rompimentos e falsos rompimentos a partir de pivôs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass
class Level:
    price: float
    kind: str  # "suporte" | "resistencia"
    touches: int

    def to_dict(self) -> dict:
        return {"price": self.price, "kind": self.kind, "touches": self.touches}


def pivots(highs: Sequence[float], lows: Sequence[float], k: int = 3, lookback: int = 150) -> tuple[list[float], list[float]]:
    """Topos e fundos de swing confirmados (k candles de cada lado)."""
    n = len(highs)
    start = max(k, n - lookback)
    tops, bottoms = [], []
    for i in range(start, n - k):
        h, l_ = highs[i], lows[i]
        if all(h >= highs[j] for j in range(i - k, i + k + 1)):
            tops.append(h)
        if all(l_ <= lows[j] for j in range(i - k, i + k + 1)):
            bottoms.append(l_)
    return tops, bottoms


def cluster(prices: list[float], tolerance: float) -> list[tuple[float, int]]:
    """Agrupa preços próximos em níveis (média, toques)."""
    groups: list[list[float]] = []
    for p in sorted(prices):
        if groups and p - groups[-1][-1] <= tolerance:
            groups[-1].append(p)
        else:
            groups.append([p])
    return [(sum(g) / len(g), len(g)) for g in groups]


def find_levels(highs: Sequence[float], lows: Sequence[float], price: float, atr_value: float,
                max_each: int = 3) -> tuple[list[Level], list[Level]]:
    tops, bottoms = pivots(highs, lows)
    tol = max(atr_value * 0.35, price * 1e-5)
    raw = cluster(tops + bottoms, tol)
    supports = sorted(
        (Level(p, "suporte", t) for p, t in raw if p < price), key=lambda lv: price - lv.price
    )[:max_each]
    resistances = sorted(
        (Level(p, "resistencia", t) for p, t in raw if p > price), key=lambda lv: lv.price - price
    )[:max_each]
    return supports, resistances


def breakout(highs: Sequence[float], lows: Sequence[float], closes: Sequence[float], atr_value: float,
             lookback: int = 24) -> dict:
    """Avalia o último candle fechado contra a máxima/mínima das `lookback` barras anteriores.

    - rompimento de alta: fechou acima da máxima anterior com folga de 0,1 ATR
    - falso rompimento de alta: furou a máxima mas fechou de volta abaixo dela
    (e o espelho para baixo)
    """
    if len(closes) < lookback + 2:
        return {"bull_breakout": False, "bear_breakout": False, "bull_fake": False, "bear_fake": False,
                "range_high": None, "range_low": None}
    rh = max(highs[-lookback - 1:-1])
    rl = min(lows[-lookback - 1:-1])
    h, l_, c = highs[-1], lows[-1], closes[-1]
    margin = 0.1 * atr_value
    return {
        "bull_breakout": c > rh + margin,
        "bear_breakout": c < rl - margin,
        "bull_fake": h > rh and c < rh,   # armadilha para compradores -> viés de venda
        "bear_fake": l_ < rl and c > rl,  # armadilha para vendedores -> viés de compra
        "range_high": rh,
        "range_low": rl,
    }
