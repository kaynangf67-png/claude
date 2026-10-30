"""Motor de confluência M5.

A pontuação mede QUANTOS critérios técnicos concordam (0-100), ponderada pelos pesos abaixo.
Ela NÃO é probabilidade de lucro. A taxa de acerto real só sai do histórico de operações.

Decisão: COMPRA, VENDA ou AGUARDAR. Um sinal só é liberado quando:
  1) a pontuação do lado vencedor >= min_score, e
  2) nenhum bloqueio obrigatório está ativo (lateralidade, volatilidade fora da faixa,
     falso rompimento contra, tendência principal contra, obstáculo antes do alvo, dado velho...).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Sequence

from ..market.models import M5, Candle
from . import indicators as ind
from .levels import breakout, find_levels

MIN_BARS = 210  # EMA 200 + margem


@dataclass
class EngineSettings:
    min_score: int = 70
    min_adx: float = 20.0
    rsi_long_min: float = 50.0
    rsi_long_max: float = 70.0
    rsi_short_min: float = 30.0
    rsi_short_max: float = 50.0
    rsi_extreme: float = 75.0  # acima (ou abaixo de 100-x) bloqueia entrada a favor
    atr_pct_min: float = 0.03  # % do preço
    atr_pct_max: float = 2.5
    volume_factor: float = 1.2
    stop_atr_mult: float = 1.0
    max_stop_atr: float = 2.5
    tp1_rr: float = 1.5
    tp2_rr: float = 2.5
    entry_zone_atr: float = 0.25
    validity_bars: int = 2
    max_signal_delay_s: int = 120
    require_trend: bool = True

    @classmethod
    def from_dict(cls, data: dict) -> "EngineSettings":
        known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
        return cls(**known)


WEIGHTS = {
    "trend": 20, "ema50": 10, "rsi": 10, "macd": 10, "vwap": 10,
    "adx": 15, "volume": 10, "price_action": 5, "structure": 10,
}


@dataclass
class Factor:
    key: str
    label: str
    ok: bool
    weight: int
    available: bool = True
    detail: str = ""


@dataclass
class Plan:
    entry: float
    zone_low: float
    zone_high: float
    stop: float
    tp1: float
    tp2: float
    rr1: float
    rr2: float
    valid_until: int


@dataclass
class Analysis:
    decision: str  # COMPRA | VENDA | AGUARDAR
    direction: str | None  # long | short | None
    score: int
    score_long: int
    score_short: int
    trend: str
    bar_time: int | None
    price: float | None
    factors: list[Factor] = field(default_factory=list)
    blockers: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    indicators: dict = field(default_factory=dict)
    levels: dict = field(default_factory=dict)
    plan: Plan | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _last(series: Sequence[float | None], offset: int = 1) -> float | None:
    return series[-offset] if len(series) >= offset else None


def _side_factors(side: str, c: dict, s: EngineSettings) -> list[Factor]:
    long = side == "long"
    close, e50, e200 = c["close"], c["ema50"], c["ema200"]
    f: list[Factor] = []

    trend_ok = (close > e200 and e50 > e200) if long else (close < e200 and e50 < e200)
    f.append(Factor("trend", "Tendência principal (EMA 50 x EMA 200)", trend_ok, WEIGHTS["trend"],
                    detail=f"EMA50 {e50:.5g} / EMA200 {e200:.5g}"))
    f.append(Factor("ema50", "Preço do lado certo da EMA 50", close > e50 if long else close < e50, WEIGHTS["ema50"]))

    r = c["rsi"]
    rsi_ok = s.rsi_long_min <= r <= s.rsi_long_max if long else s.rsi_short_min <= r <= s.rsi_short_max
    f.append(Factor("rsi", "RSI em zona de momentum sem exaustão", rsi_ok, WEIGHTS["rsi"], detail=f"RSI {r:.1f}"))

    h, hp = c["macd_hist"], c["macd_hist_prev"]
    macd_ok = (h > 0 and h > hp) if long else (h < 0 and h < hp)
    f.append(Factor("macd", "MACD a favor e acelerando", macd_ok, WEIGHTS["macd"], detail=f"hist {h:.3g}"))

    vw = c["vwap"]
    f.append(Factor("vwap", "Preço do lado certo da VWAP",
                    vw is not None and (close > vw if long else close < vw), WEIGHTS["vwap"],
                    available=vw is not None, detail="" if vw is not None else "provedor sem volume"))

    a, pdi, mdi = c["adx"], c["plus_di"], c["minus_di"]
    adx_ok = a >= s.min_adx and (pdi > mdi if long else mdi > pdi)
    f.append(Factor("adx", "ADX com força direcional", adx_ok, WEIGHTS["adx"],
                    detail=f"ADX {a:.1f} (+DI {pdi:.1f} / -DI {mdi:.1f})"))

    vr = c["vol_ratio"]
    f.append(Factor("volume", "Volume acima da média de 20", vr is not None and vr >= s.volume_factor,
                    WEIGHTS["volume"], available=vr is not None,
                    detail=f"{vr:.2f}x a média" if vr is not None else "provedor sem volume"))

    o, hi, lo = c["open"], c["high"], c["low"]
    rng = hi - lo
    body = abs(close - o)
    if rng > 0:
        pa_ok = body >= 0.5 * rng and ((close > o and (hi - close) <= 0.3 * rng) if long
                                       else (close < o and (close - lo) <= 0.3 * rng))
    else:
        pa_ok = False
    f.append(Factor("price_action", "Candle de força no fechamento", pa_ok, WEIGHTS["price_action"]))

    br = c["breakout"]
    struct_ok = (br["bull_breakout"] or br["bear_fake"]) if long else (br["bear_breakout"] or br["bull_fake"])
    why = ""
    if long and br["bull_breakout"]:
        why = "rompimento da máxima recente"
    elif long and br["bear_fake"]:
        why = "falso rompimento de baixa (armadilha de vendedores)"
    elif not long and br["bear_breakout"]:
        why = "rompimento da mínima recente"
    elif not long and br["bull_fake"]:
        why = "falso rompimento de alta (armadilha de compradores)"
    f.append(Factor("structure", "Rompimento ou falso rompimento a favor", struct_ok, WEIGHTS["structure"], detail=why))
    return f


def _score(factors: list[Factor]) -> int:
    avail = sum(x.weight for x in factors if x.available)
    got = sum(x.weight for x in factors if x.available and x.ok)
    return round(100 * got / avail) if avail else 0


def analyze(candles: Sequence[Candle], s: EngineSettings, now: float | None = None,
            stale: bool = False) -> Analysis:
    if len(candles) < MIN_BARS:
        return Analysis("AGUARDAR", None, 0, 0, 0, "indefinida",
                        candles[-1].time if candles else None, candles[-1].close if candles else None,
                        blockers=[f"Histórico insuficiente: {len(candles)}/{MIN_BARS} candles M5"])

    t = [x.time for x in candles]
    o = [x.open for x in candles]
    h = [x.high for x in candles]
    lo = [x.low for x in candles]
    cl = [x.close for x in candles]
    v = [x.volume for x in candles]
    has_volume = sum(1 for x in v[-50:] if x > 0) >= 40

    e50, e200 = ind.ema(cl, 50), ind.ema(cl, 200)
    r = ind.rsi(cl)
    _, _, hist = ind.macd(cl)
    at = ind.atr(h, lo, cl)
    ax, pdi, mdi = ind.adx(h, lo, cl)
    vw = ind.vwap(t, h, lo, cl, v) if has_volume else [None] * len(cl)
    vsma = ind.sma(v, 20)

    price = cl[-1]
    atr_v = _last(at) or 0.0
    vol_ratio = (v[-1] / vsma[-1]) if has_volume and vsma[-1] else None
    ctx = {
        "open": o[-1], "high": h[-1], "low": lo[-1], "close": price,
        "ema50": _last(e50), "ema200": _last(e200), "rsi": _last(r),
        "macd_hist": _last(hist), "macd_hist_prev": _last(hist, 2),
        "vwap": _last(vw), "adx": _last(ax), "plus_di": _last(pdi), "minus_di": _last(mdi),
        "atr": atr_v, "vol_ratio": vol_ratio,
        "breakout": breakout(h, lo, cl, atr_v),
    }
    if any(ctx[k] is None for k in ("ema50", "ema200", "rsi", "macd_hist", "macd_hist_prev", "adx")):
        return Analysis("AGUARDAR", None, 0, 0, 0, "indefinida", t[-1], price,
                        blockers=["Indicadores ainda sem dados suficientes"])

    atr_pct = 100 * atr_v / price if price else 0.0
    supports, resistances = find_levels(h, lo, price, atr_v)
    indicators = {
        "ema50": ctx["ema50"], "ema200": ctx["ema200"], "rsi": ctx["rsi"], "macd_hist": ctx["macd_hist"],
        "vwap": ctx["vwap"], "adx": ctx["adx"], "plus_di": ctx["plus_di"], "minus_di": ctx["minus_di"],
        "atr": atr_v, "atr_pct": atr_pct, "vol_ratio": vol_ratio, "has_volume": has_volume,
    }
    levels = {"supports": [x.to_dict() for x in supports], "resistances": [x.to_dict() for x in resistances],
              "range_high": ctx["breakout"]["range_high"], "range_low": ctx["breakout"]["range_low"]}

    lf, sf = _side_factors("long", ctx, s), _side_factors("short", ctx, s)
    sl, ss = _score(lf), _score(sf)
    side = "long" if sl >= ss else "short"
    factors = lf if side == "long" else sf
    score = max(sl, ss)

    if ctx["close"] > ctx["ema200"] and ctx["ema50"] > ctx["ema200"]:
        trend = "alta"
    elif ctx["close"] < ctx["ema200"] and ctx["ema50"] < ctx["ema200"]:
        trend = "baixa"
    else:
        trend = "lateral"
    if ctx["adx"] < s.min_adx:
        trend = "lateral"

    blockers: list[str] = []
    if stale:
        blockers.append("Dados desatualizados ou conexão instável: entradas bloqueadas")
    if ctx["adx"] < s.min_adx:
        blockers.append(f"Mercado sem direção (ADX {ctx['adx']:.1f} < {s.min_adx:g})")
    if not (s.atr_pct_min <= atr_pct <= s.atr_pct_max):
        blockers.append(f"Volatilidade fora da faixa (ATR {atr_pct:.3f}% do preço)")
    if s.require_trend and not factors[0].ok:
        blockers.append("Tendência principal contra a direção")
    if side == "long" and ctx["rsi"] > s.rsi_extreme:
        blockers.append(f"RSI {ctx['rsi']:.0f}: sobrecomprado, risco de entrada tardia")
    if side == "short" and ctx["rsi"] < 100 - s.rsi_extreme:
        blockers.append(f"RSI {ctx['rsi']:.0f}: sobrevendido, risco de entrada tardia")
    br = ctx["breakout"]
    if side == "long" and br["bull_fake"]:
        blockers.append("Falso rompimento de alta no último candle")
    if side == "short" and br["bear_fake"]:
        blockers.append("Falso rompimento de baixa no último candle")

    plan = _plan(side, ctx, h, lo, t[-1], s, supports, resistances, blockers)

    if score < s.min_score:
        blockers.append(f"Confluência {score}/100 abaixo do mínimo {s.min_score}")
    # Por último: só importa se todo o resto aprovaria. Evita entrada atrasada.
    now = now or t[-1] + M5
    delay = now - (t[-1] + M5)
    if delay > s.max_signal_delay_s:
        blockers.append(f"Candle fechou há {int(delay)}s: janela de entrada encerrada, aguardando o próximo")

    reasons = [f.label + (f" ({f.detail})" if f.detail else "") for f in factors if f.ok and f.available]
    if blockers:
        return Analysis("AGUARDAR", side, score, sl, ss, trend, t[-1], price, factors, blockers, reasons,
                        indicators, levels, None)
    return Analysis("COMPRA" if side == "long" else "VENDA", side, score, sl, ss, trend, t[-1], price, factors,
                    [], reasons, indicators, levels, plan)


def _plan(side: str, c: dict, h: Sequence[float], lo: Sequence[float], bar_time: int, s: EngineSettings,
          supports, resistances, blockers: list[str]) -> Plan | None:
    entry, a = c["close"], c["atr"]
    if a <= 0:
        blockers.append("ATR zero: impossível calcular stop")
        return None
    if side == "long":
        structural = min(lo[-3:]) - 0.1 * a
        stop = min(structural, entry - s.stop_atr_mult * a)
        risk = entry - stop
    else:
        structural = max(h[-3:]) + 0.1 * a
        stop = max(structural, entry + s.stop_atr_mult * a)
        risk = stop - entry
    if risk > s.max_stop_atr * a:
        blockers.append(f"Estrutura exige stop de {risk / a:.1f} ATR (máx. {s.max_stop_atr:g})")
        return None
    sign = 1 if side == "long" else -1
    tp1 = entry + sign * s.tp1_rr * risk
    tp2 = entry + sign * s.tp2_rr * risk
    obstacles = resistances if side == "long" else supports
    for lv in obstacles:
        p = lv.price
        between = entry + 0.2 * risk < p < tp1 if side == "long" else tp1 < p < entry - 0.2 * risk
        if between:
            blockers.append(f"{'Resistência' if side == 'long' else 'Suporte'} em {p:.5g} antes do alvo 1")
            break
    z = s.entry_zone_atr * a
    return Plan(entry=entry, zone_low=entry - z, zone_high=entry + z, stop=stop, tp1=tp1, tp2=tp2,
                rr1=s.tp1_rr, rr2=s.tp2_rr, valid_until=bar_time + M5 + s.validity_bars * M5)


def series_for_chart(candles: Sequence[Candle]) -> dict:
    """Séries de indicadores para desenhar no gráfico."""
    t = [x.time for x in candles]
    cl = [x.close for x in candles]
    h = [x.high for x in candles]
    lo = [x.low for x in candles]
    v = [x.volume for x in candles]
    has_volume = sum(1 for x in v[-50:] if x > 0) >= 40

    def pack(series):
        return [{"time": ti, "value": val} for ti, val in zip(t, series) if val is not None]

    _, _, hist = ind.macd(cl)
    return {
        "ema50": pack(ind.ema(cl, 50)),
        "ema200": pack(ind.ema(cl, 200)),
        "vwap": pack(ind.vwap(t, h, lo, cl, v)) if has_volume else [],
        "rsi": pack(ind.rsi(cl)),
        "macd_hist": pack(hist),
    }
