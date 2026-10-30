from __future__ import annotations

import time
from dataclasses import dataclass, field

from ..models import Market
from ..store import CandleStore


@dataclass
class ProviderStatus:
    name: str
    label: str
    markets: list[Market]
    is_live: bool
    configured: bool
    state: str = "parado"  # parado | conectando | conectado | erro | sem_credencial
    message: str = ""
    last_ok: float | None = None
    last_error: str | None = None
    symbols: int = 0
    requires: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name, "label": self.label, "markets": [m.value for m in self.markets],
            "is_live": self.is_live, "configured": self.configured, "state": self.state,
            "message": self.message, "last_ok": self.last_ok, "last_error": self.last_error,
            "symbols": self.symbols, "requires": self.requires,
        }


class Provider:
    """Provedor de dados por pull. `poll` é chamado pelo scanner a cada ciclo."""

    status: ProviderStatus

    async def start(self, store: CandleStore) -> None:  # carga inicial
        ...

    async def poll(self, store: CandleStore) -> None:
        ...

    async def close(self) -> None:
        ...

    def ok(self, msg: str = "") -> None:
        self.status.state = "conectado"
        self.status.last_ok = time.time()
        self.status.message = msg
        self.status.last_error = None

    def fail(self, err: str) -> None:
        self.status.state = "erro"
        self.status.last_error = err
        self.status.message = err
