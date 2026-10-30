"""Backtest do motor sobre os candles históricos de um ativo.

Resultados ficam com mode="backtest" e nunca se misturam com a conta demo.
Premissas (exibidas na interface):
- entrada na ABERTURA do candle seguinte ao sinal, só se ela estiver na região de entrada;
- stop e alvo verificados pela máxima/mínima; os dois no mesmo candle = stop;
- sem custos, spread ou slippage (o resultado real tende a ser pior).
"""

from __future__ import annotations

import time
from typing import Sequence

from .analysis.engine import EngineSettings, analyze
from .db import BacktestRunRow, Database, TradeRow
from .market.models import M5, Candle
from .market.store import Asset

WINDOW = 320


def simulate(candles: Sequence[Candle], s: EngineSettings, target: str = "tp1") -> tuple[list[dict], dict]:
    trades: list[dict] = []
    skipped = 0
    i = 210
    n = len(candles)
    while i < n - 1:
        window = candles[max(0, i + 1 - WINDOW): i + 1]
        a = analyze(window, s, now=candles[i].time + M5 + 1)
        if a.plan is None or a.decision == "AGUARDAR":
            i += 1
            continue
        p = a.plan
        nxt = candles[i + 1]
        if not (p.zone_low <= nxt.open <= p.zone_high):
            skipped += 1
            i += 1
            continue
        long = a.direction == "long"
        entry, stop = nxt.open, p.stop
        tgt = p.tp1 if target == "tp1" else p.tp2
        if (long and not stop < entry < tgt) or (not long and not tgt < entry < stop):
            skipped += 1
            i += 1
            continue
        exit_price, reason, j = None, None, i + 1
        while j < n:
            b = candles[j]
            hit_stop = b.low <= stop if long else b.high >= stop
            hit_tp = b.high >= tgt if long else b.low <= tgt
            if hit_stop:
                exit_price, reason = stop, "stop"
                break
            if hit_tp:
                exit_price, reason = tgt, "alvo"
                break
            j += 1
        if exit_price is None:
            exit_price, reason, j = candles[-1].close, "fim_dos_dados", n - 1
        sign = 1 if long else -1
        r = (exit_price - entry) * sign / abs(entry - stop)
        trades.append({"direction": a.direction, "entry": entry, "stop": stop, "target": tgt, "exit": exit_price,
                       "reason": reason, "r": r, "opened": candles[i + 1].time, "closed": candles[j].time,
                       "score": a.score})
        i = j + 1
    return trades, summarize([t["r"] for t in trades], skipped)


def summarize(rs: list[float], skipped: int = 0) -> dict:
    wins = [r for r in rs if r > 0]
    losses = [r for r in rs if r <= 0]
    eq = peak = dd = 0.0
    for r in rs:
        eq += r
        peak = max(peak, eq)
        dd = max(dd, peak - eq)
    gross_loss = -sum(losses)
    return {
        "trades": len(rs), "wins": len(wins), "losses": len(losses),
        "hit_rate": (len(wins) / len(rs)) if rs else None,
        "total_r": sum(rs), "avg_r": (sum(rs) / len(rs)) if rs else None,
        "profit_factor": (sum(wins) / gross_loss) if gross_loss > 0 else None,
        "max_drawdown_r": dd, "skipped_late_entries": skipped,
    }


def run_backtest(db: Database, asset: Asset, s: EngineSettings, target: str = "tp1") -> dict:
    candles = list(asset.candles)
    if len(candles) < 260:
        raise ValueError(f"Histórico insuficiente para backtest: {len(candles)} candles (mínimo 260)")
    trades, summary = simulate(candles, s, target)
    summary.update({"from": candles[0].time, "to": candles[-1].close_time, "bars": len(candles),
                    "data_is_live": asset.is_live, "source": asset.source,
                    "assumptions": "Entrada na abertura seguinte; sem custos/slippage; stop prioritário."})
    with db.session() as ses:
        run = BacktestRunRow(asset_key=asset.key, created_at=time.time(), bars=len(candles), summary=summary)
        ses.add(run)
        ses.flush()
        for t in trades:
            ses.add(TradeRow(
                mode="backtest", run_id=run.id, asset_key=asset.key, symbol=asset.symbol, market=asset.market.value,
                source=asset.source, data_is_live=asset.is_live, direction=t["direction"], qty=1.0,
                entry=t["entry"], stop=t["stop"], target=t["target"], opened_at=t["opened"], closed_at=t["closed"],
                exit=t["exit"], exit_reason=t["reason"], pnl=None, r_multiple=t["r"], status="fechada",
                score=t["score"]))
        ses.commit()
        summary["run_id"] = run.id
    return summary
