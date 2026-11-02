-- Bot M1 Safirion — FintechFuel native Lua API
-- Fonte: ask (Serie do runtime) | Indicadores: EMA 9/21, RSI 14, BB 20, ATR 14
-- Entrada: buy:set(1) / sell:set(1) | Requer 3/5 sinais

-- ── PARAMETROS ──
local EMA_F  = 9
local EMA_S  = 21
local RSI_P  = 14
local RSI_OB = 70
local RSI_OS = 30
local BB_P   = 20
local BB_D   = 2.0
local ATR_P  = 14
local MIN_S  = 3

-- ── FONTE DE PRECO ──
-- ask e bid sao Series objects com metamethods identicos ao candle
-- passamos ask como source para as funcoes nativas do runtime
local src  = ask     -- serie de ask prices
local src2 = bid     -- para mid price

-- ── INDICADORES (calculados pelo runtime por barra) ──
local ef  = ema(src, EMA_F)    -- EMA rapida
local es  = ema(src, EMA_S)    -- EMA lenta
local rv  = rsi(src, RSI_P)    -- RSI 14

-- Stochastic (se disponivel)
local stk_raw = ema(src, 3)   -- aproximacao via ema curta

-- Bollinger: media e desvio
local sm  = sma(src, BB_P)    -- BB media

-- ATR (high-low range aproximado via ema de spread)
local spread = ask - bid
local atr_v  = ema(spread, ATR_P)

-- ── GUARD: sem dados suficientes ──
if na(ef) or na(es) or na(rv) or na(sm) then
  buy:set(0)
  sell:set(0)
  return
end

-- ── VOLATILIDADE MINIMA ──
-- atr_v != nil e spread > threshold minimo
if not na(atr_v) then
  local spread_val = spread * 1
  if not na(spread_val) and spread_val < 0.00005 then
    buy:set(0)
    sell:set(0)
    return
  end
end

-- ── LOGICA DE SINAL ──
local calls = 0
local puts  = 0

-- 1. EMA crossover / alinhamento
if ef > es then
  calls = calls + 1
else
  puts = puts + 1
end

-- 2. EMA momentum (slope: EMA fast subindo ou caindo)
local ef_prev = ema(src, EMA_F + 1)
if not na(ef_prev) then
  if ef > ef_prev then calls = calls + 1
  elseif ef < ef_prev then puts = puts + 1
  end
end

-- 3. RSI zona
if rv < RSI_OS then
  calls = calls + 1
elseif rv > RSI_OB then
  puts = puts + 1
end

-- 4. Preco vs EMA fast
local price = src * 1    -- escalar via __mul metamethod
if not na(price) then
  if price > ef then calls = calls + 1
  else puts = puts + 1
  end
end

-- 5. Preco vs Bollinger media
if not na(price) and not na(sm) then
  if price < sm then calls = calls + 1
  else puts = puts + 1
  end
end

-- ── SINAL FINAL ──
if calls >= MIN_S and calls > puts then
  buy:set(1)
  sell:set(0)
elseif puts >= MIN_S and puts > calls then
  buy:set(0)
  sell:set(1)
else
  buy:set(0)
  sell:set(0)
end
