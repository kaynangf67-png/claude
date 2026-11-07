# Validação com dados reais — 2026-11-07

**Fonte:** Binance Spot, API pública (`data-api.binance.vision`), candles M1.
**Modelo:** sinal no fechamento do candle → entrada na abertura do seguinte → expiração em 1 min; uma operação por vez
por ativo; empates (close = open) excluídos do cálculo de acerto. Payout considerado: 85% → **break-even 54,1%**.

## 1. Backtest padrão (14 dias, 6 pares, parâmetros padrão: minScore 70, ADX ≥ 20)

Relatório completo: [`backtest-2026-11-07.md`](backtest-2026-11-07.md).

| Ativo | Sinais | Acerto | Resultado (stakes) | Drawdown máx. | Seq. LOSS máx. |
|---|---:|---:|---:|---:|---:|
| BTCUSDT | 777 | 50,6% | −48,30 | 57,45 | 8 |
| ETHUSDT | 836 | 46,7% | −112,05 | 123,05 | 13 |
| SOLUSDT | 725 | 48,3% | −71,00 | 78,25 | 9 |
| XRPUSDT | 732 | 51,2% | −37,15 | 45,80 | 8 |
| BNBUSDT | 790 | 49,6% | −62,70 | 80,60 | 10 |
| EURUSDT | 364 | 51,2% | −13,35 | 24,15 | 5 |
| **Total** | **4224** | **49,4%** | **−344,55** | 358,90 | 13 |

Com a gestão diária global (uma operação por vez, para em 10 GREEN / 3 LOSS): 83 operações em 15 dias,
**42,3% de acerto, −16,95 stakes**, drawdown máximo 16,95 stakes.

## 2. Sensibilidade com treino/teste (30 dias, 6 pares; treino = 1ª metade, teste = 2ª metade)

| minScore | ADX mín. | Acerto treino (n) | Acerto teste (n) |
|---:|---:|---:|---:|
| 70 | 20 | 46,5% (4301) | 49,8% (4296) |
| 70 | 25 | 46,6% (2629) | 49,3% (2660) |
| 70 | 30 | 45,9% (1502) | 48,5% (1568) |
| 80 | 20 | 46,5% (1796) | 49,5% (1731) |
| 80 | 25 | 46,6% (1011) | 48,4% (965) |
| 80 | 30 | 47,4% (555) | 47,6% (550) |
| 90 | 20 | 55,4% (74) | 47,2% (89) |
| 90 | 25 | 48,6% (37) | 48,9% (45) |
| 90 | 30 | 62,5% (16) | 45,5% (22) |

Por padrão de Price Action (30 dias, padrão): rompimento de alta 50,5% · engolfo de baixa 49,0% · rejeição de suporte
48,8% · rompimento de baixa 48,0% · pin bar de baixa 48,0% · pin bar de alta 46,8% · engolfo de alta 46,7% ·
rejeição de resistência 44,0%. CALL 47,9%, PUT 48,4%.

## Conclusão

- **A estratégia, como especificada, não mostrou vantagem estatística.** Em nenhum ativo, padrão ou combinação de
  filtros o acerto fora da amostra chegou ao break-even de 54,1%. Com payout de 85% ela perde dinheiro.
- Pontuações mais altas não melhoram o resultado no período de teste. O 62,5% de minScore 90 / ADX 30 no treino
  (16 operações) virou 45,5% no teste: amostra pequena e sobreajuste.
- O acerto levemente abaixo de 50% sugere que, em M1, sinais de continuação de tendência tendem a ser seguidos de
  pequena reversão. Mesmo invertendo os sinais (~51–53%), o resultado continua abaixo do break-even.
- Estes dados são da Binance. A Quotex usa outras cotações e, nos pares OTC, cotações próprias que não podem ser
  validadas por fonte independente.
- **Recomendação:** não liberar uso em conta real. O próprio painel bloqueia o modo REAL até haver 50 operações DEMO
  com acerto ≥ 59,1%, critério que estes resultados não atingem.
