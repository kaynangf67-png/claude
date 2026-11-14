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
  // clock synced with the exchange (a PC clock a few seconds off makes the countdown wrong)
  let clockOff = 0;
  const now = () => Date.now() + clockOff;
  async function syncClock() {
    try {
      const t0 = Date.now(); const r = await fetch("https://data-api.binance.vision/api/v3/time"); const t1 = Date.now();
      const { serverTime } = await r.json(); if (serverTime) clockOff = serverTime - (t0 + t1) / 2;
    } catch {}
  }
  const STRAT_NAMES = { combo: "Indicador", rsi: "RSI 14", bb: "Bollinger 20", ema: "EMA 9×21", coin: "Cara ou coroa" };
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
  let lastEvaluatedT = 0;
  let paused = null;        // reason why new signals are paused (extension: broker on OTC / unsupported asset)

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
  async function fetchKlines(sym, total) {
    let out = [], end = null;
    while (out.length < total) {
      const lim = Math.min(1000, total - out.length);
      const url = `${REST}?symbol=${sym}&interval=1m&limit=${lim}` + (end ? `&endTime=${end}` : "");
      const res = await fetch(url); if (!res.ok) throw new Error("HTTP " + res.status);
      const arr = (await res.json()).map(parseK);
      if (!arr.length) break;
      out = arr.concat(out); end = arr[0].t - 1;
      if (arr.length < lim) break;
    }
    return out;
  }

  function setStatus(txt, on) { $("status").innerHTML = `<span class="dot ${on ? "on" : ""}"></span>${txt}`; if ($("livebadge")) $("livebadge").style.opacity = on ? 1 : .35; }

  async function loadAsset() {
    const sym = asset().sym; const token = ++wsToken;
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    clearInterval(pollTimer);
    candles = []; lastEvaluatedT = 0; draw(); renderPanel();
    setStatus("carregando " + asset().name + "…", false);
    try {
      const cs = await fetchKlines(sym, 300);
      if (token !== wsToken) return;
      const nowT = now();
      candles = cs.map((c) => ({ ...c, closed: c.t + MIN <= nowT }));
      const closed = candles.filter((c) => c.closed);
      lastEvaluatedT = closed.length ? closed[closed.length - 1].t : 0; // never signal on old candles
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
      candles.push(c); if (candles.length > 400) candles.shift();
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
    const s = new WebSocket(`wss://data-stream.binance.vision/stream?streams=${l}@kline_1m/${l}@aggTrade`); ws = s; let opened = false;
    s.onopen = () => { opened = true; wsFails = 0; reconnectDelay = 1000; setStatus(asset().name + " · ao vivo · M1", true); };
    let pending = false;
    const paint = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; draw(); renderPanel(); }); };
    s.onmessage = (ev) => {
      if (token !== wsToken) return;
      const d = JSON.parse(ev.data).data; if (!d) return;
      let closed = false;
      if (d.e === "kline") { const k = d.k; closed = applyKline({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, closed: k.x }); }
      else if (d.e === "aggTrade") {
        // every trade moves the current candle right away (the kline stream only updates every ~2 s)
        const p = +d.p, t = Math.floor(d.T / MIN) * MIN, last = candles[candles.length - 1];
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
    setStatus(asset().name + " · ao vivo · M1 (atualiza a cada 1 s)", true);
    const tick = async () => {
      if (token !== wsToken) return clearInterval(pollTimer);
      try {
        const r = await fetch(`${REST}?symbol=${sym}&interval=1m&limit=2`); if (!r.ok) throw 0;
        const nowT = now(); let closed = false;
        for (const k of (await r.json()).map(parseK)) if (applyKline({ ...k, closed: k.t + MIN <= nowT })) closed = true;
        if (token !== wsToken) return;
        if (closed) onClose();
        setStatus(asset().name + " · ao vivo · M1 (atualiza a cada 1 s)", true);
        draw(); renderPanel();
      } catch { setStatus("sem resposta dos dados, tentando…", false); }
    };
    pollTimer = setInterval(tick, 1000); tick();
  }

  // ---------- broker price feed (OTC and markets without free real data) ----------
  // The extension reads the price shown on the broker's screen and builds 1-minute candles from it.
  const brokerMode = () => !!(paused && lastDetect && lastDetect.raw);
  let feed = { key: null, candles: [], found: false, lastAt: 0 };
  function loadFeed(key) {
    const saved = LS.get("feed_" + key, []);
    const fresh = saved.length && now() - saved[saved.length - 1].t < 5 * MIN;   // gaps break the candles
    feed = { key, candles: fresh ? saved : [], found: false, lastAt: 0 };
  }
  function onBrokerPrice(p) {
    if (!brokerMode() || !(p > 0)) return;
    if (feed.key !== lastDetect.raw) loadFeed(lastDetect.raw);
    feed.found = true; feed.lastAt = now();
    const t = Math.floor(now() / MIN) * MIN, last = feed.candles[feed.candles.length - 1];
    if (last && last.t === t) { last.c = p; last.h = Math.max(last.h, p); last.l = Math.min(last.l, p); }
    else {
      if (last) { last.closed = true; if (t - last.t > 5 * MIN) feed.candles = []; }
      feed.candles.push({ t, o: p, h: p, l: p, c: p, closed: false });
      if (feed.candles.length > 300) feed.candles.shift();
      LS.set("feed_" + feed.key, feed.candles);
    }    draw();
  }

  // trend of the last 15 closed candles: efficiency ratio (how straight the move was) + EMA 9 vs 21
  const TREND_N = 15;
  function trendOf(cs) {
    const c = cs.filter((x) => x.closed).map((x) => x.c);
    if (c.length < TREND_N + 1) return { need: TREND_N + 1 - c.length };
    const i = c.length - 1, move = c[i] - c[i - TREND_N];
    let path = 0; for (let k = i - TREND_N + 1; k <= i; k++) path += Math.abs(c[k] - c[k - 1]);
    const er = path ? Math.abs(move) / path : 0;
    const e9 = ema(c, 9)[i], e21 = c.length >= 21 ? ema(c, 21)[i] : null;
    const emaDir = e21 == null ? Math.sign(move) : Math.sign(e9 - e21);
    if (er < 0.25 || Math.sign(move) !== emaDir) return { kind: "LATERAL", er };
    return { kind: move > 0 ? "ALTA" : "BAIXA", er };
  }
  function renderTrend() {
    const el2 = $("trend"); if (!el2) return;
    const tr = trendOf(brokerMode() ? feed.candles : candles);
    if (tr.need) { el2.className = "trend m"; el2.textContent = `Tendência: juntando velas (faltam ${tr.need})`; return; }
    const force = tr.er >= 0.5 ? "forte" : tr.er >= 0.35 ? "moderada" : "fraca";
    el2.className = "trend " + (tr.kind === "ALTA" ? "up" : tr.kind === "BAIXA" ? "down" : "side");
    el2.innerHTML = tr.kind === "LATERAL" ? "↔ <b>LATERALIZADO</b> <small>sem direção clara</small>"
      : `${tr.kind === "ALTA" ? "▲" : "▼"} <b>TENDÊNCIA DE ${tr.kind}</b> <small>${force} · ${Math.round(tr.er * 100)}%</small>`;
  }

  // ---------- live signals ----------
  const openTrade = () => history.find((h) => !h.res && !h.shadow && h.sym === asset().sym);
  const tr0 = () => openTrade();

  // trades left open on another asset are resolved over REST once they expire
  let resolvingOther = false;
  async function resolveOtherAssets() {
    if (resolvingOther) return; resolvingOther = true;
    try {
      for (const h of history) {
        if (h.res || h.sym === asset().sym || now() < h.endAt + 3000) continue;
        const r = await fetch(`${REST}?symbol=${h.sym}&interval=1m&startTime=${h.expT}&limit=1`);
        if (!r.ok) continue;
        const k = (await r.json()).map(parseK)[0];
        if (k && k.t === h.expT) { h.exit = k.c; h.res = outcome(h.dir, h.entry, h.exit); }
        else h.res = "SEM DADO";
        LS.set("history", history); renderHistory();
      }
    } catch {} finally { resolvingOther = false; }
  }

  function onClose() {
    resolveOpen();
    const closed = candles.filter((c) => c.closed);
    const i = closed.length - 1; if (i < 0) return;
    if (closed[i].t <= lastEvaluatedT) return;
    lastEvaluatedT = closed[i].t;
    if (paused) return;
    const ind = indicators(closed), n = expiry();
    const add = (strat, dir, shadow) => history.unshift({
      id: closed[i].t + strat, sym: asset().sym, name: asset().name, strat, dir, n, shadow,
      payout: payoutOf(asset().sym), stake: stake(), cur, entry: closed[i].c, sigT: closed[i].t,
      expT: closed[i].t + n * MIN, // exit = close of this candle
      endAt: closed[i].t + (n + 1) * MIN, res: null, exit: null,
    });
    // each strategy is also followed on its own, so the panel shows which one is really working
    for (const k of PARTS) {
      if (history.some((h) => h.shadow && !h.res && h.strat === k && h.sym === asset().sym)) continue;
      const d = signalAt(k, ind, closed, i); if (d) add(k, d, true);
    }
    const dir = openTrade() ? null : comboAt(ind, closed, i);
    if (dir) add("combo", dir, false);
    history = history.slice(0, 800); LS.set("history", history); renderHistory();
    if (!dir) return;
    say(dir === "UP" ? "Sinal de ALTA. Confira o preço na sua corretora antes de entrar." : "Sinal de BAIXA. Confira o preço na sua corretora antes de entrar.");
    beep();
  }

  function resolveOpen() {
    let changed = false;
    for (const h of history) {
      if (h.res) continue;
      if (h.sym !== asset().sym) continue; // other assets: resolveOtherAssets()
      const c = candles.find((x) => x.t === h.expT && x.closed);
      if (c) {
        h.exit = c.c; h.res = outcome(h.dir, h.entry, h.exit); changed = true;
        if (!h.shadow) say(h.res === "GANHOU" ? "Ganhou. Lembre: um acerto não prova nada, olhe a taxa." : h.res === "PERDEU" ? "Perdeu. Faz parte, e eu conto todas." : "Empate: o preço fechou igual à entrada.");
      } else if (candles.length && candles[0].t > h.expT) { h.res = "SEM DADO"; changed = true; }
    }
    if (changed) { LS.set("history", history); renderHistory(); }
  }

  // ---------- UI ----------
  function say(t) { $("bubble").textContent = t; }
  let actx = null;
  function beep() { try { actx = actx || new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.value = .05; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + .15); } catch {} }

  function renderPanel() {
    const a = asset(); $("assetName").textContent = a.name;
    $("clock").textContent = clockStr(now(), true);
    $("mStake").textContent = "Valor " + money(tr0() ? tr0().stake || stake() : stake()).replace(/^-/, "");
    const tr = openTrade();
    const dirEl = $("dir");
    if (tr) {
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
      $("tradeTitle").textContent = paused ? "Sinais pausados" : "Aguardando o indicador";
      if (paused) { dirEl.className = "dir PAUSE"; dirEl.textContent = "PAUSADO"; }
      else { dirEl.className = "dir WAIT"; dirEl.textContent = "SEM SINAL"; }
      const last = candles[candles.length - 1];
      const nx = Math.ceil(now() / MIN) * MIN, s = Math.max(0, Math.ceil((nx - now()) / 1000));
      $("timer").textContent = `0:${String(s % 60).padStart(2, "0")}`; $("bar").style.width = (100 * (1 - s / 60)) + "%";
      $("mPayout").textContent = `Payout ${payoutOf(a.sym)}%`;
      $("mEntry").textContent = last ? `Preço ${fmt(last.c)}` : "Preço —";
      $("mExp").textContent = `${expiry()} min`;
      if (paused && lastDetect && lastDetect.raw) {
        // show the market open on the broker even when there is no real data to signal on
        $("assetName").textContent = lastDetect.raw;
        $("mPayout").textContent = lastDetect.payout ? `Payout ${lastDetect.payout}%` : "Payout —";
        $("mEntry").textContent = "sem preço real";
      }
    }
    // session stats: all resolved signals, each with the payout it had
    renderIndicator(); renderTrend();
    if (brokerMode() && feed.candles.length) $("mEntry").textContent = "Preço " + fmt(feed.candles[feed.candles.length - 1].c);
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

  // live votes of each strategy + how each one is doing in this session
  function renderIndicator() {
    const box = $("indRows"); if (!box) return;
    const sub = box.closest(".sub"); if (sub) sub.style.display = paused ? "none" : "";   // OTC: give the space to the chart
    const cs = candles.filter((c) => c.closed);
    if (cs.length < 30 || paused) { box.innerHTML = `<div class="m">${paused ? "sinais pausados em " + esc(lastDetect && lastDetect.raw || "este mercado") + " (veja a tendência acima)" : "carregando…"}</div>`; $("indScore").textContent = ""; return; }
    const ind = indicators(cs), i = cs.length - 1, v = votesAt(ind, i);
    const val = { rsi: ind.rsi[i].toFixed(1).replace(".", ","), bb: cs[i].c < ind.bb.lo[i] ? "abaixo" : cs[i].c > ind.bb.up[i] ? "acima" : "dentro", ema: v.ema === "UP" ? "9 > 21" : "9 < 21" };
    const sym = asset().sym;
    box.innerHTML = PARTS.map((k) => {
      const d = history.filter((h) => h.strat === k && h.sym === sym && (h.res === "GANHOU" || h.res === "PERDEU"));
      const w = d.filter((h) => h.res === "GANHOU").length;
      const vt = v[k] === "UP" ? '<b class="g">▲ alta</b>' : v[k] === "DOWN" ? '<b class="r">▼ baixa</b>' : '<b class="m">— neutro</b>';
      return `<div class="irow"><span>${STRAT_NAMES[k]}</span><span class="m">${val[k]}</span>${vt}<span class="m">${d.length ? `${w}/${d.length} acertos` : "sem sinais"}</span></div>`;
    }).join("");
    const up = PARTS.filter((k) => v[k] === "UP").length, dn = PARTS.filter((k) => v[k] === "DOWN").length;
    $("indScore").innerHTML = up >= 2 ? `<b class="g">▲ ${up}/3 alta</b>` : dn >= 2 ? `<b class="r">▼ ${dn}/3 baixa</b>` : `<b class="m">dividido</b>`;
  }

  function renderHistory() {
    if (compact) {
      const box = $("histList"); if (!box) return;
      const main = history.filter((h) => !h.shadow);
      box.innerHTML = main.length ? main.slice(0, 50).map((h) => {
        const cls = h.res === "GANHOU" ? "g" : h.res === "PERDEU" ? "r" : "m";
        return `<div class="hrow"><div><b>${hhmm(h.sigT + MIN)}</b> <span class="${h.dir === "UP" ? "g" : "r"}">${h.dir === "UP" ? "▲ UP" : "▼ DOWN"}</span> ${esc(h.name.split(" ")[0])}
          <small>${fmt(h.entry)} → ${fmt(h.exit)} · ${h.n} min · ${h.stake ? esc((h.cur || "$") + " " + h.stake) : ""} · ${h.payout}%</small></div><b class="${cls}">${h.res || "aberto"}</b></div>`;
      }).join("") : '<div class="m">Nenhum sinal ainda.</div>';
      return;
    }
    const tb = $("hist");
    const main = history.filter((h) => !h.shadow);
    if (!main.length) { tb.innerHTML = '<tr><td colspan="10" class="m">Nenhum sinal ainda.</td></tr>'; return; }
    tb.innerHTML = main.slice(0, 100).map((h) => {
      const cls = h.res === "GANHOU" ? "g" : h.res === "PERDEU" ? "r" : "m";
      return `<tr><td>${hhmm(h.sigT + MIN)}</td><td>${h.name}</td><td>${STRAT_NAMES[h.strat]}</td>
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
    const bm = brokerMode(), src = bm ? feed.candles : candles;
    $("status").innerHTML = bm ? `<span class="dot ${feed.candles.length ? "on" : ""}"></span>${esc(lastDetect.raw)} · preço lido da corretora` : $("status").innerHTML;
    if (bm && feed.candles.length < 2) {
      g.fillStyle = "#8a97b3"; g.font = "13px system-ui"; g.textAlign = "center";
      g.fillText(feed.found ? `Montando o gráfico de ${lastDetect.raw}…` : `Procurando o preço de ${lastDetect.raw} na tela…`, W / 2, H / 2 - 6);
      g.font = "11px system-ui"; g.fillText(feed.found ? "as velas aparecem a cada minuto" : "se não achar: Ajustes → Apontar preço", W / 2, H / 2 + 12);
      g.textAlign = "left"; return;
    }
    if (!src.length) return;
    const N = Math.max(20, Math.min(80, Math.floor(W / 9)));
    const cs = src.slice(-N);
    const ind = indicators(src); const off = src.length - cs.length;
    const padR = 70, padT = 30, padB = 24, cw = (W - padR) / N;
    let hi = -Infinity, lo = Infinity; cs.forEach((c) => { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
    const tr = bm ? null : openTrade(); if (tr && tr.sym === asset().sym) { hi = Math.max(hi, tr.entry); lo = Math.min(lo, tr.entry); }
    if (hi === lo) { hi += hi * 1e-4; lo -= lo * 1e-4; }
    const y = (p) => padT + (hi - p) / (hi - lo) * (H - padT - padB);
    // grid
    g.strokeStyle = "#1f2a44"; g.lineWidth = 1; g.fillStyle = "#8a97b3"; g.font = "11px system-ui";
    const lastC = src[src.length - 1].c;
    for (let k = 0; k <= 4; k++) { const p = lo + (hi - lo) * k / 4, yy = y(p); g.beginPath(); g.moveTo(0, yy); g.lineTo(W - padR, yy); g.stroke(); if (Math.abs(yy - y(lastC)) > 14) g.fillText(fmt(p), W - padR + 6, yy + 4); }
    cs.forEach((c, k) => { if (k % 10 === 0) g.fillText(hhmm(c.t), k * cw, H - 6); });
    // EMAs
    const line = (arr, col) => { g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); let st = false; cs.forEach((_, k) => { const v = arr[off + k]; if (v == null) return; const xx = k * cw + cw / 2; st ? g.lineTo(xx, y(v)) : g.moveTo(xx, y(v)); st = true; }); g.stroke(); };
    line(ind.bb.up, "#334155"); line(ind.bb.lo, "#334155");
    line(ind.e9, "#38bdf8"); line(ind.e21, "#f59e0b");
    // src
    cs.forEach((c, k) => {
      const x = k * cw + cw / 2, up = c.c >= c.o; g.strokeStyle = g.fillStyle = up ? "#22c55e" : "#ef4444";
      g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke();
      const bh = Math.max(1, Math.abs(y(c.o) - y(c.c))); g.fillRect(x - cw * .35, Math.min(y(c.o), y(c.c)), cw * .7, bh);
    });
    // signal markers from history on visible src
    history.forEach((h) => {
      if (h.shadow || h.sym !== asset().sym) return; const k = cs.findIndex((c) => c.t === h.sigT); if (k < 0) return;
      const x = k * cw + cw / 2; g.fillStyle = h.dir === "UP" ? "#22c55e" : "#ef4444"; g.font = "bold 12px system-ui";
      g.fillText(h.dir === "UP" ? "▲" : "▼", x - 5, h.dir === "UP" ? y(cs[k].l) + 14 : y(cs[k].h) - 4);
    });
    // open trade line
    if (tr && tr.sym === asset().sym) {
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
    const a = asset(), n = expiry(), pay = payoutOf(a.sym), size = +$("btSize").value;
    $("btRun").disabled = true; $("btInfo").textContent = `Baixando ${size.toLocaleString("pt-BR")} velas de ${a.name}…`;
    try {
      const nowT = now();
      const cs = (await fetchKlines(a.sym, size)).filter((c) => c.t + MIN <= nowT);
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
      $("btOut").style.display = "";
      $("btRows").innerHTML = all.map(({ strat, st }) => `<tr class="${strat === "combo" ? "main" : ""}"><td>${STRAT_NAMES[strat]}${strat === "coin" ? " <small>(controle)</small>" : ""}</td>
        <td>${st.n + st.r}</td><td class="${st.wr == null ? "" : st.wr > st.be ? "g" : "r"}">${pct(st.wr)}</td>
        <td>${st.ci ? pct(st.ci[0]) + "–" + pct(st.ci[1]) : "—"}</td><td class="${st.net >= 0 ? "g" : "r"}">${money(st.net)}</td></tr>`).join("");
      const combo = all[0], st = combo.st;
      $("btBE").textContent = `Payout ${pay}% → precisa acertar ${pct(st.be)} para empatar. Valor ${money(stake())} por entrada.`;
      const eq = [0];
      combo.trades.forEach((t) => eq.push(eq[eq.length - 1] + (t.res === "GANHOU" ? stake() * pay / 100 : t.res === "PERDEU" ? -stake() : 0)));
      const v = $("bVerdict");
      const lucky = all.slice(1, 4).filter((x) => x.st.n >= 30 && x.st.ci[0] > x.st.be).map((x) => STRAT_NAMES[x.strat]);
      if (st.n < 30) { v.className = "verdict meh"; v.innerHTML = `<b>Indicador: poucos sinais (${st.n}) para concluir.</b> Aumente o número de velas.`; }
      else if (st.ci[0] > st.be) { v.className = "verdict ok"; v.innerHTML = `<b>Indicador acima do empate neste período</b> (pior caso ${pct(st.ci[0])} &gt; ${pct(st.be)}). Teste em outros ativos e tamanhos antes de acreditar.`; }
      else if (st.ci[1] < st.be) { v.className = "verdict bad"; v.innerHTML = `<b>Indicador perde dinheiro aqui.</b> Acertou ${pct(st.wr)} e precisava de ${pct(st.be)}.`; }
      else { v.className = "verdict meh"; v.innerHTML = `<b>Indicador sem vantagem comprovada.</b> Acertou ${pct(st.wr)}; o real pode estar entre ${pct(st.ci[0])} e ${pct(st.ci[1])}, e o empate é ${pct(st.be)}. Compare com Cara ou coroa.`; }
      if (lucky.length) v.innerHTML += `<br><small>${lucky.join(", ")} passou do empate neste período. Ao testar várias estratégias, uma costuma ir bem por acaso: confirme em outro período.</small>`;
      $("btInfo").textContent = `${a.name} · expiração ${n} min · ${cs.length.toLocaleString("pt-BR")} velas (${new Date(cs[0].t).toLocaleDateString("pt-BR")} a ${new Date(cs[cs.length - 1].t).toLocaleDateString("pt-BR")})`;
      lastEq = eq; drawEquity(eq);
    } catch (e) { $("btInfo").textContent = "Erro ao baixar as velas: " + e.message; }
    $("btRun").disabled = false;
  }
  let lastEq = null;
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
      brokerLine: $("brokerTxt"), signal: $("dir").closest(".sub"), ind: $("indRows").closest(".sub"), session: $("sW").closest(".sub"), chart: document.querySelector(".chartwrap"),
      bt: $("btRun").closest(".card"), header: document.querySelector("header"), broker: $("broker"), reset: $("resetSession"), warn: document.querySelector(".warn"),
    };
    r.brokerLine.classList.add("sub", "brokerline");
    r.broker.querySelector("h3").textContent = "Ler da corretora";
    pane.sinal.append(r.brokerLine, r.signal, r.ind, r.session, r.chart);
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
    paused = null;
    const follow = true;   // market, payout and amount always come from the broker
    const amt = Number.isFinite(d && d.amount) && d.amount > 0 ? d.amount : null;
    if (follow && d && d.currency && d.currency !== cur) { cur = d.currency; LS.set("cur", cur); }
    if (follow && amt && +el.stake.value !== amt) { el.stake.value = amt; LS.set("stake", amt); }
    const amtTxt = amt ? ` · <b>${esc(money(amt))}</b>` : " · valor ?";
    if (!d || !d.raw) {
      $("brokerTxt").innerHTML = "Nenhum mercado encontrado na página." + "<div class=\"m\">Em <b>Ajustes</b>, use <b>Apontar mercado</b>.</div>";
      renderPanel(); return;
    }
    const sym = typeof d.sym === "string" && ASSETS.some((x) => x.sym === d.sym) ? d.sym : null;
    const pay = Number.isFinite(d.payout) && d.payout >= 10 && d.payout <= 100 ? Math.round(d.payout) : null;
    let html = `<b>${esc(d.raw)}</b>` + (pay ? ` · <b>${pay}%</b>` : " · payout ?") + amtTxt;
    if (follow) {
      if (d.otc) paused = "OTC: sinais pausados, gráfico e tendência pelo preço da corretora";
      else if (!sym) paused = "sem dado grátis deste mercado: gráfico e tendência pelo preço da corretora";
      else {
        if (pay && payouts[sym] !== pay) { payouts[sym] = pay; LS.set("payouts", payouts); }
        if (el.asset.value !== sym) { el.asset.value = sym; el.asset.onchange(); } else syncPayoutInput();
        html += ` → <b>${esc(asset().name)}</b>`;
      }
    }
    if (paused) html += `<div class="w">${esc(paused)}.</div>`;
    // expiration and time zone, also from the broker
    let expTxt = "não encontrada (usando " + expiry() + " min)";
    if (Number.isFinite(d.expirySec) && d.expirySec > 0) {
      const n = Math.max(1, Math.round(d.expirySec / 60)); setExpiry(n);
      expTxt = d.expirySec < 60 ? `${d.expirySec} s na corretora → o painel usa 1 min (velas de 1 min)` : `${n} min`;
    }
    const newTz = Number.isFinite(d.tz) ? String(d.tz) : "local";
    if (newTz !== tz) { tz = newTz; LS.set("tz", tz); renderHistory(); }
    const pay2 = Number.isFinite(d.payout) && d.payout >= 10 && d.payout <= 100 ? Math.round(d.payout) + "%" : "não encontrado";
    const tzTxt = tz === "local" ? "do computador" : "UTC" + (+tz >= 0 ? "+" : "") + tz;
    if ($("autoInfo")) $("autoInfo").innerHTML = `<div>Mercado: <b>${esc(d.raw || "não encontrado")}</b></div><div>Expiração: <b>${esc(expTxt)}</b></div>
      <div>Payout: <b>${pay2}</b></div><div>Valor: <b>${amt ? esc(money(amt)) : "não encontrado"}</b></div><div>Horário: <b>${tzTxt}</b> · agora ${clockStr(now(), true)}</div>
      <div>Preço na tela: <b id="autoPrice">${feed.found ? fmt(feed.candles[feed.candles.length - 1].c) + " (lido da tela)" : "—"}</b></div>`;
    const t = d.taught || {};
    if (t.asset || t.payout || t.amount || t.expiry || t.price) html += `<div class="m" style="font-size:11px">pontos marcados: ${[t.asset && "mercado", t.payout && "payout", t.amount && "valor", t.expiry && "expiração", t.price && "preço"].filter(Boolean).join(", ")}</div>`;
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
      if (d.type === "sh-price") { onBrokerPrice(+d.p); if ($("autoPrice")) $("autoPrice").textContent = +d.p > 0 ? fmt(+d.p) + " (lido da tela)" : "não encontrado"; return; }
      if (d.type !== "sh-detect") return;
      lastDetect = {
        raw: typeof d.raw === "string" ? d.raw.slice(0, 40) : null, sym: d.sym, otc: !!d.otc, payout: +d.payout, amount: +d.amount,
        currency: ["R$", "$", "US$", "€", "£"].includes(d.currency) ? d.currency : null,
        expirySec: +d.expirySec, tz: d.tz == null ? null : +d.tz, taught: d.taught && typeof d.taught === "object" ? d.taught : {},
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
