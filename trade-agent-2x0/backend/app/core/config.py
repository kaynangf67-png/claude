"""Configuração central. Lida só de variáveis de ambiente; nada de segredo no código.

Regra de segurança: o modo de operação é DEMO por padrão e o modo REAL é RECUSADO nesta versão,
mesmo que alguém configure TRADING_MODE=REAL. A ativação futura do REAL exigirá uma autorização
separada (checklist + confirmação do administrador), que ainda não existe.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from zoneinfo import ZoneInfo


class TradingMode(str, Enum):
    DEMO = "DEMO"
    REAL = "REAL"


class ConfigError(RuntimeError):
    """Configuração inválida ou insegura: o sistema não deve iniciar."""


OPERATING_TZ = ZoneInfo("America/Sao_Paulo")
ASSETS = ("EURUSD", "GBPUSD", "USDJPY")
TIMEFRAMES = ("H1", "M15", "M5", "M1")


@dataclass(frozen=True)
class Settings:
    trading_mode: TradingMode = TradingMode.DEMO
    database_url: str | None = None
    risk_per_trade_brl: float = 5.0
    max_trades_per_day: int = 2
    target_wins_per_day: int = 2
    block_high_impact_news: bool = True
    assets: tuple[str, ...] = field(default=ASSETS)
    # Segredos: só a presença é registrada; o valor nunca é exposto em logs ou API.
    ea_shared_secret_set: bool = False
    telegram_configured: bool = False

    def public_view(self) -> dict:
        """O que pode ser mostrado no painel (sem segredos)."""
        return {
            "trading_mode": self.trading_mode.value,
            "real_execution_enabled": False,
            "risk_per_trade_brl": self.risk_per_trade_brl,
            "max_trades_per_day": self.max_trades_per_day,
            "target_wins_per_day": self.target_wins_per_day,
            "block_high_impact_news": self.block_high_impact_news,
            "assets": list(self.assets),
            "timezone": str(OPERATING_TZ),
            "database_configured": bool(self.database_url),
            "ea_auth_configured": self.ea_shared_secret_set,
            "telegram_configured": self.telegram_configured,
        }


def load_settings(env: dict[str, str] | None = None) -> Settings:
    e = os.environ if env is None else env
    raw_mode = (e.get("TRADING_MODE") or "DEMO").strip().upper()
    try:
        mode = TradingMode(raw_mode)
    except ValueError as exc:
        raise ConfigError(f"TRADING_MODE inválido: {raw_mode!r}. Use DEMO.") from exc
    if mode is TradingMode.REAL:
        raise ConfigError(
            "Modo REAL bloqueado nesta versão. A ativação exige a autorização separada do administrador "
            "(checklist de segurança e testes aprovados), que ainda não foi implementada."
        )
    risk = float(e.get("RISK_PER_TRADE_BRL") or 5.0)
    if not 0 < risk <= 5.0:
        raise ConfigError("RISK_PER_TRADE_BRL deve ser maior que 0 e no máximo 5.")
    return Settings(
        trading_mode=mode,
        database_url=e.get("DATABASE_URL") or None,
        risk_per_trade_brl=risk,
        block_high_impact_news=(e.get("BLOCK_HIGH_IMPACT_NEWS", "true").lower() != "false"),
        ea_shared_secret_set=bool(e.get("EA_SHARED_SECRET")),
        telegram_configured=bool(e.get("TELEGRAM_BOT_TOKEN") and e.get("TELEGRAM_CHAT_ID")),
    )
