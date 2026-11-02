--[[
  Safirion Auto-Bot — M1
  Indicadores: EMA 9/21 · RSI 14 · Estocástico 5,3 · Bollinger 20 · ATR 14
  Entrada automática na próxima vela com R$ 1.000
  Dependências: luasocket, luasec, dkjson (ou cjson)
  Instalar: luarocks install luasocket luasec dkjson
--]]

-- ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
local CONFIG = {
  email          = "SEU_EMAIL_AQUI",
  password       = "SUA_SENHA_AQUI",
  broker_url     = "https://safirion.com",
  api_login      = "/api/auth/login",        -- ajuste se necessário
  api_candles    = "/api/quotes/history",    -- ajuste se necessário
  api_trade      = "/api/trade/open",        -- ajuste se necessário
  asset          = "EURUSD",
  amount         = 1000,
  expiry_sec     = 60,    -- M1 = 60 segundos
  min_signals    = 3,
  ema_fast       = 9,
  ema_slow       = 21,
  rsi_period     = 14,
  rsi_ob         = 70,
  rsi_os         = 30,
  stoch_k        = 5,
  stoch_d        = 3,
  stoch_ob       = 80,
  stoch_os       = 20,
  bb_period      = 20,
  bb_std         = 2.0,
  atr_period     = 14,
  min_atr_ratio  = 0.0003,
}

-- ─── LIBS ────────────────────────────────────────────────────────────────────
local http    = require("socket.http")
local https   = require("ssl.https")
local ltn12   = require("ltn12")
local json    = require("dkjson")
local socket  = require("socket")

-- ─── UTILS ───────────────────────────────────────────────────────────────────
local function log(msg, tag)
  local ts = os.date("%H:%M:%S")
  io.write(string.format("[%s][%s] %s\n", ts, tag or "BOT", msg))
  io.flush()
end

local function sleep(sec)
  socket.sleep(sec)
end

local function https_request(url, method, body, headers)
  local resp_body = {}
  local req_headers = headers or {}
  req_headers["Content-Type"] = req_headers["Content-Type"] or "application/json"
  if body then
    req_headers["Content-Length"] = tostring(#body)
  end
  local ok, code = https.request({
    url     = url,
    method  = method or "GET",
    headers = req_headers,
    source  = body and ltn12.source.string(body) or nil,
    sink    = ltn12.sink.table(resp_body),
    verify  = "peer",
  })
  local resp_str = table.concat(resp_body)
  if not ok then
    return nil, code, resp_str
  end
  local decoded = json.decode(resp_str)
  return decoded, code, resp_str
end

-- ─── INDICADORES ─────────────────────────────────────────────────────────────

local function calc_ema(closes, period)
  local k = 2 / (period + 1)
  local ema = {}
  ema[1] = closes[1]
  for i = 2, #closes do
    ema[i] = closes[i] * k + ema[i-1] * (1 - k)
  end
  return ema
end

local function calc_rsi(closes, period)
  local rsi = {}
  local avg_gain, avg_loss = 0, 0
  -- primeiro período: média simples
  for i = 2, period + 1 do
    local diff = closes[i] - closes[i-1]
    if diff > 0 then avg_gain = avg_gain + diff
    else             avg_loss = avg_loss + math.abs(diff) end
  end
  avg_gain = avg_gain / period
  avg_loss = avg_loss / period
  for i = 1, period do rsi[i] = 50 end  -- placeholder
  if avg_loss == 0 then
    rsi[period + 1] = 100
  else
    local rs = avg_gain / avg_loss
    rsi[period + 1] = 100 - (100 / (1 + rs))
  end
  for i = period + 2, #closes do
    local diff = closes[i] - closes[i-1]
    local gain = diff > 0 and diff or 0
    local loss = diff < 0 and math.abs(diff) or 0
    avg_gain = (avg_gain * (period - 1) + gain) / period
    avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0 then
      rsi[i] = 100
    else
      local rs = avg_gain / avg_loss
      rsi[i] = 100 - (100 / (1 + rs))
    end
  end
  return rsi
end

local function calc_stochastic(highs, lows, closes, k_period, d_period)
  local k_line = {}
  for i = 1, #closes do
    if i < k_period then
      k_line[i] = 50
    else
      local lowest, highest = math.huge, -math.huge
      for j = i - k_period + 1, i do
        if lows[j]  < lowest  then lowest  = lows[j]  end
        if highs[j] > highest then highest = highs[j] end
      end
      local range = highest - lowest
      if range == 0 then k_line[i] = 50
      else k_line[i] = 100 * (closes[i] - lowest) / range end
    end
  end
  -- D = SMA do K
  local d_line = {}
  for i = 1, #k_line do
    if i < d_period then
      d_line[i] = k_line[i]
    else
      local sum = 0
      for j = i - d_period + 1, i do sum = sum + k_line[j] end
      d_line[i] = sum / d_period
    end
  end
  return k_line, d_line
end

local function calc_bollinger(closes, period, std_mult)
  local upper, middle, lower = {}, {}, {}
  for i = 1, #closes do
    if i < period then
      upper[i]  = closes[i]
      middle[i] = closes[i]
      lower[i]  = closes[i]
    else
      local sum = 0
      for j = i - period + 1, i do sum = sum + closes[j] end
      local mid = sum / period
      local var = 0
      for j = i - period + 1, i do var = var + (closes[j] - mid)^2 end
      local sd = math.sqrt(var / period)
      upper[i]  = mid + std_mult * sd
      middle[i] = mid
      lower[i]  = mid - std_mult * sd
    end
  end
  return upper, middle, lower
end

local function calc_atr(highs, lows, closes, period)
  local tr_list = {}
  tr_list[1] = highs[1] - lows[1]
  for i = 2, #closes do
    local hl  = highs[i] - lows[i]
    local hcp = math.abs(highs[i] - closes[i-1])
    local lcp = math.abs(lows[i]  - closes[i-1])
    tr_list[i] = math.max(hl, hcp, lcp)
  end
  -- EMA do TR
  local k   = 2 / (period + 1)
  local atr = {}
  atr[1] = tr_list[1]
  for i = 2, #tr_list do
    atr[i] = tr_list[i] * k + atr[i-1] * (1 - k)
  end
  return atr
end

-- ─── MOTOR DE SINAIS ─────────────────────────────────────────────────────────

local function analyze(opens, highs, lows, closes)
  local n = #closes
  if n < CONFIG.ema_slow + 10 then
    return nil, 0, {"dados insuficientes"}
  end

  local ema_f = calc_ema(closes, CONFIG.ema_fast)
  local ema_s = calc_ema(closes, CONFIG.ema_slow)
  local rsi_v = calc_rsi(closes, CONFIG.rsi_period)
  local k_v, d_v = calc_stochastic(highs, lows, closes, CONFIG.stoch_k, CONFIG.stoch_d)
  local bb_u, _, bb_l = calc_bollinger(closes, CONFIG.bb_period, CONFIG.bb_std)
  local atr_v = calc_atr(highs, lows, closes, CONFIG.atr_period)

  -- índice da vela fechada mais recente (penúltima, -2 em Python = n-1 em Lua)
  local i = n - 1   -- vela fechada recente
  local price   = closes[i]
  local atr_cur = atr_v[i]

  -- filtro lateral
  if atr_cur / price < CONFIG.min_atr_ratio then
    return nil, 0, {"mercado lateral — sem volatilidade"}
  end

  local calls, puts = 0, 0
  local reasons_c, reasons_p = {}, {}

  -- 1 · EMA crossover / alinhamento (janela 3 velas)
  local diff_prev = ema_f[i-3] - ema_s[i-3]
  local diff_cur  = ema_f[i]   - ema_s[i]
  if diff_prev < 0 and diff_cur > 0 then
    calls = calls + 1; table.insert(reasons_c, "EMA cruzou pra cima")
  elseif diff_prev > 0 and diff_cur < 0 then
    puts  = puts + 1;  table.insert(reasons_p, "EMA cruzou pra baixo")
  elseif ema_f[i] > ema_s[i] and ema_f[i] > ema_f[i-3] then
    calls = calls + 1; table.insert(reasons_c, "EMA9 acima EMA21 e subindo")
  elseif ema_f[i] < ema_s[i] and ema_f[i] < ema_f[i-3] then
    puts  = puts + 1;  table.insert(reasons_p, "EMA9 abaixo EMA21 e caindo")
  end

  -- 2 · RSI zona (janela 3 velas)
  local rsi_min, rsi_max = math.huge, -math.huge
  for j = i-2, i do
    if rsi_v[j] < rsi_min then rsi_min = rsi_v[j] end
    if rsi_v[j] > rsi_max then rsi_max = rsi_v[j] end
  end
  if rsi_min < CONFIG.rsi_os then
    calls = calls + 1
    table.insert(reasons_c, string.format("RSI sobrevendido (min %.1f)", rsi_min))
  elseif rsi_max > CONFIG.rsi_ob then
    puts = puts + 1
    table.insert(reasons_p, string.format("RSI sobrecomprado (max %.1f)", rsi_max))
  end

  -- 3 · Estocástico cruzamento saindo de zona extrema
  local cross_up, cross_down = false, false
  for j = math.max(2, i-4), i do
    if k_v[j-1] <= d_v[j-1] and k_v[j] > d_v[j] then cross_up   = true end
    if k_v[j-1] >= d_v[j-1] and k_v[j] < d_v[j] then cross_down = true end
  end
  local d_was_os, d_was_ob = false, false
  for j = math.max(1, i-7), math.max(1, i-2) do
    if d_v[j] < CONFIG.stoch_os + 20 then d_was_os = true end
    if d_v[j] > CONFIG.stoch_ob - 20 then d_was_ob = true end
  end
  if cross_up and d_was_os then
    calls = calls + 1; table.insert(reasons_c, "Estoc cruzou pra cima saindo de OS")
  elseif cross_down and d_was_ob then
    puts  = puts + 1;  table.insert(reasons_p, "Estoc cruzou pra baixo saindo de OB")
  end

  -- 4 · Bollinger Bands
  local near_lower   = price <= bb_l[i] + atr_cur * 0.3
  local near_upper   = price >= bb_u[i] - atr_cur * 0.3
  local touch_lower, touch_upper = false, false
  for j = math.max(1, i-4), i do
    if closes[j] <= bb_l[j] then touch_lower = true end
    if closes[j] >= bb_u[j] then touch_upper = true end
  end
  if near_lower or touch_lower then
    calls = calls + 1; table.insert(reasons_c, "Preço na/perto da BB inferior")
  elseif near_upper or touch_upper then
    puts  = puts + 1;  table.insert(reasons_p, "Preço na/perto da BB superior")
  end

  -- 5 · Momentum: preço cruzou EMA9
  if price > ema_f[i] and closes[i-3] < ema_f[i-3] then
    calls = calls + 1; table.insert(reasons_c, "Preço cruzou acima da EMA9")
  elseif price < ema_f[i] and closes[i-3] > ema_f[i-3] then
    puts  = puts + 1;  table.insert(reasons_p, "Preço cruzou abaixo da EMA9")
  elseif price > ema_f[i] and ema_f[i] > ema_s[i] then
    calls = calls + 1; table.insert(reasons_c, "Preço acima das duas EMAs")
  elseif price < ema_f[i] and ema_f[i] < ema_s[i] then
    puts  = puts + 1;  table.insert(reasons_p, "Preço abaixo das duas EMAs")
  end

  if calls >= CONFIG.min_signals and calls > puts then
    return "CALL", calls, reasons_c
  end
  if puts >= CONFIG.min_signals and puts > calls then
    return "PUT", puts, reasons_p
  end

  local all = {}
  for _, v in ipairs(reasons_c) do table.insert(all, v) end
  for _, v in ipairs(reasons_p) do table.insert(all, v) end
  if #all == 0 then all = {"confluência insuficiente"} end
  return nil, math.max(calls, puts), all
end

-- ─── CONEXÃO SAFIRION ────────────────────────────────────────────────────────

local session = { token = nil }

local function login()
  log("Fazendo login...", "AUTH")
  local body = json.encode({
    email    = CONFIG.email,
    password = CONFIG.password,
  })
  local data, code = https_request(
    CONFIG.broker_url .. CONFIG.api_login,
    "POST", body
  )
  if not data then
    log("Erro no login: " .. tostring(code), "ERR")
    return false
  end
  -- adapte o campo conforme a resposta real da Safirion
  session.token = data.token or data.access_token or data.jwt
  if not session.token then
    log("Token não encontrado na resposta: " .. json.encode(data), "ERR")
    return false
  end
  log("Login OK — token recebido.", "AUTH")
  return true
end

local function fetch_candles(asset, count)
  local url = string.format(
    "%s%s?symbol=%s&timeframe=1&count=%d",
    CONFIG.broker_url, CONFIG.api_candles, asset, count
  )
  local headers = { Authorization = "Bearer " .. (session.token or "") }
  local data, code = https_request(url, "GET", nil, headers)
  if not data then
    log("Erro ao buscar candles: " .. tostring(code), "ERR")
    return nil
  end
  -- adapte conforme o formato real da API da Safirion
  local candles = data.candles or data.data or data
  if type(candles) ~= "table" then
    log("Formato de candles inesperado", "ERR")
    return nil
  end
  return candles
end

local function place_trade(direction)
  log(string.format("Entrando %s R$ %d...", direction, CONFIG.amount), "TRADE")
  local body = json.encode({
    asset     = CONFIG.asset,
    direction = direction:lower(),   -- "call" ou "put"
    amount    = CONFIG.amount,
    expiry    = CONFIG.expiry_sec,
  })
  local headers = {
    Authorization  = "Bearer " .. (session.token or ""),
    ["Content-Type"] = "application/json",
  }
  local data, code = https_request(
    CONFIG.broker_url .. CONFIG.api_trade,
    "POST", body, headers
  )
  if not data then
    log("Falha na entrada: HTTP " .. tostring(code), "ERR")
    return false
  end
  if data.error or data.message then
    log("Erro da API: " .. (data.message or data.error), "ERR")
    return false
  end
  log(string.format("ENTRADA %s R$ %d — OK (id=%s)",
    direction, CONFIG.amount, tostring(data.id or data.trade_id or "?")), "TRADE")
  return true
end

-- ─── PARSEIA CANDLES ─────────────────────────────────────────────────────────

local function parse_candles(raw)
  -- adapte os nomes dos campos conforme a API da Safirion
  local opens, highs, lows, closes = {}, {}, {}, {}
  for _, c in ipairs(raw) do
    table.insert(opens,  tonumber(c.open  or c.o))
    table.insert(highs,  tonumber(c.high  or c.h))
    table.insert(lows,   tonumber(c.low   or c.l))
    table.insert(closes, tonumber(c.close or c.c))
  end
  return opens, highs, lows, closes
end

-- ─── TIMER M1 ────────────────────────────────────────────────────────────────

local function seconds_to_next_candle()
  local t   = os.time()
  local sec = t % 60
  return 60 - sec
end

-- ─── MAIN LOOP ───────────────────────────────────────────────────────────────

local function main()
  io.write([[
╔══════════════════════════════════════════╗
║      SAFIRION AUTO-BOT  ·  M1  ·  LUA   ║
╚══════════════════════════════════════════╝
]])

  -- login
  if not login() then
    log("Não foi possível fazer login. Verifique config.", "ERR")
    os.exit(1)
  end

  local trade_count = 0

  while true do
    -- aguarda próximo fechamento de vela M1
    local wait = seconds_to_next_candle()
    log(string.format("Próxima vela em %.0fs", wait), "TIMER")
    sleep(wait + 0.5)

    -- busca candles
    local raw = fetch_candles(CONFIG.asset, 110)
    if not raw then
      log("Sem dados — tentando novamente em 5s", "WARN")
      sleep(5)
      goto continue
    end

    local opens, highs, lows, closes = parse_candles(raw)

    -- analisa
    local signal, score, reasons = analyze(opens, highs, lows, closes)
    local sig_str = signal or "AGUARDANDO"
    log(string.format("Análise: %s  score=%d/%d",
      sig_str, score, CONFIG.min_signals * 2), "IND")
    for _, r in ipairs(reasons) do
      log("  · " .. r, "IND")
    end

    -- entrada
    if signal == "CALL" or signal == "PUT" then
      log(string.format(">>> SINAL %s CONFIRMADO — entrando na próxima vela!", signal), "SIG")
      local nxt = seconds_to_next_candle()
      log(string.format("Aguardando abertura da vela (%.0fs)...", nxt), "TIMER")
      sleep(nxt + 0.3)

      local ok = place_trade(signal)
      if ok then
        trade_count = trade_count + 1
        log(string.format("Entrada #%d executada.", trade_count), "TRADE")
      end
    else
      log("Sem confluência — aguardando próxima vela.", "INFO")
    end

    ::continue::
  end
end

main()
