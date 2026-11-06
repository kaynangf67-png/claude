"""API do TRADE AGENT 2x0 — Fase 1: só saúde e configuração pública.

Nenhum endpoint de ordem existe nesta fase. Documentação automática em /docs.
"""
from __future__ import annotations

from fastapi import FastAPI

from app.core.config import load_settings

settings = load_settings()  # falha ao iniciar se a configuração for insegura (ex.: TRADING_MODE=REAL)

app = FastAPI(
    title="TRADE AGENT 2x0",
    version="0.1.0-fase1",
    description="API de orquestração. Ambiente DEMO; execução real desabilitada.",
)


@app.get("/api/v1/health", tags=["sistema"])
def health() -> dict:
    return {"status": "ok", "fase": 1, "trading_mode": settings.trading_mode.value}


@app.get("/api/v1/system", tags=["sistema"])
def system() -> dict:
    return {
        **settings.public_view(),
        "modules": {
            "risk_manager": "não implementado (Fase 2)",
            "frontend": "não implementado (Fase 3)",
            "mt5_bridge": "não implementado (Fase 4)",
            "market_data": "não implementado (Fase 5)",
            "trade_intelligence": "não implementado (Fase 5)",
            "strategy_comparison": "não implementado (Fases 6 e 8)",
            "notifications": "não implementado (Fase 7)",
        },
    }
