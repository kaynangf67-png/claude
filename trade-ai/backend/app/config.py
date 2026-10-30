"""Configuração via variáveis de ambiente. Nada aqui é segredo embutido."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _bool(name: str, default: bool) -> bool:
    raw = _env(name)
    if not raw:
        return default
    return raw.lower() in {"1", "true", "yes", "on", "sim"}


def _int(name: str, default: int) -> int:
    raw = _env(name)
    return int(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./trade_ai.db"))
    timezone: str = field(default_factory=lambda: _env("APP_TIMEZONE", "America/Sao_Paulo"))
    cors_origins: list[str] = field(
        default_factory=lambda: [o for o in _env("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
    )

    # Binance: dados públicos de cripto, sem chave.
    binance_enabled: bool = field(default_factory=lambda: _bool("BINANCE_ENABLED", True))
    binance_base_url: str = field(default_factory=lambda: _env("BINANCE_BASE_URL", "https://api.binance.com"))
    binance_max_symbols: int = field(default_factory=lambda: _int("BINANCE_MAX_SYMBOLS", 60))

    # Twelve Data: forex, ações EUA, índices, commodities. Requer chave.
    twelvedata_api_key: str = field(default_factory=lambda: _env("TWELVEDATA_API_KEY"))
    twelvedata_symbols: str = field(
        default_factory=lambda: _env(
            "TWELVEDATA_SYMBOLS",
            "forex:EUR/USD,forex:GBP/USD,forex:USD/JPY,us_stocks:AAPL,us_stocks:NVDA,"
            "indices:SPX,commodities:XAU/USD",
        )
    )
    twelvedata_credits_per_minute: int = field(default_factory=lambda: _int("TWELVEDATA_CREDITS_PER_MINUTE", 8))

    # TradingView (Pine Script -> webhook). Sem segredo, o endpoint fica desligado.
    tradingview_webhook_secret: str = field(default_factory=lambda: _env("TRADINGVIEW_WEBHOOK_SECRET"))

    # Análise de imagens (Claude).
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    vision_model: str = field(default_factory=lambda: _env("VISION_MODEL", "claude-opus-5-5"))

    # Feed sintético: DESLIGADO por padrão e sempre rotulado como SIMULADO.
    simulated_feed: bool = field(default_factory=lambda: _bool("ENABLE_SIMULATED_FEED", False))

    scan_interval_s: int = field(default_factory=lambda: _int("SCAN_INTERVAL_S", 10))


settings = Settings()
