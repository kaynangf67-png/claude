"""Simulador de operações DEMO. Não conecta a corretora e não envia ordem real nenhuma.

- Stop-loss obrigatório; tamanho calculado pelo risco por operação.
- Execução ao preço atual (não ao preço do sinal), e só dentro da região de entrada.
- Stop/alvo verificados a cada atualização; se os dois forem tocados no mesmo candle,
  assume-se o stop (premissa conservadora).
- Limite diário de perda trava novas entradas até o dia seguinte.
- Botão de emergência fecha tudo a mercado e trava até desbloqueio manual.
- Entradas bloqueadas com dados velhos ou provedor em erro.
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select

from .config import settings
from .db import Database, TradeRow
from .market.models import bucket
from .market.store import Asset
from .signals import Signal


class DemoError(Exception):
    pass


@dataclass
class DemoSettings:
    initial_balance: float = 10_000.0
    risk_pct: float = 1.0
    daily_loss_limit_pct: float = 3.0
    target: str = "tp1"  # tp1 | tp2
    max_open: int = 5

    @classmethod
    def from_dict(cls, d: dict) -> "DemoSettings":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


class DemoAccount:
    def __init__(self, db: Database) -> None:
        self.db = db
        self.settings = DemoSettings.from_dict(db.kv_get("demo_settings", {}))
        st = db.kv_get("demo_state") or {}
        self.balance: float = st.get("balance", self.settings.initial_balance)
        self.locked: bool = st.get("locked", False)
        self.lock_reason: str = st.get("lock_reason", "")
        self.lock_day: str | None = st.get("lock_day")
        self.listeners: list = []
        # extremos de preço observados desde a entrada (para o candle da entrada)
        self._extremes: dict[int, tuple[float, float]] = {}

    # ---------------- estado ----------------
    def _save(self) -> None:
        self.db.kv_set("demo_state", {"balance": self.balance, "locked": self.locked,
                                      "lock_reason": self.lock_reason, "lock_day": self.lock_day})

    def update_settings(self, data: dict) -> None:
        merged = {**asdict(self.settings), **data}
        s = DemoSettings.from_dict(merged)
        if s.risk_pct <= 0 or s.risk_pct > 5:
            raise DemoError("Risco por operação deve ficar entre 0 e 5%")
        if s.daily_loss_limit_pct <= 0 or s.daily_loss_limit_pct > 20:
            raise DemoError("Limite diário de perda deve ficar entre 0 e 20%")
        if s.target not in {"tp1", "tp2"}:
            raise DemoError("Alvo deve ser tp1 ou tp2")
        if s.initial_balance <= 0:
            raise DemoError("Saldo inicial deve ser positivo")
        self.settings = s
        self.db.kv_set("demo_settings", asdict(s))

    def reset(self, initial_balance: float) -> None:
        if self.open_trades():
            raise DemoError("Feche as operações abertas antes de reiniciar a conta")
        self.update_settings({"initial_balance": initial_balance})
        self.balance = initial_balance
        self.locked, self.lock_reason, self.lock_day = False, "", None
        self._save()
        self.db.log("demo", f"Conta demo reiniciada com saldo {initial_balance:.2f}")

    def _today(self) -> str:
        return datetime.now(ZoneInfo(settings.timezone)).date().isoformat()

    def _day_start_ts(self) -> float:
        tz = ZoneInfo(settings.timezone)
        now = datetime.now(tz)
        return now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()

    def today_pnl(self) -> float:
        with self.db.session() as s:
            rows = s.scalars(select(TradeRow.pnl).where(
                TradeRow.mode == "demo", TradeRow.status == "fechada", TradeRow.closed_at >= self._day_start_ts()))
            return float(sum(p or 0 for p in rows))

    def open_trades(self) -> list[TradeRow]:
        with self.db.session() as s:
            return list(s.scalars(select(TradeRow).where(TradeRow.mode == "demo", TradeRow.status == "aberta")))

    def _refresh_lock(self) -> None:
        # trava por limite diário vence no dia seguinte; a de emergência só manual
        if self.locked and self.lock_day and self.lock_day != self._today():
            self.locked, self.lock_reason, self.lock_day = False, "", None
            self._save()

    def state(self) -> dict:
        self._refresh_lock()
        day_pnl = self.today_pnl()
        start = self.balance - day_pnl
        limit = start * self.settings.daily_loss_limit_pct / 100
        return {
            "mode": "demo", "balance": self.balance, "initial_balance": self.settings.initial_balance,
            "today_pnl": day_pnl, "daily_loss_limit": limit, "daily_loss_used": max(0.0, -day_pnl),
            "locked": self.locked, "lock_reason": self.lock_reason, "settings": asdict(self.settings),
            "open_trades": [t.to_dict() for t in self.open_trades()],
        }

    # ---------------- operações ----------------
    def open_from_signal(self, sig: Signal, asset: Asset, provider_ok: bool) -> TradeRow:
        self._refresh_lock()
        if self.locked:
            raise DemoError(f"Conta travada: {self.lock_reason}")
        if sig.status != "ativo":
            raise DemoError(f"Sinal {sig.status}: {sig.status_reason}")
        if not provider_ok or asset.is_stale():
            raise DemoError("Conexão com a fonte de dados instável: entrada bloqueada")
        price = asset.last_price
        if price is None:
            raise DemoError("Sem preço atual do ativo")
        if not (sig.zone_low <= price <= sig.zone_high):
            raise DemoError("Preço atual fora da região de entrada: entrada atrasada recusada")
        if len(self.open_trades()) >= self.settings.max_open:
            raise DemoError(f"Máximo de {self.settings.max_open} operações abertas")
        if any(t.asset_key == asset.key for t in self.open_trades()):
            raise DemoError("Já existe operação aberta neste ativo")
        stop = sig.stop
        target = sig.tp1 if self.settings.target == "tp1" else sig.tp2
        risk_per_unit = abs(price - stop)
        if risk_per_unit <= 0:
            raise DemoError("Stop inválido")
        if (sig.direction == "long" and not (stop < price < target)) or \
           (sig.direction == "short" and not (target < price < stop)):
            raise DemoError("Preço atual já está além do stop ou do alvo")
        risk_money = self.balance * self.settings.risk_pct / 100
        state = self.state()
        if state["daily_loss_used"] + risk_money > state["daily_loss_limit"] + 1e-9:
            raise DemoError("Esta entrada pode ultrapassar o limite diário de perda")
        qty = risk_money / risk_per_unit
        row = TradeRow(
            mode="demo", signal_id=sig.id, asset_key=asset.key, symbol=asset.symbol, market=asset.market.value,
            source=asset.source, data_is_live=asset.is_live, direction=sig.direction, qty=qty, entry=price,
            stop=stop, target=target, opened_at=time.time(), status="aberta", score=sig.score,
        )
        with self.db.session() as s:
            s.add(row)
            s.commit()
        self._extremes[row.id] = (price, price)
        self.db.log("demo", f"Entrada {sig.direction} {asset.symbol} @ {price:.6g} stop {stop:.6g} alvo {target:.6g}")
        self._emit("aberta", row)
        return row

    def close_trade(self, trade_id: int, price: float, reason: str) -> TradeRow:
        with self.db.session() as s:
            row = s.get(TradeRow, trade_id)
            if row is None or row.status != "aberta":
                raise DemoError("Operação não encontrada ou já fechada")
            sign = 1 if row.direction == "long" else -1
            row.exit, row.exit_reason, row.closed_at, row.status = price, reason, time.time(), "fechada"
            row.pnl = (price - row.entry) * row.qty * sign
            row.r_multiple = (price - row.entry) * sign / abs(row.entry - row.stop)
            s.commit()
        self._extremes.pop(trade_id, None)
        self.balance += row.pnl or 0
        self._save()
        self.db.log("demo", f"Saída {row.symbol} {reason} @ {price:.6g} resultado {row.pnl:+.2f}")
        self._check_daily_limit()
        self._emit("fechada", row)
        return row

    def _check_daily_limit(self) -> None:
        st = self.state()
        if not self.locked and st["daily_loss_used"] >= st["daily_loss_limit"] > 0:
            self.locked, self.lock_reason, self.lock_day = True, "Limite diário de perda atingido", self._today()
            self._save()
            self.db.log("demo", "Limite diário de perda atingido: novas entradas bloqueadas até amanhã")

    def emergency(self, assets: dict[str, Asset]) -> int:
        n = 0
        for t in self.open_trades():
            a = assets.get(t.asset_key)
            price = a.last_price if a and a.last_price is not None else t.entry
            self.close_trade(t.id, price, "emergencia")
            n += 1
        self.locked, self.lock_reason, self.lock_day = True, "Botão de emergência acionado", None
        self._save()
        return n

    def unlock(self) -> None:
        if self.lock_day == self._today():
            raise DemoError("Trava do limite diário só libera no próximo dia")
        self.locked, self.lock_reason, self.lock_day = False, "", None
        self._save()

    def on_price(self, asset: Asset) -> None:
        """Stop-loss e take-profit automáticos."""
        for t in self.open_trades():
            if t.asset_key != asset.key or asset.last_price is None:
                continue
            hi, lo = self._extremes.get(t.id, (t.entry, t.entry))
            hi, lo = max(hi, asset.last_price), min(lo, asset.last_price)
            entry_bucket = bucket(t.opened_at)
            bars = list(asset.candles) + ([asset.forming] if asset.forming else [])
            for b in bars:
                if b.time > entry_bucket:
                    hi, lo = max(hi, b.high), min(lo, b.low)
            self._extremes[t.id] = (hi, lo)
            if t.direction == "long":
                hit_stop, hit_tp = lo <= t.stop, hi >= t.target
            else:
                hit_stop, hit_tp = hi >= t.stop, lo <= t.target
            if hit_stop:
                self.close_trade(t.id, t.stop, "stop")
            elif hit_tp:
                self.close_trade(t.id, t.target, "alvo")

    def _emit(self, event: str, row: TradeRow) -> None:
        for cb in self.listeners:
            cb(event, row)
