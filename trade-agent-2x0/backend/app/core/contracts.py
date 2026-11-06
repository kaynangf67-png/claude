"""Interfaces entre os módulos (Fase 1). Só os contratos: as implementações chegam nas fases seguintes.

Princípios:
- Análise técnica (Trade Intelligence) PROPÕE; o Risk Manager 2x0 DECIDE. Nenhuma outra peça autoriza ordem.
- O EA só executa uma TradeAuthorization emitida pelo Risk Manager, nunca texto da IA.
- Execução só conta como operação quando a corretora confirma (posição/deal), não pela resposta HTTP.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Protocol


class Decision(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    NO_TRADE = "NO_TRADE"


class StrategyModel(str, Enum):
    SCALPING = "SCALPING"
    HIBRIDO = "HIBRIDO"


class DataSource(str, Enum):
    """Toda leitura de mercado diz de onde veio. Nunca rotular histórico ou demo como ao vivo."""
    LIVE = "LIVE"
    DEMO_FEED = "DEMO_FEED"
    HISTORICAL = "HISTORICAL"


class RiskState(str, Enum):
    READY = "READY"
    FIRST_TRADE_ACTIVE = "FIRST_TRADE_ACTIVE"
    FIRST_WIN = "FIRST_WIN"
    SECOND_TRADE_ACTIVE = "SECOND_TRADE_ACTIVE"
    TARGET_REACHED = "TARGET_REACHED"
    DAILY_LOCKED = "DAILY_LOCKED"
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"


# Estados em que o Risk Manager pode autorizar uma NOVA entrada. Todos os outros bloqueiam.
ENTRY_ALLOWED_STATES = frozenset({RiskState.READY, RiskState.FIRST_WIN})


@dataclass(frozen=True)
class Candle:
    symbol: str
    timeframe: str
    open_time: datetime  # UTC
    open: float
    high: float
    low: float
    close: float
    volume: float | None
    complete: bool
    source: DataSource


@dataclass(frozen=True)
class Quote:
    symbol: str
    bid: float
    ask: float
    time: datetime  # UTC
    source: DataSource

    @property
    def spread(self) -> float:
        return self.ask - self.bid


@dataclass(frozen=True)
class TradeSignal:
    """Saída do Trade Intelligence Engine. Uma PROPOSTA, nunca uma ordem."""
    symbol: str
    decision: Decision
    model: StrategyModel
    entry_timeframe: str
    higher_tf_context: str
    trigger: str
    rationale: str
    factors_for: tuple[str, ...]
    factors_against: tuple[str, ...]
    reference_price: float | None
    stop_loss: float | None
    take_profit: float | None
    risk_reward: float | None
    valid_until: datetime | None
    technical_score: float           # 0–100: qualidade técnica, NÃO é probabilidade de acerto
    statistical_confidence: float | None  # só com amostra suficiente; None quando não há
    sample_size: int | None
    model_version: str


@dataclass(frozen=True)
class TradeAuthorization:
    """Emitida SOMENTE pelo Risk Manager 2x0. É a única coisa que o EA aceita executar."""
    authorization_id: str  # UUID: chave de idempotência no EA
    signal_id: str
    symbol: str
    direction: Decision
    volume_lots: float
    stop_loss: float
    take_profit: float
    planned_risk_brl: float
    expires_at: datetime
    trading_mode: str  # sempre "DEMO" nesta versão


@dataclass(frozen=True)
class SymbolSpec:
    """Especificação do símbolo na corretora (lida do MT5)."""
    symbol: str          # com sufixo da corretora, ex.: EURUSD.m
    tick_size: float
    tick_value: float    # na moeda da conta
    contract_size: float
    volume_min: float
    volume_step: float
    volume_max: float
    account_currency: str


class MarketDataProvider(Protocol):
    def candles(self, symbol: str, timeframe: str, count: int) -> list[Candle]: ...
    def quote(self, symbol: str) -> Quote: ...
    def symbol_spec(self, symbol: str) -> SymbolSpec: ...


class TradeIntelligence(Protocol):
    def analyze(self, symbol: str, model: StrategyModel) -> TradeSignal: ...


class RiskManager(Protocol):
    def state(self, day: str) -> RiskState: ...
    def authorize(self, signal: TradeSignal, spec: SymbolSpec, fx_to_brl: float) -> TradeAuthorization | None: ...
    def on_position_opened(self, authorization_id: str, broker_ticket: str) -> None: ...
    def on_position_closed(self, authorization_id: str, net_result_brl: float) -> None: ...
    def require_reconciliation(self, reason: str) -> None: ...


class Notifier(Protocol):
    def notify(self, event_key: str, text: str) -> bool:
        """event_key evita duplicidade: o mesmo evento nunca é enviado duas vezes."""
        ...
