"""API do TRADE AGENT 2x0 — Fase 1: só saúde e configuração pública.

Nenhum endpoint de ordem existe nesta fase. Documentação automática em /docs.
"""
from __future__ import annotations

from fastapi import FastAPI

from app.api.routes import router
from app.core.config import load_settings

settings = load_settings()  # falha ao iniciar se a configuração for insegura (ex.: TRADING_MODE=REAL)

app = FastAPI(
    title="TRADE AGENT 2x0",
    version="0.2.0-fase2",
    description="API de orquestração. Ambiente DEMO; execução real desabilitada.",
)
app.include_router(router)


@app.get("/api/v1/health", tags=["sistema"])
def health() -> dict:
    return {"status": "ok", "fase": 2, "trading_mode": settings.trading_mode.value}


@app.get("/api/v1/system", tags=["sistema"])
def system() -> dict:
    return {
        **settings.public_view(),
        "modules": {
            "risk_manager": "implementado (Fase 2); sem execução até o EA (Fase 4)",
            "frontend": "não implementado (Fase 3)",
            "mt5_bridge": "não implementado (Fase 4)",
            "market_data": "não implementado (Fase 5)",
            "trade_intelligence": "não implementado (Fase 5)",
            "strategy_comparison": "não implementado (Fases 6 e 8)",
            "notifications": "não implementado (Fase 7)",
        },
    }
