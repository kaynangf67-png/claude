-- Safirion Auto-Bot M1
-- Cole este script no editor de Scripts da plataforma e clique Salvar

-- ── CONFIGURACAO ──────────────────────────────────────────────
local AMOUNT     = 1000   -- valor por entrada
local EXPIRY     = 1      -- expiracao em minutos
local MIN_SIG    = 3      -- minimo de confirmacoes (de 5)
local EMA_FAST   = 9
local EMA_SLOW   = 21
local RSI_PER    = 14
local RSI_OB     = 70
local RSI_OS     = 30
local STOCH_K    = 5
local STOCH_D    = 3
local STOCH_OB   = 80
local STOCH_OS   = 20
local BB_PER     = 20
local BB_STD     = 2.0
local ATR_PER    = 14
local MIN_ATR    = 0.0003

-- ── ESTADO INTERNO ────────────────────────────────────────────
local closes  = {}
local highs   = {}
local lows    = {}
local opens_  = {}
local pending = nil   -- sinal aguardando proxima vela

-- ── INDICADORES ───────────────────────────────────────────────

local function ema(arr, period)
  local k   = 2 / (period + 1)
  local out = {}
  out[1] = arr[1]
  for i = 2, #arr do
    out[i] = arr[i] * k + out[i-1] * (1 - k)
  end
  return out
end

local function rsi(arr, period)
  local out = {}
  local n   = #arr
  for i = 1, n do out[i] = 50 end
  if n <= period then return out end

  local ag, al = 0, 0
  for i = 2, period + 1 do
    local d = arr[i] - arr[i-1]
    if d > 0 then ag = ag + d else al = al - d end
  end
  ag = ag / period
  al = al / period
  out[period+1] = al == 0 and 100 or (100 - 100/(1 + ag/al))

  for i = period + 2, n do
    local d  = arr[i] - arr[i-1]
    local gn = d > 0 and d or 0
    local ls = d < 0 and -d or 0
    ag = (ag * (period-1) + gn) / period
    al = (al * (period-1) + ls) / period
    out[i] = al == 0 and 100 or (100 - 100/(1 + ag/al))
  end
  return out
end

local function stoch(hi, lo, cl, kp, dp)
  local k = {}
  for i = 1, #cl do
    if i < kp then
      k[i] = 50
    else
      local lo_v, hi_v = math.huge, -math.huge
      for j = i - kp + 1, i do
        if lo[j] < lo_v then lo_v = lo[j] end
        if hi[j] > hi_v then hi_v = hi[j] end
      end
      local r = hi_v - lo_v
      k[i] = r == 0 and 50 or (100 * (cl[i] - lo_v) / r)
    end
  end
  local d = {}
  for i = 1, #k do
    if i < dp then
      d[i] = k[i]
    else
      local s = 0
      for j = i - dp + 1, i do s = s + k[j] end
      d[i] = s / dp
    end
  end
  return k, d
end

local function bollinger(cl, period, mult)
  local up, md, dn = {}, {}, {}
  for i = 1, #cl do
    if i < period then
      up[i] = cl[i]; md[i] = cl[i]; dn[i] = cl[i]
    else
      local s = 0
      for j = i - period + 1, i do s = s + cl[j] end
      local m = s / period
      local v = 0
      for j = i - period + 1, i do v = v + (cl[j] - m)^2 end
      local sd = math.sqrt(v / period)
      up[i] = m + mult * sd
      md[i] = m
      dn[i] = m - mult * sd
    end
  end
  return up, md, dn
end

local function atr_calc(hi, lo, cl, period)
  local tr = {}
  tr[1] = hi[1] - lo[1]
  for i = 2, #cl do
    local a = hi[i] - lo[i]
    local b = math.abs(hi[i] - cl[i-1])
    local c = math.abs(lo[i] - cl[i-1])
    tr[i] = math.max(a, b, c)
  end
  return ema(tr, period)
end

-- ── LOGICA DE SINAL ───────────────────────────────────────────

local function analyze()
  local n = #closes
  if n < EMA_SLOW + 10 then return nil, 0 end

  local ef     = ema(closes, EMA_FAST)
  local es     = ema(closes, EMA_SLOW)
  local rv     = rsi(closes, RSI_PER)
  local kv, dv = stoch(highs, lows, closes, STOCH_K, STOCH_D)
  local bbu, _, bbl = bollinger(closes, BB_PER, BB_STD)
  local av     = atr_calc(highs, lows, closes, ATR_PER)

  local i     = n - 1
  local price = closes[i]
  local a     = av[i]

  if a / price < MIN_ATR then return nil, 0 end

  local calls, puts = 0, 0

  -- 1. EMA crossover / alinhamento
  local dp = ef[i-3] - es[i-3]
  local dc = ef[i]   - es[i]
  if     dp < 0 and dc > 0 then calls = calls + 1
  elseif dp > 0 and dc < 0 then puts  = puts  + 1
  elseif ef[i] > es[i] and ef[i] > ef[i-3] then calls = calls + 1
  elseif ef[i] < es[i] and ef[i] < ef[i-3] then puts  = puts  + 1
  end

  -- 2. RSI zona (janela 3 velas)
  local rmin, rmax = math.huge, -math.huge
  for j = i-2, i do
    if rv[j] < rmin then rmin = rv[j] end
    if rv[j] > rmax then rmax = rv[j] end
  end
  if     rmin < RSI_OS then calls = calls + 1
  elseif rmax > RSI_OB then puts  = puts  + 1
  end

  -- 3. Estocastico cruzamento
  local cu, cd = false, false
  for j = math.max(2, i-4), i do
    if kv[j-1] <= dv[j-1] and kv[j] > dv[j] then cu = true end
    if kv[j-1] >= dv[j-1] and kv[j] < dv[j] then cd = true end
  end
  local was_os, was_ob = false, false
  for j = math.max(1, i-7), math.max(1, i-2) do
    if dv[j] < STOCH_OS + 20 then was_os = true end
    if dv[j] > STOCH_OB - 20 then was_ob = true end
  end
  if cu and was_os then calls = calls + 1 end
  if cd and was_ob then puts  = puts  + 1 end

  -- 4. Bollinger Bands
  local nl = price <= bbl[i] + a * 0.3
  local nh = price >= bbu[i] - a * 0.3
  local tl, th = false, false
  for j = math.max(1, i-4), i do
    if closes[j] <= bbl[j] then tl = true end
    if closes[j] >= bbu[j] then th = true end
  end
  if     nl or tl then calls = calls + 1
  elseif nh or th then puts  = puts  + 1
  end

  -- 5. Momentum preco vs EMA9
  if     price > ef[i] and closes[i-3] < ef[i-3] then calls = calls + 1
  elseif price < ef[i] and closes[i-3] > ef[i-3] then puts  = puts  + 1
  elseif price > ef[i] and ef[i] > es[i]          then calls = calls + 1
  elseif price < ef[i] and ef[i] < es[i]          then puts  = puts  + 1
  end

  if calls >= MIN_SIG and calls > puts then return "buy",  calls end
  if puts  >= MIN_SIG and puts > calls  then return "sell", puts  end
  return nil, math.max(calls, puts)
end

-- ── CALLBACKS DA PLATAFORMA ───────────────────────────────────
-- A Safirion/FintechFuel chama onCandle() a cada vela fechada

function onCandle(candle)
  -- alimenta o historico
  table.insert(opens_,  candle.open  or candle.o)
  table.insert(highs,   candle.high  or candle.h)
  table.insert(lows,    candle.low   or candle.l)
  table.insert(closes,  candle.close or candle.c)

  -- mantém janela de 120 velas
  if #closes > 120 then
    table.remove(opens_, 1)
    table.remove(highs,  1)
    table.remove(lows,   1)
    table.remove(closes, 1)
  end

  -- se havia sinal da vela anterior, entra agora
  if pending then
    local direction = pending
    pending = nil
    if direction == "buy" then
      buy(AMOUNT, EXPIRY)
    else
      sell(AMOUNT, EXPIRY)
    end
    print("ENTRADA " .. direction:upper() .. " R$ " .. AMOUNT)
  end

  -- analisa vela recém-fechada
  local sig, score = analyze()
  if sig then
    pending = sig
    print("SINAL: " .. sig:upper() .. " (score " .. score .. "/5) -> entrando na proxima vela")
  else
    print("Aguardando... score " .. score .. "/5 | velas: " .. #closes)
  end
end

-- fallback: algumas plataformas usam onTick em vez de onCandle
function onTick(tick)
  if tick and tick.isClosed then
    onCandle(tick)
  end
end

-- init log
print("Bot M1 carregado. Aguardando velas...")
print("Config: AMOUNT=" .. AMOUNT .. " MIN_SIG=" .. MIN_SIG .. "/" .. 5)
