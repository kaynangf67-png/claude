# Backtest M1 SNIPER BOT — 2026-11-07 17:51 UTC

**Fonte:** DADOS SINTÉTICOS (validação da mecânica — NÃO representa mercado real)  
**Parâmetros:** minScore 70, ADX mín. 20, payout 85% → break-even 54.1%  
**Modelo:** entrada na abertura do candle seguinte ao sinal, expiração 1 min, uma operação por vez.

**Cobertura:**
- SINT-A: 20160 candles, 2026-01-05T00:00 → 2026-01-18T23:59 UTC
- SINT-B: 20160 candles, 2026-01-05T00:00 → 2026-01-18T23:59 UTC
- SINT-C: 20160 candles, 2026-01-05T00:00 → 2026-01-18T23:59 UTC

### Todos os sinais (sem gestão diária)
Dias com sinal: 14. Média 251.0 sinais/dia.

| Ativo | Sinais | GREEN | LOSS | Empate | Acerto | Resultado (stakes) | Drawdown máx. (stakes) | Seq. LOSS máx. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| SINT-A | 1154 | 663 | 491 | 0 | 57.5% | 72.55 | 19.20 | 6 |
| SINT-B | 1203 | 684 | 519 | 0 | 56.9% | 62.40 | 16.75 | 12 |
| SINT-C | 1157 | 669 | 488 | 0 | 57.8% | 80.65 | 17.45 | 9 |
| **TOTAL** | **3514** | 2016 | 1498 | 0 | **57.4%** | **215.60** | 20.15 | 12 |

### Com gestão diária global (uma operação por vez, para em 10 GREEN ou 3 LOSS)
Operações: 95 em 14 dias.

| Ativo | Sinais | GREEN | LOSS | Empate | Acerto | Resultado (stakes) | Drawdown máx. (stakes) | Seq. LOSS máx. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| SINT-A | 23 | 12 | 11 | 0 | 52.2% | -0.80 | 4.45 | 4 |
| SINT-B | 32 | 14 | 18 | 0 | 43.8% | -6.10 | 6.95 | 5 |
| SINT-C | 40 | 27 | 13 | 0 | 67.5% | 9.95 | 3.15 | 3 |
| **TOTAL** | **95** | 53 | 42 | 0 | **55.8%** | **3.05** | 5.60 | 4 |

> Resultado passado não garante resultado futuro. Preços da Binance não são os preços da Quotex;
> pares OTC da corretora não têm fonte independente e não podem ser validados por este backtest.
