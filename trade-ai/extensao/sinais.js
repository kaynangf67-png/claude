(() => {
  // ---------- config ----------
  const ASSETS = [
    { sym: "BTCUSDT", name: "BTC/USDT", payout: 85 },
    { sym: "ETHUSDT", name: "ETH/USDT", payout: 85 },
    { sym: "EURUSDT", name: "EUR/USDT (≈ EUR/USD)", payout: 92 },
    { sym: "PAXGUSDT", name: "OURO (PAXG/USDT)", payout: 85 },
    { sym: "SOLUSDT", name: "SOL/USDT", payout: 85 },
    { sym: "BNBUSDT", name: "BNB/USDT", payout: 85 },
    { sym: "XRPUSDT", name: "XRP/USDT", payout: 85 },
  ];
  const REST = "https://data-api.binance.vision/api/v3/klines";
  const WS = "wss://data-stream.binance.vision/ws/";
  const MIN = 60000;
  // chart timeframe in minutes, follows the broker; 1-minute data is grouped into it
  let tf = 60;                                  // seconds: 5 = S5, 60 = M1, 300 = M5…
  const TF = () => tf * 1000;
  const tfLabel = (sec) => sec < 60 ? "S" + sec : sec < 3600 ? "M" + sec / 60 : "H" + sec / 3600;
  const RES = () => tf < 60 ? 1 : 60;           // resolution of the raw candles: 1 s for second charts, else 1 min
  const RESMS = () => RES() * 1000;
  let candlesRes = 60;                          // resolution of the Binance candles loaded now
  function group(cs, sec, res) {
    if (sec === res) return cs;
    const out = [], len = sec * 1000, nowT = now();
    for (const c of cs) {
      const t = Math.floor(c.t / len) * len, last = out[out.length - 1];
      if (last && last.t === t) { last.h = Math.max(last.h, c.h); last.l = Math.min(last.l, c.l); last.c = c.c; }
      else out.push({ t, o: c.o, h: c.h, l: c.l, c: c.c });
    }
    for (const c of out) c.closed = c.t + len <= nowT;
    return out;
  }
  // clock synced with the exchange (a PC clock a few seconds off makes the countdown wrong)
  let clockOff = 0;
  const now = () => Date.now() + clockOff;
  async function syncClock() {
    try {
      const t0 = Date.now(); const r = await fetch("https://data-api.binance.vision/api/v3/time"); const t1 = Date.now();
      const { serverTime } = await r.json(); if (serverTime) clockOff = serverTime - (t0 + t1) / 2;
    } catch {}
  }
  const STRAT_NAMES = { scan: "Sinalizar (botão)", candle: "Padrões de vela", click: "Leitura RSI/BB/EMA", combo: "Indicador", rsi: "RSI 14", bb: "Bollinger 20", ema: "EMA 9×21", coin: "Cara ou coroa" };
  const PARTS = ["rsi", "bb", "ema"];   // the strategies the indicator combines
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("sh_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sh_" + k, JSON.stringify(v)); } catch {} },
  };

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const compact = window.top !== window;   // running inside the extension panel
  const el = {
    asset: $("asset"), strategy: $("strategy"), expiry: $("expiry"), payout: $("payout"), stake: $("stake"),
  };

  // ---------- state ----------
  let candles = [];        // closed + current candle, {t,o,h,l,c,closed}
  let ws = null, wsToken = 0, reconnectDelay = 1000;
  let payouts = LS.get("payouts", {});
  let history = LS.get("history", []);      // resolved + open signals
  const lastEvalBy = {};      // market -> time of the last candle already evaluated
  let paused = null;        // reason why new signals are paused
  let feedMode = false;     // OTC / market without free data: candles come from the price on the broker screen

  ASSETS.forEach((a) => {
    const o = document.createElement("option"); o.value = a.sym; o.textContent = a.name; el.asset.appendChild(o);
  });
  el.asset.value = LS.get("asset", "BTCUSDT");
  el.expiry.value = String(LS.get("expiry", 1));
  el.stake.value = LS.get("stake", 10);

  const asset = () => ASSETS.find((a) => a.sym === el.asset.value) || ASSETS[0];
  const payoutOf = (sym) => (payouts[sym] ?? (ASSETS.find((a) => a.sym === sym) || {}).payout ?? 85);
  const expiry = () => Math.max(1, Math.min(60, Math.round(+el.expiry.value) || 1));
  function setExpiry(n) {
    if (![...el.expiry.options].some((o) => +o.value === n)) { const o = document.createElement("option"); o.value = n; o.textContent = n + " min"; el.expiry.appendChild(o); }
    if (+el.expiry.value !== n) { el.expiry.value = String(n); LS.set("expiry", n); }
  }
  const stake = () => Math.max(0.01, +el.stake.value || 1);
  let cur = LS.get("cur", "$");   // currency shown by the broker (R$, $, €…)

  // ---------- indicators ----------
  function ema(v, p) {
    const out = new Array(v.length).fill(null); if (v.length < p) return out;
    let s = 0; for (let i = 0; i < p; i++) s += v[i];
    let e = s / p; out[p - 1] = e; const k = 2 / (p + 1);
    for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); out[i] = e; }
    return out;
  }
  function rsi(v, p = 14) {
    const out = new Array(v.length).fill(null); if (v.length <= p) return out;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const d = v[i] - v[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= p; l /= p; out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = p + 1; i < v.length; i++) {
      const d = v[i] - v[i - 1];
      g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  }
  function boll(v, p = 20, k = 2) {
    const mid = new Array(v.length).fill(null), up = mid.slice(), lo = mid.slice();
    for (let i = p - 1; i < v.length; i++) {
      let s = 0; for (let j = i - p + 1; j <= i; j++) s += v[j];
      const m = s / p; let q = 0; for (let j = i - p + 1; j <= i; j++) q += (v[j] - m) ** 2;
      const sd = Math.sqrt(q / p); mid[i] = m; up[i] = m + k * sd; lo[i] = m - k * sd;
    }
    return { mid, up, lo };
  }
  function indicators(cs) {
    const c = cs.map((x) => x.c);
    return { c, rsi: rsi(c), e9: ema(c, 9), e21: ema(c, 21), bb: boll(c) };
  }
  // deterministic coin flip from the candle time, so the backtest is reproducible
  function coin(t) { let x = Math.floor(t / MIN) >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) % 2 === 0; }

  // signal at the close of candle i (uses data up to i only)
  function signalAt(strat, ind, cs, i) {
    if (i < 25) return null;
    const { c, rsi: r, e9, e21, bb } = ind;
    if (strat === "rsi") {
      if (r[i] < 30 && r[i - 1] >= 30) return "UP";
      if (r[i] > 70 && r[i - 1] <= 70) return "DOWN";
    } else if (strat === "bb") {
      if (c[i] < bb.lo[i] && c[i - 1] >= bb.lo[i - 1]) return "UP";
      if (c[i] > bb.up[i] && c[i - 1] <= bb.up[i - 1]) return "DOWN";
    } else if (strat === "ema") {
      if (e9[i] > e21[i] && e9[i - 1] <= e21[i - 1]) return "UP";
      if (e9[i] < e21[i] && e9[i - 1] >= e21[i - 1]) return "DOWN";
    } else if (strat === "coin") {
      // one flip every 5 candles, so the number of signals is similar to the other strategies
      if (Math.floor(cs[i].t / MIN) % 5 === 0) return coin(cs[i].t) ? "UP" : "DOWN";
    }
    return null;
  }
  // what each strategy says right now (state, not only the crossing moment)
  function votesAt(ind, i) {
    const { c, rsi: r, e9, e21, bb } = ind;
    return {
      rsi: r[i] == null ? null : r[i] < 30 ? "UP" : r[i] > 70 ? "DOWN" : null,
      bb: bb.lo[i] == null ? null : c[i] < bb.lo[i] ? "UP" : c[i] > bb.up[i] ? "DOWN" : null,
      ema: e21[i] == null ? null : e9[i] > e21[i] ? "UP" : "DOWN",
    };
  }
  // indicator: one of the strategies fires AND at least 2 of the 3 point the same way
  function comboAt(ind, cs, i) {
    if (i < 25) return null;
    const v = votesAt(ind, i);
    for (const k of PARTS) {
      const dir = signalAt(k, ind, cs, i); if (!dir) continue;
      if (PARTS.filter((p) => v[p] === dir).length >= 2) return dir;
    }
    return null;
  }
  const signalOf = (strat, ind, cs, i) => strat === "combo" ? comboAt(ind, cs, i) : signalAt(strat, ind, cs, i);

  function outcome(dir, entry, exit) {
    if (exit === entry) return "EMPATE";
    return (dir === "UP") === (exit > entry) ? "GANHOU" : "PERDEU";
  }

  // ---------- stats ----------
  function stats(trades, payoutPct, stakeV) {
    const w = trades.filter((t) => t.res === "GANHOU").length;
    const l = trades.filter((t) => t.res === "PERDEU").length;
    const r = trades.filter((t) => t.res === "EMPATE").length;
    const n = w + l; const p = payoutPct / 100;
    const wr = n ? w / n : null; const be = 1 / (1 + p);
    let ci = null;
    if (n) { const z = 1.96, ph = w / n, d = 1 + z * z / n, c = (ph + z * z / (2 * n)) / d, h = (z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))) / d; ci = [Math.max(0, c - h), Math.min(1, c + h)]; }
    return { w, l, r, n, wr, be, ci, net: stakeV * (w * p - l) };
  }
  const pct = (x) => x == null ? "—" : (x * 100).toFixed(1).replace(".", ",") + "%";
  const money = (x) => (x < 0 ? "-" : "") + cur + " " + Math.abs(x).toFixed(2).replace(".", cur === "R$" ? "," : ".");
  const decimals = (price) => price < 10 ? 5 : price < 1000 ? 3 : 2;
  const fmt = (x) => x == null ? "—" : x.toFixed(decimals(x));
  let tz = LS.get("tz", "local");   // "local" or hours from UTC, to match the broker's clock
  const clockStr = (t, sec) => tz === "local"
    ? new Date(t).toLocaleTimeString("pt-BR", sec ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : { hour: "2-digit", minute: "2-digit" })
    : new Date(t + (+tz) * 3600000).toISOString().slice(11, sec ? 19 : 16);
  const hhmm = (t) => clockStr(t, false);

  // ---------- data ----------
  const parseK = (k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] });
  async function fetchKlines(sym, total, interval) {
    let out = [], end = null;
    while (out.length < total) {
      const lim = Math.min(1000, total - out.length);
      const url = `${REST}?symbol=${sym}&interval=${interval || "1m"}&limit=${lim}` + (end ? `&endTime=${end}` : "");
      const res = await fetch(url); if (!res.ok) throw new Error("HTTP " + res.status);
      const arr = (await res.json()).map(parseK);
      if (!arr.length) break;
      out = arr.concat(out); end = arr[0].t - 1;
      if (arr.length < lim) break;
    }
    return out;
  }

  let binStatus = "";
  function setStatus(txt, on) { binStatus = `<span class="dot ${on ? "on" : ""}"></span>${txt}`; $("status").innerHTML = `<span class="dot ${on ? "on" : ""}"></span>${txt}`; if ($("livebadge")) $("livebadge").style.opacity = on ? 1 : .35; }

  async function loadAsset() {
    const sym = asset().sym; const token = ++wsToken;
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    clearInterval(pollTimer);
    candles = []; draw(); renderPanel();
    setStatus("carregando " + asset().name + "…", false);
    try {
      const res = RES(), cs = await fetchKlines(sym, res === 1 ? Math.min(3000, Math.max(600, tf * 120)) : Math.min(5000, Math.max(300, tf / 60 * 120)), res === 1 ? "1s" : "1m");
      candlesRes = res;
      prefetch();
      if (token !== wsToken) return;
      const nowT = now();
      candles = cs.map((c) => ({ ...c, closed: c.t + candlesRes * 1000 <= nowT }));
      const closed = candles.filter((c) => c.closed);
      lastEvalBy[sym] = closed.length ? closed[closed.length - 1].t : 0; // never signal on old candles
      resolveOpen();
      connectWS(sym, token);
    } catch (e) {
      setStatus("sem conexão com os dados (" + e.message + "). Tentando de novo…", false);
      setTimeout(() => token === wsToken && loadAsset(), 5000);
    }
    draw(); renderPanel();
  }

  // apply one kline (from WebSocket or REST polling)
  function applyKline(c) {
    const last = candles[candles.length - 1];
    let closedNow = false;
    if (last && last.t === c.t) { closedNow = c.closed && !last.closed; candles[candles.length - 1] = c; }
    else if (!last || c.t > last.t) {
      if (last && !last.closed) { last.closed = true; closedNow = true; }
      candles.push(c); if (candles.length > (candlesRes === 1 ? 3600 : Math.min(5000, Math.max(400, tf / 60 * 130)))) candles.shift();
      if (c.closed) closedNow = true;
    } else {
      const i = candles.findIndex((x) => x.t === c.t);
      if (i >= 0) { if (c.closed && !candles[i].closed) closedNow = true; candles[i] = c; }
    }
    return closedNow;
  }

  let pollTimer = null, wsFails = 0;
  function connectWS(sym, token) {
    if (wsFails >= 2) return startPolling(sym, token); // WebSocket blocked on this network
    const l = sym.toLowerCase();
    const s = new WebSocket(`wss://data-stream.binance.vision/stream?streams=${l}@kline_${candlesRes === 1 ? "1s" : "1m"}/${l}@aggTrade`); ws = s; let opened = false;
    s.onopen = () => { opened = true; wsFails = 0; reconnectDelay = 1000; setStatus(asset().name + " · ao vivo · " + tfLabel(tf), true); };
    let pending = false;
    const paint = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; draw(); renderPanel(); }); };
    s.onmessage = (ev) => {
      if (token !== wsToken) return;
      const d = JSON.parse(ev.data).data; if (!d) return;
      let closed = false;
      if (d.e === "kline") { const k = d.k; closed = applyKline({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, closed: k.x }); }
      else if (d.e === "aggTrade") {
        // every trade moves the current candle right away (the kline stream only updates every ~2 s)
        const rm = candlesRes * 1000, p = +d.p, t = Math.floor(d.T / rm) * rm, last = candles[candles.length - 1];
        if (last && t === last.t) { last.c = p; last.h = Math.max(last.h, p); last.l = Math.min(last.l, p); }
        else if (last && t > last.t) closed = applyKline({ t, o: p, h: p, l: p, c: p, closed: false });
      }
      if (closed) onClose();
      paint();
    };
    s.onclose = () => {
      if (token !== wsToken) return;
      if (!opened) wsFails++;
      setStatus("reconectando…", false);
      // reload over REST so no closed candle is missed
      setTimeout(() => token === wsToken && loadAsset(), opened ? reconnectDelay : 300);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };
  }
  function startPolling(sym, token) {
    clearInterval(pollTimer);
    setStatus(asset().name + " · ao vivo · " + tfLabel(tf) + " (atualiza a cada 1 s)", true);
    const tick = async () => {
      if (token !== wsToken) return clearInterval(pollTimer);
      try {
        const r = await fetch(`${REST}?symbol=${sym}&interval=${candlesRes === 1 ? "1s" : "1m"}&limit=3`); if (!r.ok) throw 0;
        const nowT = now(); let closed = false;
        for (const k of (await r.json()).map(parseK)) if (applyKline({ ...k, closed: k.t + candlesRes * 1000 <= nowT })) closed = true;
        if (token !== wsToken) return;
        if (closed) onClose();
        setStatus(asset().name + " · ao vivo · " + tfLabel(tf) + " (atualiza a cada 1 s)", true);
        draw(); renderPanel();
      } catch { setStatus("sem resposta dos dados, tentando…", false); }
    };
    pollTimer = setInterval(tick, 1000); tick();
  }

  // ---------- broker price feed (OTC and markets without free real data) ----------
  // The extension reads the price shown on the broker's screen and builds 1-minute candles from it.
  const brokerMode = () => !!(feedMode && lastDetect && lastDetect.raw);
  const noMarket = () => !!(compact && lastDetect && !lastDetect.raw);     // e.g. the broker's "Mercado" or account page
  // the market being followed now: a Binance symbol, or the broker's own name for OTC
  const mk = () => brokerMode() ? lastDetect.raw : asset().sym;
  const curName = () => brokerMode() ? lastDetect.raw : asset().name;
  const curPayout = () => brokerMode() && lastDetect.payout >= 10 ? Math.round(lastDetect.payout) : payoutOf(asset().sym);
  const rawC = () => brokerMode() ? (tf < 60 ? feed.sec : feed.candles) : candles;
  const rawRes = () => brokerMode() ? RES() : candlesRes;
  const srcC = () => group(rawC(), tf, rawRes());                      // candles of the chart timeframe
  const feedLive = () => brokerMode() && feed.key === lastDetect.raw && feed.found && now() - feed.lastAt < 15000;
  const lastPrice = () => { const r = rawC(); return r.length ? r[r.length - 1].c : null; };
  let feed = { key: null, candles: [], sec: [], found: false, lastAt: 0 };
  const FEED = "feed3_";   // v3: older versions could save a wrong number (payout) as the price
  function loadFeed(key) {
    const saved = LS.get(FEED + key, []), savedS = LS.get(FEED + "s_" + key, []);
    const fresh = saved.length && now() - saved[saved.length - 1].t < 5 * MIN;   // gaps break the candles
    const freshS = savedS.length && now() - savedS[savedS.length - 1].t < 30000;
    feed = { key, candles: fresh ? saved : [], sec: freshS ? savedS : [], found: false, lastAt: 0, savedAt: 0 };
    const cl = feed.candles.filter((c) => c.closed); lastEvalBy[key] = cl.length ? cl[cl.length - 1].t : 0;
  }
  // history from the broker (when it opens an asset): candles [t, a, b, c, d] or ticks [t, price]
  function onBrokerHistory(ticks, candles) {
    if (!brokerMode()) return;
    if (feed.key !== lastDetect.raw) loadFeed(lastDetect.raw);
    const nowT = now(), m1 = new Map(), s1 = new Map();
    const put = (map, len, t, o, h, l, c) => {
      const k = Math.floor(t / len) * len, x = map.get(k);
      if (!x) map.set(k, { t: k, o, h, l, c });
      else { x.h = Math.max(x.h, h); x.l = Math.min(x.l, l); x.c = c; }
    };
    if (candles.length) {
      // the order of the 4 prices varies by broker: use the one where high/low really are the extremes
      const ok = (a) => candles.filter((x) => { const [o, h, l, c] = a.map((i) => +x[i]); return h >= Math.max(o, c) && l <= Math.min(o, c); }).length;
      const orders = [[1, 3, 4, 2], [1, 2, 3, 4]];          // [t, open, close, high, low] or [t, open, high, low, close]
      const named = candles.some((x) => x[5] === "named");
      const ord = named ? orders[0] : orders.sort((a, b) => ok(b) - ok(a))[0];
      for (const x of candles) { const t = +x[0] * (x[0] < 1e12 ? 1000 : 1); const [o, h, l, c] = ord.map((i) => +x[i]); if (t < nowT) put(m1, MIN, t, o, h, l, c); }
    } else {
      for (const [t0, p0] of ticks) { const t = +t0 * (t0 < 1e12 ? 1000 : 1), p = +p0; if (!(p > 0) || t > nowT) continue; put(m1, MIN, t, p, p, p, p); if (nowT - t < 3600000) put(s1, 1000, t, p, p, p, p); }
    }
    const hist = [...m1.values()].sort((a, b) => a.t - b.t);
    if (hist.length < 2) return;
    const live = feed.candles.length ? feed.candles[feed.candles.length - 1].c : hist[hist.length - 1].c;
    if (Math.abs(hist[hist.length - 1].c / live - 1) > 0.05) return;     // not the same series
    const lastHist = hist[hist.length - 1].t;
    feed.candles = hist.map((c) => ({ ...c, closed: c.t + MIN <= nowT })).concat(feed.candles.filter((c) => c.t > lastHist)).slice(-1500);
    if (s1.size) { const sh = [...s1.values()].sort((a, b) => a.t - b.t), ls = sh[sh.length - 1].t;
      feed.sec = sh.map((c) => ({ ...c, closed: c.t + 1000 <= nowT })).concat(feed.sec.filter((c) => c.t > ls)).slice(-3600); }
    feed.found = true; feed.lastAt = Math.max(feed.lastAt, nowT - 1000);
    LS.set(FEED + feed.key, feed.candles);
    anaData.key = null;                                                   // the scanner uses the new history
    draw(); renderPanel();
  }
  function onBrokerPrice(p) {
    if (!brokerMode() || !(p > 0)) return;
    if (Number.isInteger(p) || (lastDetect.payout && Math.round(p) === Math.round(lastDetect.payout))) return;   // "91", "93.000": payout or counter
    if (feed.key !== lastDetect.raw) loadFeed(lastDetect.raw);
    feed.found = true; feed.lastAt = now();
    let last = feed.candles[feed.candles.length - 1];
    if (last && Math.abs(p / last.c - 1) > 0.05) { feed.candles = []; feed.sec = []; last = null; }   // a different number than before: start again
    // 1-second series
    const ts = Math.floor(now() / 1000) * 1000, ls = feed.sec[feed.sec.length - 1];
    if (ls && ls.t === ts) { ls.c = p; ls.h = Math.max(ls.h, p); ls.l = Math.min(ls.l, p); }
    else {
      if (ls) ls.closed = true;
      if (ls && ts - ls.t > 30000) feed.sec = [];
      feed.sec.push({ t: ts, o: p, h: p, l: p, c: p, closed: false });
      if (feed.sec.length > 3600) feed.sec.shift();
      if (now() - feed.savedAt > 10000) { feed.savedAt = now(); LS.set(FEED + "s_" + feed.key, feed.sec); }
    }
    const t = Math.floor(now() / MIN) * MIN;
    if (last && last.t === t) { last.c = p; last.h = Math.max(last.h, p); last.l = Math.min(last.l, p); }
    else {
      if (last) { last.closed = true; if (t - last.t > 5 * MIN) feed.candles = []; }
      feed.candles.push({ t, o: p, h: p, l: p, c: p, closed: false });
      if (feed.candles.length > 1500) feed.candles.shift();
      LS.set(FEED + feed.key, feed.candles);
      if (last && last.closed && feed.candles.length > 1) onClose();   // a candle of the broker price just closed
    }    draw();
  }

  // ---------- "Sinalizar próxima vela" (button + candle scanner) ----------
  // Looks for every past moment when RSI, Bollinger and EMA were in the same state as now
  // and counts what the price did over the chosen expiration. No guess: just what happened before.
  function wilson(k, n) {
    if (!n) return null; const z = 1.96, ph = k / n, d = 1 + z * z / n, c = (ph + z * z / (2 * n)) / d;
    const h = (z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))) / d; return [Math.max(0, c - h), Math.min(1, c + h)];
  }
  const patKey = (v) => `${v.rsi || "-"}|${v.bb || "-"}|${v.ema || "-"}`;
  function learnPatterns(cs, ind, n, from, to) {
    const full = new Map(), ema = new Map();
    for (let i = Math.max(25, from); i < to && i + n < cs.length; i++) {
      const v = votesAt(ind, i), d = cs[i + n].c - cs[i].c; if (!d) continue;
      for (const [m, k] of [[full, patKey(v)], [ema, v.ema || "-"]]) { const o = m.get(k) || { up: 0, dn: 0 }; if (d > 0) o.up++; else o.dn++; m.set(k, o); }
    }
    return { full, ema };
  }
  function predict(model, v) {
    let o = model.full.get(patKey(v)), level = "mesmo RSI, Bollinger e EMA";
    if (!o || o.up + o.dn < 20) { o = model.ema.get(v.ema || "-"); level = "mesma EMA (o padrão completo é raro)"; }
    if (!o || o.up + o.dn === 0) return null;
    const n = o.up + o.dn, dir = o.up >= o.dn ? "UP" : "DOWN", hits = Math.max(o.up, o.dn);
    return { dir, n, rate: hits / n, ci: wilson(hits, n), level };
  }
  let anaData = { key: null, at: 0, cs: [], ind: null, models: {} };
  const NATIVE = { 1: "1s", 60: "1m", 180: "3m", 300: "5m", 900: "15m", 1800: "30m", 3600: "1h", 7200: "2h", 14400: "4h" };
  let anaLoading = null;
  async function ensureAnaData() {
    const key = mk() + "|" + tf;
    if (brokerMode()) {
      if (anaData.key === key && now() - anaData.at < 30000) return;
      const cs = srcC().filter((c) => c.closed);
      anaData = { key, at: now(), cs, ind: indicators(cs), models: {} };
    } else if (anaData.key !== key || now() - anaData.at > 15 * MIN) {
      if (anaLoading && anaLoading.key === key) return anaLoading.p;
      const p = (async () => {
        const sym = asset().sym, nowT = now();
        const raw = NATIVE[tf] ? await fetchKlines(sym, 5000, NATIVE[tf])
          : tf < 60 ? group(await fetchKlines(sym, 5000, "1s"), tf, 1) : group(await fetchKlines(sym, 5000), tf, 60);
        const cs = raw.filter((c) => c.t + TF() <= nowT);
        if (mk() + "|" + tf === key) anaData = { key, at: now(), cs, ind: indicators(cs), models: {} };
      })();
      anaLoading = { key, p }; try { await p; } finally { if (anaLoading && anaLoading.key === key) anaLoading = null; }
    }
  }
  const prefetch = () => { ensureAnaData().catch(() => {}); };   // so the click answers right away
  const expSecNow = () => (lastDetect && lastDetect.expirySec > 0 ? lastDetect.expirySec : expiry() * 60);
  const expCandles = () => Math.max(1, Math.round(expSecNow() / tf));
  const modelFor = (n) => anaData.models[n] || (anaData.models[n] = learnPatterns(anaData.cs, anaData.ind, n, 0, anaData.cs.length));

  // ---------- candlestick patterns ("estudos de candles") ----------
  // Looks at the last closed candles. Each pattern says its direction and how many candles it uses.
  function candlePatterns(cs, i) {
    if (i < 6) return [];
    const C = (k) => cs[i - k], c = C(0), p = C(1), q = C(2);
    const body = (x) => Math.abs(x.c - x.o), rng = (x) => Math.max(x.h - x.l, 1e-12);
    const up = (x) => x.c > x.o, dn = (x) => x.c < x.o;
    const upper = (x) => x.h - Math.max(x.o, x.c), lower = (x) => Math.min(x.o, x.c) - x.l;
    let avg = 0; for (let k = 1; k <= 6; k++) avg += body(C(k)); avg = avg / 6 || 1e-12;
    const fall = cs[i - 1].c < cs[i - 6].c, rise = cs[i - 1].c > cs[i - 6].c;   // what the market did before
    const out = [], add = (name, dir, len, w) => out.push({ name, dir, len, w });
    // 3 candles
    if (dn(q) && body(q) > avg && body(p) < body(q) * 0.4 && up(c) && c.c > (q.o + q.c) / 2) add("Estrela da manhã", "UP", 3, 3);
    if (up(q) && body(q) > avg && body(p) < body(q) * 0.4 && dn(c) && c.c < (q.o + q.c) / 2) add("Estrela da noite", "DOWN", 3, 3);
    if (up(q) && up(p) && up(c) && p.c > q.c && c.c > p.c && body(c) > avg * 0.6 && body(p) > avg * 0.6) add("Três soldados", "UP", 3, 2.5);
    if (dn(q) && dn(p) && dn(c) && p.c < q.c && c.c < p.c && body(c) > avg * 0.6 && body(p) > avg * 0.6) add("Três corvos", "DOWN", 3, 2.5);
    // 2 candles
    if (dn(p) && up(c) && c.o <= p.c && c.c >= p.o && body(c) > body(p)) add("Engolfo de alta", "UP", 2, 2.5);
    if (up(p) && dn(c) && c.o >= p.c && c.c <= p.o && body(c) > body(p)) add("Engolfo de baixa", "DOWN", 2, 2.5);
    if (dn(p) && body(p) > avg && up(c) && c.o > p.c && c.c < p.o && body(c) < body(p) * 0.6) add("Harami de alta", "UP", 2, 1.5);
    if (up(p) && body(p) > avg && dn(c) && c.o < p.c && c.c > p.o && body(c) < body(p) * 0.6) add("Harami de baixa", "DOWN", 2, 1.5);
    if (fall && dn(p) && up(c) && Math.abs(c.l - p.l) <= rng(c) * 0.1) add("Pinça de fundo", "UP", 2, 2);
    if (rise && up(p) && dn(c) && Math.abs(c.h - p.h) <= rng(c) * 0.1) add("Pinça de topo", "DOWN", 2, 2);
    // 1 candle
    const smallBody = body(c) <= rng(c) * 0.35;
    if (fall && smallBody && lower(c) >= body(c) * 2 && upper(c) <= rng(c) * 0.15) add("Martelo", "UP", 1, 2);
    if (rise && smallBody && upper(c) >= body(c) * 2 && lower(c) <= rng(c) * 0.15) add("Estrela cadente", "DOWN", 1, 2);
    if (fall && smallBody && upper(c) >= body(c) * 2 && lower(c) <= rng(c) * 0.15) add("Martelo invertido", "UP", 1, 1.5);
    if (rise && smallBody && lower(c) >= body(c) * 2 && upper(c) <= rng(c) * 0.15) add("Enforcado", "DOWN", 1, 1.5);
    if (body(c) <= rng(c) * 0.1 && rng(c) > 0) { if (rise) add("Doji no topo", "DOWN", 1, 1); else if (fall) add("Doji no fundo", "UP", 1, 1); }
    if (body(c) >= rng(c) * 0.9 && body(c) > avg * 1.3) add(up(c) ? "Marubozu de alta" : "Marubozu de baixa", up(c) ? "UP" : "DOWN", 1, 1.5);
    return out;
  }
  // the strongest reading: the side with more weight wins, and its heaviest pattern names it
  function bestPattern(cs, i) {
    const ps = candlePatterns(cs, i); if (!ps.length) return null;
    const w = { UP: 0, DOWN: 0 }; ps.forEach((x) => (w[x.dir] += x.w));
    if (w.UP === w.DOWN) return null;
    const dir = w.UP > w.DOWN ? "UP" : "DOWN";
    return ps.filter((x) => x.dir === dir).sort((a, b) => b.w - a.w)[0];
  }
  // how each pattern did in this market's history, for the expiration in candles n
  function learnCandles(cs, n) {
    const m = new Map();
    for (let i = 6; i + n < cs.length; i++) {
      const b = bestPattern(cs, i); if (!b) continue;
      const d = cs[i + n].c - cs[i].c; if (!d) continue;
      const o = m.get(b.name) || { ok: 0, n: 0 }; o.n++; if ((d > 0) === (b.dir === "UP")) o.ok++; m.set(b.name, o);
    }
    return m;
  }
  const candleModelFor = (n) => anaData.models["c" + n] || (anaData.models["c" + n] = learnCandles(anaData.cs, n));
  // momentum of the last candles, used only when there is no clear pattern and no history
  function lastMove(cs, i) { const k = Math.max(0, i - 5); return cs[i].c >= cs[k].c ? "UP" : "DOWN"; }

  let ana = null;        // the scan in progress: { key, tf, scanStart, err, done }
  let lastScan = null;   // the chart keeps the selection for the trade the scan opened
  const SCAN_MS = 1200, SEL = 20;     // scanner animation; candles the analysis looks at (RSI 14 / Bollinger 20)
  const scanning = () => !!(ana && now() - ana.scanStart < SCAN_MS);
  async function startAnalysis() {
    ana = { key: mk(), tf, scanStart: now(), err: null, done: false };
    renderPanel();
    const anim = () => { draw(); if (ana && !ana.done) requestAnimationFrame(anim); };
    requestAnimationFrame(anim);
    try { await ensureAnaData(); } catch (e) { if (ana) ana.err = "não deu para baixar o histórico (" + e.message + ")"; }
    if (!ana) return;
    setTimeout(finishAnalysis, Math.max(0, SCAN_MS - (now() - ana.scanStart)));
  }
  // after the scan: read the candles (the one forming now included) and point the NEXT candle
  function predictNow() {
    const cs = srcC();
    if (cs.length < 7) return { err: `juntando velas ${tfLabel(tf)} (${cs.length}/7)` };
    const i = cs.length - 1, hist = anaData.cs.length >= 60;
    const b = bestPattern(cs, i);
    if (b) {
      const o = hist ? candleModelFor(1).get(b.name) : null;
      return { dir: b.dir, kind: "candle", name: b.name, len: b.len, t0: cs[i - b.len + 1].t, t1: cs[i].t, n: o ? o.n : 0, rate: o && o.n ? o.ok / o.n : null };
    }
    if (hist && cs.length >= 30) {
      const pr = predict(modelFor(1), votesAt(indicators(cs), i));
      if (pr) return { dir: pr.dir, kind: "state", name: "sem padrão de vela · " + pr.level, len: 0, n: pr.n, rate: pr.rate };
    }
    return { dir: lastMove(cs, i), kind: "move", name: "sem padrão claro · direção das últimas velas", len: Math.min(5, i), t0: cs[Math.max(0, i - 5)].t, t1: cs[i].t, n: 0, rate: null };
  }
  function finishAnalysis() {
    if (!ana) return;
    if (ana.key !== mk() || ana.tf !== tf) { startAnalysis(); return; }      // market or timeframe changed meanwhile
    const nx = Math.ceil(now() / TF()) * TF();
    ana.entryT = nx - now() < 2500 ? nx + TF() : nx;                         // the next candle to open
    ana.phase = "wait"; ana.done = true;
    refreshPrediction(); renderPanel(); draw();
  }
  function refreshPrediction() { const r = predictNow(); if (r.err) { ana.err = r.err; ana.pred = null; } else { ana.err = null; ana.pred = r; } }
  // until 2 s before the next candle opens the reading follows the live price; then it locks; at the open the trade starts
  function tickAnalysis() {
    if (!ana || ana.phase !== "wait") return;
    if (ana.key !== mk() || ana.tf !== tf) { startAnalysis(); return; }
    const left = ana.entryT - now();
    if (left > 2000) refreshPrediction(); else ana.locked = true;
    if (left > 0) return;
    if (!ana.pred) { ana = null; say("Sem velas suficientes: clique de novo."); return; }
    const pred = ana.pred, p = lastPrice(), t0 = ana.entryT;
    history.unshift({
      id: t0 + "scan", sym: mk(), name: curName(), strat: "scan", dir: pred.dir, n: Math.max(1, Math.round(tf / 60)), expSec: tf, tf, next: true,
      shadow: false, src: brokerMode() ? "corretora" : "binance", mode: "now",
      payout: curPayout(), stake: stake(), cur, entry: p, sigT: t0, entryAt: t0, endAt: t0 + TF(),
      res: null, exit: null, rate: pred.rate, seen: pred.n, level: pred.name, kind: pred.kind, nC: 1,
    });
    history = history.slice(0, 800); LS.set("history", history); renderHistory();
    lastScan = { key: mk(), tf, id: t0 + "scan", pred };
    ana = null; beep();
  }
  // trades opened "now" end after the expiration, at the price of that moment
  function resolveNow() {
    let changed = false;
    for (const h of history) {
      if (h.res || h.mode !== "now" || h.sym !== mk() || now() < h.endAt) continue;
      const p = lastPrice(); if (p == null) continue;
      h.exit = p; h.res = outcome(h.dir, h.entry, h.exit); changed = true;
      say(h.res === "GANHOU" ? "Ganhou." : h.res === "PERDEU" ? "Perdeu." : "Empate.");
    }
    if (changed) { LS.set("history", history); renderHistory(); }
  }

  // ---------- live signals ----------
  const openTrade = () => history.find((h) => !h.res && !h.shadow && h.sym === mk());
  const tr0 = () => openTrade();

  // trades left open on another asset are resolved over REST once they expire
  let resolvingOther = false;
  async function resolveOtherAssets() {
    if (resolvingOther) return; resolvingOther = true;
    try {
      for (const h of history) {
        if (h.res || h.sym === mk() || now() < h.endAt + 3000) continue;
        if (h.mode === "now") {
          if (ASSETS.some((x) => x.sym === h.sym)) {
            const r = await fetch(`${REST}?symbol=${h.sym}&interval=1s&startTime=${Math.floor(h.endAt / 1000) * 1000}&limit=1`);
            const k = r.ok ? (await r.json()).map(parseK)[0] : null;
            if (k) { h.exit = k.o; h.res = outcome(h.dir, h.entry, h.exit); } else h.res = "SEM DADO";
          } else {
            const c = (LS.get(FEED + h.sym, []) || []).find((x) => x.t <= h.endAt && h.endAt < x.t + MIN);
            if (c) { h.exit = c.c; h.res = outcome(h.dir, h.entry, h.exit); } else if (now() > h.endAt + 10 * MIN) h.res = "SEM DADO"; else continue;
          }
          LS.set("history", history); renderHistory(); continue;
        }
        if (!ASSETS.some((x) => x.sym === h.sym)) {
          // broker-price market: resolve from the candles saved while the panel watched it
          const c = (LS.get(FEED + h.sym, []) || []).find((x) => x.t === h.expT && x.closed);
          if (c) { h.exit = c.c; h.res = outcome(h.dir, h.entry, h.exit); }
          else if (now() > h.endAt + 10 * MIN) h.res = "SEM DADO";
          else continue;
          LS.set("history", history); renderHistory(); continue;
        }
        const r = await fetch(`${REST}?symbol=${h.sym}&interval=1m&startTime=${h.expT}&limit=1`);
        if (!r.ok) continue;
        const k = (await r.json()).map(parseK)[0];
        if (k && k.t === h.expT) { h.exit = k.c; h.res = outcome(h.dir, h.entry, h.exit); }
        else h.res = "SEM DADO";
        LS.set("history", history); renderHistory();
      }
    } catch {} finally { resolvingOther = false; }
  }

  function addTrade(closed, i, strat, dir, shadow, extra) {
    const n = expiry();
    history.unshift({
      id: closed[i].t + strat, sym: mk(), name: curName(), strat, dir, n, shadow, src: brokerMode() ? "corretora" : "binance",
      payout: curPayout(), stake: stake(), cur, entry: closed[i].c, sigT: closed[i].t,
      expT: closed[i].t + n * MIN, // exit = close of this candle
      endAt: closed[i].t + (n + 1) * MIN, res: null, exit: null, ...(extra || {}),
    });
  }

  function onClose() {
    resolveOpen();
    const closed = srcC().filter((c) => c.closed);
    const i = closed.length - 1; if (i < 0) return;
    // the "next candle" analysis locks its direction when the candle it was about opens
    if (closed[i].t <= (lastEvalBy[mk()] || 0)) return;
    lastEvalBy[mk()] = closed[i].t;
  }

  function resolveOpen() {
    let changed = false;
    for (const h of history) {
      if (h.res || h.mode === "now") continue;
      if (h.sym !== mk()) continue; // other assets: resolveOtherAssets()
      const src = srcC(), c = src.find((x) => x.t === h.expT && x.closed);
      if (c) {
        h.exit = c.c; h.res = outcome(h.dir, h.entry, h.exit); changed = true;
        if (!h.shadow) say(h.res === "GANHOU" ? "Ganhou. Lembre: um acerto não prova nada, olhe a taxa." : h.res === "PERDEU" ? "Perdeu. Faz parte, e eu conto todas." : "Empate: o preço fechou igual à entrada.");
      } else if (src.length && src[0].t > h.expT) { h.res = "SEM DADO"; changed = true; }
    }
    if (changed) { LS.set("history", history); renderHistory(); }
  }

  // ---------- UI ----------
  function say(t) { const b = $("bubble"); if (b) b.textContent = t; }
  let actx = null;
  function beep() { try { actx = actx || new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = .05; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + .15); } catch {} }

  function renderPanel() {
    const a = asset(); $("assetName").textContent = curName();
    $("clock").textContent = clockStr(now(), true);
    const tr = openTrade();
    const dirEl = $("dir");
    resolveNow();
    const ai = $("anaInfo"), ab = $("anaBtn");
    const fmtS = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
    const expTxt = () => { const e = expSecNow(); return e < 60 ? e + " s" : Math.round(e / 60) + " min"; };
    const blocked = noMarket() ? "Abra um gráfico na corretora" : brokerMode() && !feedLive() ? "Sem preço lido da tela" : null;
    tickAnalysis();
    const waiting = ana && ana.phase === "wait";
    if (ab) { ab.textContent = waiting ? "✕ Cancelar" : ana ? "ESCANEANDO…" : blocked || "🔍 Sinalizar próxima vela"; ab.disabled = (!!ana && !waiting) || (!ana && !!blocked); }
    if (noMarket() && !tr) {
      $("assetName").textContent = "Nenhum gráfico aberto"; $("tradeTitle").textContent = "Esperando a corretora";
      dirEl.className = "dir WAIT"; dirEl.textContent = "SEM SINAL"; $("timer").textContent = "--:--"; $("bar").style.width = "0";
      $("mPayout").textContent = "Payout —"; $("mEntry").textContent = "Preço —"; $("mExp").textContent = "—";
      if (ai) ai.style.display = "none";
      return;
    }
    if (ai) ai.style.display = ana || (tr && (tr.strat === "scan" || tr.strat === "click")) ? "" : "none";
    const be = 1 / (1 + curPayout() / 100);
    if (waiting) {
      const left = ana.entryT - now(), p = ana.pred;
      $("tradeTitle").textContent = `PRÓXIMA VELA ${tfLabel(tf)} · entra às ${clockStr(ana.entryT, true)}`;
      if (p) { dirEl.className = "dir " + p.dir; dirEl.textContent = p.dir === "UP" ? "▲ COMPRA" : "▼ VENDA"; }
      else { dirEl.className = "dir WAIT"; dirEl.textContent = "ANALISANDO…"; }
      $("timer").textContent = fmtS(left); $("bar").style.width = Math.min(100, 100 * (1 - left / Math.max(1, ana.entryT - ana.scanStart))) + "%";
      $("mPayout").textContent = `Payout ${curPayout()}%`; $("mExp").textContent = `1 vela ${tfLabel(tf)}`;
      const lp = lastPrice(); $("mEntry").textContent = lp ? `Preço ${fmt(lp)}` : "Preço —";
      const head = !p ? esc(ana.err || "") : p.kind === "candle" ? `Padrão: <b>${esc(p.name)}</b>` : esc(p.name);
      const stat = p && p.n ? ` · no histórico, a vela seguinte foi ${p.dir === "UP" ? "de alta" : "de baixa"} em <b>${pct(p.rate)}</b> de ${p.n} vezes · empate ${pct(be)}` : p ? " · ainda sem histórico para medir o acerto" : "";
      ai.innerHTML = head + stat + `<div class="m">${ana.locked ? "🔒 travado: entre na abertura da vela" : "acompanha o preço até 2 s antes da vela abrir"}</div>`;
    } else if (ana) {
      $("tradeTitle").textContent = `Escaneando ${curName()} · ${tfLabel(tf)}`;
      dirEl.className = "dir WAIT"; dirEl.textContent = ana.done ? "SEM SINAL" : "ESCANEANDO…";
      $("timer").textContent = "…"; $("bar").style.width = Math.min(100, 100 * (now() - ana.scanStart) / SCAN_MS) + "%";
      $("mPayout").textContent = `Payout ${curPayout()}%`; $("mExp").textContent = expTxt();
      const lp = lastPrice(); $("mEntry").textContent = lp ? `Preço ${fmt(lp)}` : "Preço —";
      ai.innerHTML = ana.done ? esc(ana.err || "") : `lendo as velas ${tfLabel(tf)}: engolfo, martelo, estrela, doji, harami, pinça…`;
      if (ana.done && now() - ana.scanStart > 5000) ana = null;
    } else if (tr && tr.mode === "now") {
      $("tradeTitle").textContent = tr.next ? `Vela em andamento · fecha às ${clockStr(tr.endAt, true)}` : `ENTRE AGORA · fecha às ${clockStr(tr.endAt, true)}`;
      dirEl.className = "dir " + tr.dir; dirEl.textContent = tr.dir === "UP" ? "▲ COMPRA" : "▼ VENDA";
      $("timer").textContent = fmtS(tr.endAt - now());
      $("bar").style.width = (100 * Math.min(1, (now() - tr.entryAt) / (tr.endAt - tr.entryAt))).toFixed(1) + "%";
      $("mPayout").textContent = `Payout ${tr.payout}%`;
      $("mEntry").textContent = `Entrada ${fmt(tr.entry)}`;
      $("mExp").textContent = tr.expSec < 60 ? tr.expSec + " s" : Math.round(tr.expSec / 60) + " min";
      const ci = tr.seen ? wilson(Math.round(tr.rate * tr.seen), tr.seen) : [0, 1];
      const tag = !tr.seen ? "" : ci[0] > be ? '<b class="g">acima do empate</b>' : tr.rate < be ? '<b class="r">abaixo do empate: não compensa</b>' : '<b class="w">fraco: pode ser sorte</b>';
      const tfl = tfLabel(tr.tf > 1 ? tr.tf : 60), head = tr.kind === "candle" ? `Padrão: <b>${esc(tr.level)}</b>` : esc(tr.level);
      ai.innerHTML = tr.seen ? `${head} · no histórico deste ativo acertou <b>${pct(tr.rate)}</b> em ${tr.seen} vezes (${tr.nC} vela(s) ${tfl}) · empate ${pct(be)} · ${tag}`
        : `${head} · ainda sem histórico para medir o acerto · empate ${pct(be)}`;
    } else if (tr) {
      $("tradeTitle").textContent = "Trade aberto";
      dirEl.className = "dir " + tr.dir; dirEl.textContent = tr.dir === "UP" ? "▲ UP" : "▼ DOWN";
      const left = Math.max(0, tr.endAt - now()), tot = tr.n * MIN;
      const s = Math.ceil(left / 1000);
      $("timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      $("bar").style.width = (100 * (1 - left / tot)).toFixed(1) + "%";
      $("mPayout").textContent = `Payout ${tr.payout}%`;
      $("mEntry").textContent = `Entrada ${fmt(tr.entry)}`;
      $("mExp").textContent = `${tr.n} min`;
    } else {
      $("tradeTitle").textContent = paused ? "Sinais pausados" : "Clique em Sinalizar";
      if (paused) { dirEl.className = "dir PAUSE"; dirEl.textContent = "PAUSADO"; }
      else { dirEl.className = "dir WAIT"; dirEl.textContent = "SEM SINAL"; }
      const last = candles[candles.length - 1];
      const nx = Math.ceil(now() / TF()) * TF(), left = nx - now();
      $("timer").textContent = fmtS(left); $("bar").style.width = (100 * (1 - left / TF())) + "%";
      $("mPayout").textContent = `Payout ${payoutOf(a.sym)}%`;
      $("mEntry").textContent = last ? `Preço ${fmt(last.c)}` : "Preço —";
      $("mExp").textContent = expTxt();
      if (brokerMode()) {
        // show the market open on the broker even when there is no real data to signal on
        $("assetName").textContent = lastDetect.raw;
        $("mPayout").textContent = lastDetect.payout ? `Payout ${lastDetect.payout}%` : "Payout —";
        $("mEntry").textContent = "procurando o preço…";
      }
    }
    // session stats: all resolved signals, each with the payout it had
    if (brokerMode() && feed.candles.length && !openTrade()) $("mEntry").textContent = "Preço " + fmt(feed.candles[feed.candles.length - 1].c);
    const done = history.filter((h) => !h.shadow && h.res && h.res !== "SEM DADO");
    const avgPayout = done.length ? done.reduce((s, h) => s + h.payout, 0) / done.length : payoutOf(a.sym);
    const st = stats(done, avgPayout, stake());
    st.net = done.reduce((s, h) => { const v = h.stake || stake(); return s + (h.res === "GANHOU" ? v * h.payout / 100 : h.res === "PERDEU" ? -v : 0); }, 0);
    $("sW").textContent = st.w; $("sL").textContent = st.l; $("sR").textContent = st.r;
    $("sWR").textContent = pct(st.wr); $("sWR").className = st.wr == null ? "" : st.wr > st.be ? "g" : "r";
    $("sBE").textContent = pct(st.be);
    $("sStakeLbl").textContent = "valor da entrada";
    $("sNet").textContent = money(st.net); $("sNet").className = st.net > 0 ? "g" : st.net < 0 ? "r" : "";
    $("sCI").textContent = st.ci ? `${pct(st.ci[0])} a ${pct(st.ci[1])}` + (st.n < 30 ? " (poucos sinais)" : "") : "—";
  }

  function renderHistory() {
    if (compact) {
      const box = $("histList"); if (!box) return;
      const main = history.filter((h) => !h.shadow);
      box.innerHTML = main.length ? main.slice(0, 50).map((h) => {
        const cls = h.res === "GANHOU" ? "g" : h.res === "PERDEU" ? "r" : "m";
        return `<div class="hrow"><div><b>${hhmm(h.mode === "now" ? h.entryAt : h.sigT + MIN)}</b> <span class="${h.dir === "UP" ? "g" : "r"}">${h.dir === "UP" ? "▲ UP" : "▼ DOWN"}</span> ${esc(h.name.split(" ")[0])}
          <small>${fmt(h.entry)} → ${fmt(h.exit)} · ${h.expSec && h.expSec < 60 ? h.expSec + " s" : h.n + " min"} · ${h.stake ? esc((h.cur || "$") + " " + h.stake) : ""} · ${h.payout}%</small></div><b class="${cls}">${h.res || "aberto"}</b></div>`;
      }).join("") : '<div class="m">Nenhum sinal ainda.</div>';
      return;
    }
    const tb = $("hist");
    const main = history.filter((h) => !h.shadow);
    if (!main.length) { tb.innerHTML = '<tr><td colspan="10" class="m">Nenhum sinal ainda.</td></tr>'; return; }
    tb.innerHTML = main.slice(0, 100).map((h) => {
      const cls = h.res === "GANHOU" ? "g" : h.res === "PERDEU" ? "r" : "m";
      return `<tr><td>${hhmm(h.mode === "now" ? h.entryAt : h.sigT + MIN)}</td><td>${h.name}</td><td>${STRAT_NAMES[h.strat]}</td>
        <td class="${h.dir === "UP" ? "g" : "r"}">${h.dir === "UP" ? "▲ UP" : "▼ DOWN"}</td>
        <td>${fmt(h.entry)}</td><td>${fmt(h.exit)}</td><td>${h.n} min</td><td>${h.stake ? (h.cur || "$") + " " + h.stake : "—"}</td><td>${h.payout}%</td><td class="${cls}"><b>${h.res || "aberto"}</b></td></tr>`;
    }).join("");
  }

  // ---------- chart ----------
  const cv = $("chart");
  function draw() {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#131c31"; g.fillRect(0, 0, W, H);
    const bm = brokerMode(), src = srcC();
    $("status").innerHTML = noMarket() ? '<span class="dot"></span>nenhum gráfico aberto na corretora'
      : bm ? `<span class="dot ${feedLive() ? "on" : ""}"></span>${esc(lastDetect.raw)} · ${tfLabel(tf)} · preço lido da corretora` : binStatus;
    if (noMarket()) {
      g.fillStyle = "#8a97b3"; g.font = "13px system-ui"; g.textAlign = "center";
      g.fillText("Abra o gráfico de um ativo na corretora", W / 2, H / 2 - 6);
      g.font = "11px system-ui"; g.fillText("o painel troca sozinho para ele", W / 2, H / 2 + 12);
      g.textAlign = "left"; return;
    }
    if (bm && (!feedLive() || src.length < 1)) {
      g.fillStyle = "#8a97b3"; g.font = "13px system-ui"; g.textAlign = "center";
      const ok = feedLive();
      g.fillText(ok ? `Montando o gráfico de ${lastDetect.raw}…` : `Procurando o preço de ${lastDetect.raw} na tela…`, W / 2, H / 2 - 6);
      g.font = "11px system-ui";
      if (ok) g.fillText(`as velas ${tfLabel(tf)} vão aparecendo`, W / 2, H / 2 + 12);
      else { g.fillText("recarregue a corretora (F5) e clique no robô;", W / 2, H / 2 + 12); g.fillText("se continuar, veja o diagnóstico em Ajustes", W / 2, H / 2 + 27); }
      g.textAlign = "left"; return;
    }
    if (!src.length) return;
    const N = Math.max(20, Math.min(80, Math.floor(W / 9)));
    const cs = src.slice(-N);
    const padR = 70, padT = 30, padB = 24, cw = (W - padR) / N;
    let hi = -Infinity, lo = Infinity; cs.forEach((c) => { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
    const tr = openTrade(); if (tr && tr.sym === mk()) { hi = Math.max(hi, tr.entry); lo = Math.min(lo, tr.entry); }
    if (hi === lo) { hi += hi * 1e-4; lo -= lo * 1e-4; }
    const y = (p) => padT + (hi - p) / (hi - lo) * (H - padT - padB);
    // grid
    g.strokeStyle = "#1f2a44"; g.lineWidth = 1; g.fillStyle = "#8a97b3"; g.font = "11px system-ui";
    const lastC = src[src.length - 1].c;
    for (let k = 0; k <= 4; k++) { const p = lo + (hi - lo) * k / 4, yy = y(p); g.beginPath(); g.moveTo(0, yy); g.lineTo(W - padR, yy); g.stroke(); if (Math.abs(yy - y(lastC)) > 14) g.fillText(fmt(p), W - padR + 6, yy + 4); }
    cs.forEach((c, k) => { if (k % 10 === 0) g.fillText(tf < 60 ? clockStr(c.t, true) : hhmm(c.t), k * cw, H - 6); });
    // src
    cs.forEach((c, k) => {
      const x = k * cw + cw / 2, up = c.c >= c.o; g.strokeStyle = g.fillStyle = up ? "#22c55e" : "#ef4444";
      g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke();
      const bh = Math.max(1, Math.abs(y(c.o) - y(c.c))); g.fillRect(x - cw * .35, Math.min(y(c.o), y(c.c)), cw * .7, bh);
    });
    // scanner: a line sweeps the candles, then the candles used by the analysis stay selected
    const scanTr = lastScan && lastScan.key === mk() && lastScan.tf === tf && history.find((h) => h.id === lastScan.id && !h.res);
    const view = ana && ana.key === mk() ? { scanStart: ana.scanStart, pred: ana.pred || null } : scanTr ? { scanStart: 0, pred: lastScan.pred } : null;
    if (view) {
      const el = now() - view.scanStart, plotW = W - padR, sel = Math.min(SEL, cs.length);
      g.save();
      if (el < SCAN_MS) {
        const x = (el / SCAN_MS) * plotW;
        g.fillStyle = "rgba(56,189,248,.08)"; g.fillRect(0, 0, x, H - padB);
        cs.forEach((c, k) => {
          const cx = k * cw + cw / 2; if (cx > x) return;
          g.strokeStyle = "rgba(56,189,248,.75)"; g.lineWidth = 1; g.strokeRect(cx - cw * .45, y(c.h) - 2, cw * .9, y(c.l) - y(c.h) + 4);
        });
        g.strokeStyle = "#38bdf8"; g.lineWidth = 2; g.shadowColor = "#38bdf8"; g.shadowBlur = 10;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H - padB); g.stroke(); g.shadowBlur = 0;
        const done = cs.filter((_, k) => k * cw + cw / 2 <= x).length;
        g.fillStyle = "#38bdf8"; g.font = "bold 11px system-ui"; g.fillText(`ESCANEANDO VELAS ${done}/${cs.length}`, 8, 40);
      } else {
        const pv = view.pred;
        let k0 = cs.length - sel, k1 = cs.length;
        if (pv && pv.t0 != null) { const a = cs.findIndex((c) => c.t === pv.t0), b = cs.findIndex((c) => c.t === pv.t1); if (a >= 0 && b >= a) { k0 = a; k1 = b + 1; } }
        const part = cs.slice(k0, k1);
        let sh = -Infinity, sl = Infinity; part.forEach((c) => { sh = Math.max(sh, c.h); sl = Math.min(sl, c.l); });
        const x0 = k0 * cw, x1 = k1 * cw, y0 = y(sh) - 6, y1 = y(sl) + 6;
        g.fillStyle = "rgba(56,189,248,.10)"; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.setLineDash([5, 3]); g.strokeStyle = "#38bdf8"; g.lineWidth = 1.5; g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.setLineDash([]);
        g.fillStyle = "#38bdf8"; g.font = "bold 10px system-ui"; g.fillText(pv && pv.kind === "candle" ? pv.name.toUpperCase() : pv && pv.kind === "move" ? "ÚLTIMAS VELAS" : `${sel} VELAS SELECIONADAS`, Math.max(2, Math.min(x0, W - padR - 150)), Math.max(38, y0 - 4));
        const p = view.pred;
        if (p) {
          const txt = (p.dir === "UP" ? "▲ COMPRA" : "▼ VENDA") + (p.rate != null ? " " + pct(p.rate) : "");
          g.font = "bold 12px system-ui"; const tw = g.measureText(txt).width + 12, bx = Math.max(2, Math.min(x0, W - padR - tw - 2)), by = Math.min(H - padB - 22, y1 + 4);
          g.fillStyle = p.dir === "UP" ? "#16a34a" : "#dc2626"; g.fillRect(bx, by, tw, 20);
          g.fillStyle = "#fff"; g.fillText(txt, bx + 6, by + 14);
        }
      }
      g.restore();
    }
    // signal markers from history on visible src
    history.forEach((h) => {
      if (h.shadow || h.sym !== mk()) return; const k = cs.findIndex((c) => c.t <= h.sigT && h.sigT < c.t + TF()); if (k < 0) return;
      const x = k * cw + cw / 2; g.fillStyle = h.dir === "UP" ? "#22c55e" : "#ef4444"; g.font = "bold 12px system-ui";
      g.fillText(h.dir === "UP" ? "▲" : "▼", x - 5, h.dir === "UP" ? y(cs[k].l) + 14 : y(cs[k].h) - 4);
    });
    // open trade line
    if (tr && tr.sym === mk()) {
      const yy = y(tr.entry); g.setLineDash([5, 4]); g.strokeStyle = tr.dir === "UP" ? "#22c55e" : "#ef4444";
      g.beginPath(); g.moveTo(0, yy); g.lineTo(W - padR, yy); g.stroke(); g.setLineDash([]);
      g.fillStyle = g.strokeStyle; g.fillRect(W - padR, yy - 9, padR, 18); g.fillStyle = "#000"; g.fillText((tr.dir === "UP" ? "▲ " : "▼ ") + fmt(tr.entry), W - padR + 3, yy + 4);
    }
    // current price
    const last = src[src.length - 1], yy = y(last.c);
    g.fillStyle = "#38bdf8"; g.fillRect(W - padR, yy - 9, padR, 18); g.fillStyle = "#001018"; g.font = "bold 11px system-ui"; g.fillText(fmt(last.c), W - padR + 4, yy + 4);
  }

  // ---------- backtest ----------
  async function runBacktest() {
    const a = asset(), n = expiry(), pay = curPayout(), size = +$("btSize").value;
    $("btRun").disabled = true; $("btInfo").textContent = brokerMode() ? "Testando nas velas lidas da corretora…" : `Baixando ${size.toLocaleString("pt-BR")} velas de ${a.name}…`;
    try {
      const nowT = now();
      let cs;
      if (brokerMode()) {
        cs = feed.candles.filter((c) => c.closed);
        if (cs.length < 60) throw new Error(`só ${cs.length} velas lidas da corretora em ${lastDetect.raw}. Deixe o painel aberto nesse ativo por mais tempo (mínimo 60).`);
      } else cs = (await fetchKlines(a.sym, size)).filter((c) => c.t + MIN <= nowT);
      const ind = indicators(cs);
      const run = (strat) => {
        const trades = [];
        for (let i = 25; i + n < cs.length; i++) {
          const dir = signalOf(strat, ind, cs, i); if (!dir) continue;
          trades.push({ dir, res: outcome(dir, cs[i].c, cs[i + n].c) });
          i += n - 1; // one trade at a time, same as live
        }
        return { strat, trades, st: stats(trades, pay, stake()) };
      };
      const all = ["combo", ...PARTS, "coin"].map(run);
      // the "next candle" button, tested honestly: learn the patterns on the first half, test on the second half only
      const mid = Math.floor(cs.length / 2), model = learnPatterns(cs, ind, n, 0, mid), clickTrades = [];
      for (let i = Math.max(mid, 25); i + n < cs.length; i += n) {
        const pr = predict(model, votesAt(ind, i)); if (!pr) continue;
        clickTrades.push({ dir: pr.dir, res: outcome(pr.dir, cs[i].c, cs[i + n].c) });
      }
      all.unshift({ strat: "click", trades: clickTrades, st: stats(clickTrades, pay, stake()) });
      const candleTrades = [];
      for (let i = 6; i + n < cs.length; i++) { const b = bestPattern(cs, i); if (!b) continue; candleTrades.push({ dir: b.dir, res: outcome(b.dir, cs[i].c, cs[i + n].c) }); i += n - 1; }
      all.unshift({ strat: "candle", trades: candleTrades, st: stats(candleTrades, pay, stake()) });
      const verdictOf = (st) => st.n < 30 ? '<span class="m">❔ poucos</span>' : st.ci[0] > st.be ? '<span class="g">✅ lucro</span>'
        : st.ci[1] < st.be ? '<span class="r">❌ perde</span>' : '<span class="w">⚠️ incerto</span>';
      $("btOut").style.display = "";
      $("btRows").innerHTML = all.map(({ strat, st }) => `<tr class="${strat === "candle" || strat === "combo" ? "main" : ""}"><td>${STRAT_NAMES[strat]}${strat === "coin" ? " <small>(controle)</small>" : strat === "click" ? " <small>(2ª metade)</small>" : ""}</td>
        <td>${st.n + st.r}</td><td class="${st.wr == null ? "" : st.wr > st.be ? "g" : "r"}">${pct(st.wr)}${st.ci ? `<small class="ci">${pct(st.ci[0])}–${pct(st.ci[1])}</small>` : ""}</td>
        <td class="${st.net >= 0 ? "g" : "r"}">${money(st.net)}</td><td>${verdictOf(st)}</td></tr>`).join("");
      const combo = all[2], st = combo.st, clickSt = all[1].st, candleSt = all[0].st;
      $("btBE").textContent = `Payout ${pay}% → precisa acertar ${pct(st.be)} para empatar. Valor ${money(stake())} por entrada.`;
      const eq = [0];
      combo.trades.forEach((t) => eq.push(eq[eq.length - 1] + (t.res === "GANHOU" ? stake() * pay / 100 : t.res === "PERDEU" ? -stake() : 0)));
      const v = $("bVerdict");
      const lucky = all.slice(1, 4).filter((x) => x.st.n >= 30 && x.st.ci[0] > x.st.be).map((x) => STRAT_NAMES[x.strat]);
      if (st.n < 30) { v.className = "verdict meh"; v.innerHTML = `<b>Indicador: poucos sinais (${st.n}) para concluir.</b> Aumente o número de velas.`; }
      else if (st.ci[0] > st.be) { v.className = "verdict ok"; v.innerHTML = `<b>Indicador acima do empate neste período</b> (pior caso ${pct(st.ci[0])} &gt; ${pct(st.be)}). Teste em outros ativos e tamanhos antes de acreditar.`; }
      else if (st.ci[1] < st.be) { v.className = "verdict bad"; v.innerHTML = `<b>Indicador perde dinheiro aqui.</b> Acertou ${pct(st.wr)} e precisava de ${pct(st.be)}.`; }
      else { v.className = "verdict meh"; v.innerHTML = `<b>Indicador sem vantagem comprovada.</b> Acertou ${pct(st.wr)}; o real pode estar entre ${pct(st.ci[0])} e ${pct(st.ci[1])}, e o empate é ${pct(st.be)}. Compare com Cara ou coroa.`; }
      v.innerHTML += `<br><small>Padrões de vela: ${candleSt.n < 30 ? "poucos casos" : `acertaram ${pct(candleSt.wr)} (empate ${pct(candleSt.be)})`}.</small>`;
      v.innerHTML += `<br><small>Leitura RSI/BB/EMA do botão: ${clickSt.n < 30 ? "poucos casos para avaliar" : `acertou ${pct(clickSt.wr)} na metade que ele não tinha visto (empate ${pct(clickSt.be)}): ${clickSt.ci[0] > clickSt.be ? "acima do empate" : clickSt.ci[1] < clickSt.be ? "perde dinheiro" : "sem vantagem comprovada"}`}.</small>`;
      if (lucky.length) v.innerHTML += `<br><small>${lucky.join(", ")} passou do empate neste período. Ao testar várias estratégias, uma costuma ir bem por acaso: confirme em outro período.</small>`;
      $("btInfo").textContent = `${curName()}${brokerMode() ? " (preço lido da corretora)" : ""} · expiração ${n} min · ${cs.length.toLocaleString("pt-BR")} velas (${new Date(cs[0].t).toLocaleDateString("pt-BR")} a ${new Date(cs[cs.length - 1].t).toLocaleDateString("pt-BR")})`;
      lastEq = eq; drawEquity(eq); btDone = mk() + "|" + n;
    } catch (e) { $("btInfo").textContent = (brokerMode() ? "Ainda não dá: " : "Erro ao baixar as velas: ") + e.message; }
    $("btRun").disabled = false;
  }
  let lastEq = null, btDone = null;
  function drawEquity(eq) {
    const c = $("eq"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hi = Math.max(0, ...eq), lo = Math.min(0, ...eq), pad = 18, y = (v) => pad + (hi - v) / ((hi - lo) || 1) * (H - 2 * pad);
    const x = (k) => 50 + k / Math.max(1, eq.length - 1) * (W - 60);
    g.strokeStyle = "#334155"; g.beginPath(); g.moveTo(50, y(0)); g.lineTo(W - 10, y(0)); g.stroke();
    g.fillStyle = "#8a97b3"; g.font = "11px system-ui"; g.fillText(cur + " 0", 2, y(0) + 4); if (y(0) - y(hi) > 14) g.fillText(money(hi), 2, y(hi) + 4); if (y(lo) - y(0) > 14) g.fillText(money(lo), 2, y(lo) + 4);
    g.strokeStyle = eq[eq.length - 1] >= 0 ? "#22c55e" : "#ef4444"; g.lineWidth = 1.6; g.beginPath();
    eq.forEach((v, k) => k ? g.lineTo(x(k), y(v)) : g.moveTo(x(k), y(v))); g.stroke();
  }

  // ---------- events ----------
  function syncPayoutInput() { el.payout.value = payoutOf(asset().sym); }
  el.asset.onchange = () => { LS.set("asset", el.asset.value); syncPayoutInput(); $("btOut").style.display = "none"; loadAsset(); };
  el.expiry.onchange = () => { LS.set("expiry", +el.expiry.value); renderPanel(); };
  el.payout.oninput = () => { const v = Math.min(100, Math.max(1, +el.payout.value || 0)); if (!v) return; payouts[asset().sym] = v; LS.set("payouts", payouts); renderPanel(); };
  $("resetSession").onclick = () => { if (!confirm("Apagar o histórico e as estatísticas desta sessão?")) return; history = []; LS.set("history", history); renderHistory(); renderPanel(); draw(); };
  $("btRun").onclick = runBacktest;
  const btx = document.querySelector(".btexp");
  if (btx) { btx.open = !LS.get("btexpSeen", false); btx.addEventListener("toggle", () => LS.set("btexpSeen", !btx.open)); LS.set("btexpSeen", true); }
  $("anaBtn").onclick = () => { if (ana) { ana = null; renderPanel(); } else startAnalysis(); };
  $("tz").value = String(tz);
  $("tz").onchange = () => { tz = $("tz").value; LS.set("tz", tz); renderHistory(); draw(); renderPanel(); };
  syncClock(); setInterval(syncClock, 10 * MIN);
  window.addEventListener("resize", draw);
  setInterval(() => { renderPanel(); }, 250);
  setInterval(resolveOtherAssets, 5000);

  // ---------- compact panel (extension): 4 tabs that fit the window ----------
  function buildTabs() {
    const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
    const nav = mk("nav", "tabs");
    const tabs = { sinal: "Sinal", hist: "Histórico", bt: "Backtest", cfg: "Ajustes" };
    const pane = {};
    for (const [k, label] of Object.entries(tabs)) {
      const b = mk("button", "", label); b.dataset.tab = k; nav.appendChild(b);
      pane[k] = mk("div", "pane"); pane[k].dataset.tab = k;
    }
    // grab everything first: once moved into a detached pane, getElementById no longer finds it
    const r = {
      brokerLine: $("brokerTxt"), signal: $("dir").closest(".sub"), session: $("sW").closest(".sub"), chart: document.querySelector(".chartwrap"),
      bt: $("btRun").closest(".card"), header: document.querySelector("header"), broker: $("broker"), reset: $("resetSession"), warn: document.querySelector(".warn"),
    };
    r.brokerLine.classList.add("sub", "brokerline");
    r.broker.querySelector("h3").textContent = "Ler da corretora";
    pane.sinal.append(r.brokerLine, r.signal, r.session, r.chart);
    const hl = mk("div", "card"); hl.innerHTML = '<div id="histList" class="hlist"></div>'; pane.hist.append(hl);
    pane.bt.append(r.bt);
    const cfg = mk("div", "card cfg");
    cfg.append(r.header, r.broker, r.reset, r.warn);
    pane.cfg.append(cfg);
    document.body.innerHTML = "";
    document.body.append(nav, ...Object.values(pane));
    const show = (k) => {
      nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === k));
      Object.values(pane).forEach((p) => p.classList.toggle("on", p.dataset.tab === k));
      LS.set("tab", k); draw(); if (k === "bt" && lastEq) drawEquity(lastEq);
      if (k === "bt" && btDone !== mk() + "|" + expiry() && !$("btRun").disabled) runBacktest();   // runs by itself when the tab opens
    };
    nav.onclick = (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.tab); };
    show(LS.get("tab", "sinal"));
    new ResizeObserver(() => draw()).observe(document.querySelector(".chartwrap"));
    renderHistory();
  }

  // ---------- extension bridge ----------
  // Inside the extension the page runs in an iframe; content.js reads the asset and payout
  // shown by the broker and posts them here.
  let lastDetect = null;
  function applyDetect(d) {
    paused = null; feedMode = false;
    const follow = true;   // market, payout and amount always come from the broker
    const amt = Number.isFinite(d && d.amount) && d.amount > 0 ? d.amount : null;
    if (follow && d && d.currency && d.currency !== cur) { cur = d.currency; LS.set("cur", cur); }
    if (follow && amt && +el.stake.value !== amt) { el.stake.value = amt; LS.set("stake", amt); }
    if (!d || !d.raw) {
      $("brokerTxt").innerHTML = "Nenhum mercado encontrado na página." + "<div class=\"m\">Em <b>Ajustes</b>, use <b>Apontar mercado</b>.</div>";
      renderPanel(); return;
    }
    const sym = typeof d.sym === "string" && ASSETS.some((x) => x.sym === d.sym) ? d.sym : null;
    const pay = Number.isFinite(d.payout) && d.payout >= 10 && d.payout <= 100 ? Math.round(d.payout) : null;
    let html = `<b>${esc(d.raw)}</b>` + (pay ? ` · <b>${pay}%</b>` : " · payout ?");
    if (follow) {
      if (d.otc || !sym) feedMode = true;
      else {
        if (pay && payouts[sym] !== pay) { payouts[sym] = pay; LS.set("payouts", payouts); }
        if (el.asset.value !== sym) { el.asset.value = sym; el.asset.onchange(); } else syncPayoutInput();
        prefetch();
        html += ` → <b>${esc(asset().name)}</b>`;
      }
    }
    if (feedMode) html += `<div class="w">${d.otc ? "OTC" : "Sem dado grátis"}: sinais e gráfico pelo preço lido na tela da corretora.</div>`;
    // expiration and time zone, also from the broker
    let expTxt = "não encontrada (usando " + expiry() + " min)";
    if (Number.isFinite(d.expirySec) && d.expirySec > 0) {
      const n = Math.max(1, Math.round(d.expirySec / 60)); setExpiry(n);
      expTxt = d.expirySec < 60 ? `${d.expirySec} s` : `${n} min`;
    }
    // chart timeframe of the broker
    const newTf = Number.isFinite(d.tfSec) && d.tfSec >= 1 ? Math.round(d.tfSec) : 60;
    if (newTf !== tf) { const resChanged = (newTf < 60) !== (tf < 60); tf = newTf; if (!brokerMode() && (resChanged || tf > 60)) loadAsset(); draw(); prefetch(); }
    if (feedMode && feed.key !== d.raw) loadFeed(d.raw);
    const newTz = Number.isFinite(d.tz) ? String(d.tz) : "local";
    if (newTz !== tz) { tz = newTz; LS.set("tz", tz); renderHistory(); }
    const pay2 = Number.isFinite(d.payout) && d.payout >= 10 && d.payout <= 100 ? Math.round(d.payout) + "%" : "não encontrado";
    const tzTxt = tz === "local" ? "do computador" : "UTC" + (+tz >= 0 ? "+" : "") + tz;
    if ($("autoInfo")) $("autoInfo").innerHTML = `<div>Mercado: <b>${esc(d.raw || "não encontrado")}</b></div><div>Expiração: <b>${esc(expTxt)}</b></div>
      <div>Payout: <b>${pay2}</b></div><div>Valor: <b>${amt ? esc(money(amt)) : "não encontrado"}</b></div><div>Tempo gráfico: <b>${Number.isFinite(d.tfSec) && d.tfSec > 0 ? tfLabel(Math.round(d.tfSec)) : "não encontrado (M1)"}</b></div><div>Horário: <b>${tzTxt}</b> · agora ${clockStr(now(), true)}</div>
      <div>Cotações da página: <b>${d.hook ? (d.hook.msgs ? `${d.hook.msgs} mensagens (${esc(Object.entries(d.hook.from).map(([k, v]) => k + " " + v).join(", "))})` : "nenhuma mensagem vista") : "leitor não ativo (recarregue a página e clique no robô)"}</b></div>
      ${d.hook && d.hook.msgs ? `<div class="m" style="font-size:11px">ativos vistos: ${esc(d.hook.names.join(", ") || "nenhum com preço")} · procurando: ${esc(d.hook.key || "?")} ${d.hook.got ? "✅" : "❌"}</div>` : ""}
      <div>Preço na tela: <b id="autoPrice">${feed.found ? fmt(feed.candles[feed.candles.length - 1].c) + " (lido da tela)" : "—"}</b></div>`;
    const t = d.taught || {};
    if (t.asset || t.payout || t.amount || t.expiry || t.price || t.tf) html += `<div class="m" style="font-size:11px">pontos marcados: ${[t.asset && "mercado", t.payout && "payout", t.amount && "valor", t.expiry && "expiração", t.price && "preço", t.tf && "tempo gráfico"].filter(Boolean).join(", ")}</div>`;
    $("brokerTxt").innerHTML = html;
    renderPanel();
  }
  if (compact) {
    document.body.classList.add("compact");
    buildTabs();
    $("broker").style.display = "";
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent) return;
      const d = e.data; if (!d) return;
      if (d.type === "sh-history") { onBrokerHistory(Array.isArray(d.ticks) ? d.ticks : [], Array.isArray(d.candles) ? d.candles : []); return; }
      if (d.type === "sh-price") { onBrokerPrice(+d.p); if ($("autoPrice")) $("autoPrice").textContent = +d.p > 0 ? fmt(+d.p) + " (lido da tela)" : "não encontrado"; return; }
      if (d.type !== "sh-detect") return;
      lastDetect = {
        raw: typeof d.raw === "string" ? d.raw.slice(0, 40) : null, sym: d.sym, otc: !!d.otc, payout: +d.payout, amount: +d.amount,
        currency: ["R$", "$", "US$", "€", "£"].includes(d.currency) ? d.currency : null,
        expirySec: +d.expirySec, tfSec: +d.tfSec, tz: d.tz == null ? null : +d.tz,
        hook: d.hook && typeof d.hook === "object" ? { msgs: +d.hook.msgs || 0, from: d.hook.from && typeof d.hook.from === "object" ? Object.fromEntries(Object.entries(d.hook.from).slice(0, 5).map(([k, v]) => [String(k).slice(0, 12), +v || 0])) : {}, names: Array.isArray(d.hook.names) ? d.hook.names.slice(0, 8).map((x) => String(x).slice(0, 30)) : [], key: typeof d.hook.key === "string" ? d.hook.key.slice(0, 30) : null, got: !!d.hook.got } : null, taught: d.taught && typeof d.taught === "object" ? d.taught : {},
      };
      applyDetect(lastDetect);
    });
    document.querySelectorAll("[data-pick]").forEach((b) => {
      b.onclick = () => { window.parent.postMessage({ type: "sh-pick", field: b.dataset.pick }, "*"); $("brokerTxt").innerHTML = "Agora clique na corretora, no lugar certo. <b>Esc</b> cancela."; };
    });
    window.parent.postMessage({ type: "sh-ready" }, "*");
  }

  syncPayoutInput(); renderHistory(); loadAsset();
})();
