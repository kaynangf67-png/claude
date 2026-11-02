"""
Indicadores técnicos para M1 — cinco camadas de confluência.
Janela de detecção: 3 velas para acomodar lag natural dos indicadores.
Retorna CALL, PUT ou None.
"""

import numpy as np
import pandas as pd
from config import (
    EMA_FAST, EMA_SLOW, RSI_PERIOD, RSI_OB, RSI_OS,
    STOCH_K, STOCH_D, STOCH_OB, STOCH_OS,
    BB_PERIOD, BB_STD, ATR_PERIOD, MIN_ATR_RATIO, MIN_SIGNALS
)


# ─── PRIMITIVOS ─────────────────────────────────────────────────

def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain  = delta.clip(lower=0)
    loss  = (-delta).clip(lower=0)
    avg_g = gain.ewm(com=period - 1, adjust=False).mean()
    avg_l = loss.ewm(com=period - 1, adjust=False).mean()
    rs    = avg_g / avg_l.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def stochastic(high: pd.Series, low: pd.Series, close: pd.Series,
               k: int = 5, d: int = 3):
    lowest  = low.rolling(k).min()
    highest = high.rolling(k).max()
    k_line  = 100 * (close - lowest) / (highest - lowest).replace(0, np.nan)
    d_line  = k_line.rolling(d).mean()
    return k_line, d_line


def bollinger(close: pd.Series, period: int = 20, std_mult: float = 2.0):
    mid   = close.rolling(period).mean()
    std   = close.rolling(period).std()
    upper = mid + std_mult * std
    lower = mid - std_mult * std
    return upper, mid, lower


def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, adjust=False).mean()


# ─── MOTOR DE SINAIS ────────────────────────────────────────────

def analyze(df: pd.DataFrame) -> dict:
    """
    df deve ter colunas: open, high, low, close, volume
    Janela de análise: últimas 3 velas fechadas (índices -4..-2).
    Retorna {'signal': 'CALL'|'PUT'|None, 'score': int, 'reasons': [str]}
    """
    if len(df) < max(EMA_SLOW, BB_PERIOD, RSI_PERIOD) + 8:
        return {"signal": None, "score": 0, "reasons": ["dados insuficientes"]}

    c = df["close"]
    h = df["high"]
    l = df["low"]

    ef    = ema(c, EMA_FAST)
    es    = ema(c, EMA_SLOW)
    rsi_v = rsi(c, RSI_PERIOD)
    k, d  = stochastic(h, l, c, STOCH_K, STOCH_D)
    bb_u, bb_m, bb_l = bollinger(c, BB_PERIOD, BB_STD)
    atr_v = atr(h, l, c, ATR_PERIOD)

    # janela: -4 até -2 (3 velas fechadas recentes)
    WIN = slice(-4, -1)   # [-4, -3, -2]
    i   = -2              # vela fechada mais recente

    price   = c.iloc[i]
    atr_cur = atr_v.iloc[i]

    # filtro de volatilidade
    if atr_cur / price < MIN_ATR_RATIO:
        return {"signal": None, "score": 0, "reasons": ["mercado lateral — sem volatilidade"]}

    calls, puts, reasons_c, reasons_p = 0, 0, [], []

    # ── 1 · EMA crossover (janela 3 velas) ──
    ema_diff = ef - es   # positivo = EMA rápida acima
    diff_win  = ema_diff.iloc[WIN]
    if diff_win.iloc[0] < 0 and diff_win.iloc[-1] > 0:
        calls += 1; reasons_c.append("EMA cruzou pra cima (janela)")
    elif diff_win.iloc[0] > 0 and diff_win.iloc[-1] < 0:
        puts  += 1; reasons_p.append("EMA cruzou pra baixo (janela)")
    # tendência: ambas EMAs alinhadas mesmo sem cruzamento
    elif ef.iloc[i] > es.iloc[i] and ef.iloc[i] > ef.iloc[i-3]:
        calls += 1; reasons_c.append("EMA9 acima EMA21 e subindo")
    elif ef.iloc[i] < es.iloc[i] and ef.iloc[i] < ef.iloc[i-3]:
        puts  += 1; reasons_p.append("EMA9 abaixo EMA21 e caindo")

    # ── 2 · RSI (verifica janela: condição ativa em qualquer das 3 velas) ──
    rsi_win = rsi_v.iloc[WIN]
    if rsi_win.min() < RSI_OS:
        calls += 1; reasons_c.append(f"RSI sobrevendido (min {rsi_win.min():.1f} na janela)")
    elif rsi_win.max() > RSI_OB:
        puts  += 1; reasons_p.append(f"RSI sobrecomprado (max {rsi_win.max():.1f} na janela)")

    # ── 3 · Estocástico: cruzamento dentro da janela + vindo de zona extrema ──
    k_win = k.iloc[WIN]; d_win = d.iloc[WIN]
    # encontra cruzamento K/D
    k_arr = k.iloc[-6:-1].values;  d_arr = d.iloc[-6:-1].values
    cross_up   = any(k_arr[j-1] <= d_arr[j-1] and k_arr[j] > d_arr[j] for j in range(1, len(k_arr)))
    cross_down = any(k_arr[j-1] >= d_arr[j-1] and k_arr[j] < d_arr[j] for j in range(1, len(k_arr)))
    d_was_os = d.iloc[-8:-3].min() < STOCH_OS + 20
    d_was_ob = d.iloc[-8:-3].max() > STOCH_OB - 20
    if cross_up and d_was_os:
        calls += 1; reasons_c.append("Estoc cruzou pra cima saindo de OS")
    elif cross_down and d_was_ob:
        puts  += 1; reasons_p.append("Estoc cruzou pra baixo saindo de OB")

    # ── 4 · Bollinger Bands (janela ou proximidade) ──
    # toque na banda OU preço dentro de 0.3 ATR da banda
    near_lower = price <= bb_l.iloc[i] + atr_cur * 0.3
    near_upper = price >= bb_u.iloc[i] - atr_cur * 0.3
    # verifica se houve toque na janela
    touched_lower = (c.iloc[-5:-1] <= bb_l.iloc[-5:-1]).any()
    touched_upper = (c.iloc[-5:-1] >= bb_u.iloc[-5:-1]).any()
    if near_lower or touched_lower:
        calls += 1; reasons_c.append("Preço na/perto da BB inferior")
    elif near_upper or touched_upper:
        puts  += 1; reasons_p.append("Preço na/perto da BB superior")

    # ── 5 · Momentum: direção do preço vs EMAs ──
    # preço recuperando de abaixo das EMAs
    if price > ef.iloc[i] and c.iloc[i-3] < ef.iloc[i-3]:
        calls += 1; reasons_c.append("Preço cruzou acima da EMA9")
    elif price < ef.iloc[i] and c.iloc[i-3] > ef.iloc[i-3]:
        puts  += 1; reasons_p.append("Preço cruzou abaixo da EMA9")
    # tendência confirmada
    elif price > ef.iloc[i] > es.iloc[i]:
        calls += 1; reasons_c.append("Preço acima das duas EMAs")
    elif price < ef.iloc[i] < es.iloc[i]:
        puts  += 1; reasons_p.append("Preço abaixo das duas EMAs")

    if calls >= MIN_SIGNALS and calls > puts:
        return {"signal": "CALL", "score": calls, "reasons": reasons_c}
    if puts >= MIN_SIGNALS and puts > calls:
        return {"signal": "PUT",  "score": puts,  "reasons": reasons_p}

    return {"signal": None, "score": max(calls, puts),
            "reasons": reasons_c + reasons_p or ["confluência insuficiente"]}
