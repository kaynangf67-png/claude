"""Cálculo de lote para o risco planejado em BRL. Puro (sem banco), para ser testado à parte.

Perda planejada por lote = (distância do stop + spread + slippage) em ticks × valor do tick + comissão por lote,
convertida da moeda da conta para BRL. O lote é arredondado PARA BAIXO no incremento da corretora, então o risco
calculado nunca passa do limite. Isso não garante que a perda real seja exatamente esse valor: gap e slippage maior
que o estimado podem passar do planejado.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from app.core.contracts import Decision, SymbolSpec


@dataclass(frozen=True)
class ExecCosts:
    spread_price: float            # spread atual, em preço
    slippage_price: float          # slippage estimado, em preço
    commission_per_lot: float      # ida e volta, na moeda da conta


@dataclass(frozen=True)
class SizingResult:
    ok: bool
    lots: float
    planned_risk_brl: float
    reason: str


def validate_levels(direction: Decision, entry: float, stop: float, take: float) -> str | None:
    """Stop e alvo do lado certo do preço. Devolve o motivo da recusa ou None."""
    if direction not in (Decision.BUY, Decision.SELL):
        return "Decisão sem direção (NO TRADE) não gera ordem."
    if not all(math.isfinite(v) and v > 0 for v in (entry, stop, take)):
        return "Stop Loss, Take Profit ou preço de referência inválido."
    if direction is Decision.BUY and not (stop < entry < take):
        return "Compra exige Stop Loss abaixo e Take Profit acima do preço."
    if direction is Decision.SELL and not (take < entry < stop):
        return "Venda exige Stop Loss acima e Take Profit abaixo do preço."
    return None


def size_position(*, spec: SymbolSpec, entry: float, stop: float, costs: ExecCosts, fx_to_brl: float,
                  max_risk_brl: float) -> SizingResult:
    if fx_to_brl <= 0 or not math.isfinite(fx_to_brl):
        return SizingResult(False, 0.0, 0.0, "Sem conversão válida para BRL: o risco não pode ser calculado.")
    if spec.tick_size <= 0 or spec.tick_value <= 0 or spec.volume_step <= 0 or spec.volume_min <= 0:
        return SizingResult(False, 0.0, 0.0, "Especificação do símbolo inválida (tick ou volume).")
    distance = abs(entry - stop) + max(costs.spread_price, 0) + max(costs.slippage_price, 0)
    loss_per_lot_acct = distance / spec.tick_size * spec.tick_value + max(costs.commission_per_lot, 0)
    loss_per_lot_brl = loss_per_lot_acct * fx_to_brl
    if loss_per_lot_brl <= 0:
        return SizingResult(False, 0.0, 0.0, "Distância de stop inválida.")
    steps = math.floor((max_risk_brl / loss_per_lot_brl) / spec.volume_step + 1e-9)
    lots = round(min(steps * spec.volume_step, spec.volume_max), 8)
    if lots < spec.volume_min - 1e-12:
        min_risk = spec.volume_min * loss_per_lot_brl
        return SizingResult(False, 0.0, round(min_risk, 2),
                            f"O volume mínimo ({spec.volume_min}) arriscaria R$ {min_risk:.2f}, acima do limite de "
                            f"R$ {max_risk_brl:.2f}. Operação recusada.")
    risk = lots * loss_per_lot_brl
    return SizingResult(True, lots, round(risk, 2), f"{lots} lote(s) → risco planejado R$ {risk:.2f}.")
