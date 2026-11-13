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
  const STRAT_NAMES = { rsi: "RSI 30/70", bb: "Bollinger", ema: "EMA 9×21", coin: "Cara ou coroa" };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("sh_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sh_" + k, JSON.stringify(v)); } catch {} },
  };

  const $ = (id) => document.getElementById(id);
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
  el.strategy.value = LS.get("strategy", "rsi");
  el.expiry.value = String(LS.get("expiry", 1));
  el.stake.value = LS.get("stake", 10);

  const asset = () => ASSETS.find((a) => a.sym === el.asset.value) || ASSETS[0];
  const payoutOf = (sym) => (payouts[sym] ?? (ASSETS.find((a) => a.sym === sym) || {}).payout ?? 85);
  const expiry = () => +el.expiry.value;
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
  const hhmm = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

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

  function setStatus(txt, on) { $("status").innerHTML = `<span class="dot ${on ? "on" : ""}"></span>${txt}`; $("livebadge").style.opacity = on ? 1 : .35; }

  async function loadAsset() {
    const sym = asset().sym; const token = ++wsToken;
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    clearInterval(pollTimer);
    candles = []; lastEvaluatedT = 0; draw(); renderPanel();
    setStatus("carregando " + asset().name + "…", false);
    try {
      const cs = await fetchKlines(sym, 300);
      if (token !== wsToken) return;
      const now = Date.now();
      candles = cs.map((c) => ({ ...c, closed: c.t + MIN <= now }));
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
    const s = new WebSocket(WS + sym.toLowerCase() + "@kline_1m"); ws = s; let opened = false;
    s.onopen = () => { opened = true; wsFails = 0; reconnectDelay = 1000; setStatus(asset().name + " · ao vivo · M1", true); };
    s.onmessage = (ev) => {
      if (token !== wsToken) return;
      const k = JSON.parse(ev.data).k; if (!k) return;
      if (applyKline({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, closed: k.x })) onClose();
      draw(); renderPanel();
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
    setStatus(asset().name + " · ao vivo · M1 (atualiza a cada 2 s)", true);
    const tick = async () => {
      if (token !== wsToken) return clearInterval(pollTimer);
      try {
        const r = await fetch(`${REST}?symbol=${sym}&interval=1m&limit=2`); if (!r.ok) throw 0;
        const now = Date.now(); let closed = false;
        for (const k of (await r.json()).map(parseK)) if (applyKline({ ...k, closed: k.t + MIN <= now })) closed = true;
        if (token !== wsToken) return;
        if (closed) onClose();
        setStatus(asset().name + " · ao vivo · M1 (atualiza a cada 2 s)", true);
        draw(); renderPanel();
      } catch { setStatus("sem resposta dos dados, tentando…", false); }
    };
    pollTimer = setInterval(tick, 2000); tick();
  }

  // ---------- live signals ----------
  const openTrade = () => history.find((h) => !h.res && h.sym === asset().sym);
  const tr0 = () => openTrade();

  // trades left open on another asset are resolved over REST once they expire
  let resolvingOther = false;
  async function resolveOtherAssets() {
    if (resolvingOther) return; resolvingOther = true;
    try {
      for (const h of history) {
        if (h.res || h.sym === asset().sym || Date.now() < h.endAt + 3000) continue;
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
    if (openTrade()) return; // one trade at a time
    if (paused) return;
    const strat = el.strategy.value;
    const dir = signalAt(strat, indicators(closed), closed, i);
    if (!dir) return;
    const n = expiry();
    history.unshift({
      id: closed[i].t + strat, sym: asset().sym, name: asset().name, strat, dir, n,
      payout: payoutOf(asset().sym), stake: stake(), cur, entry: closed[i].c, sigT: closed[i].t,
      expT: closed[i].t + n * MIN, // exit = close of this candle
      endAt: closed[i].t + (n + 1) * MIN, res: null, exit: null,
    });
    history = history.slice(0, 500); LS.set("history", history); renderHistory();
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
        say(h.res === "GANHOU" ? "Ganhou. Lembre: um acerto não prova nada, olhe a taxa." : h.res === "PERDEU" ? "Perdeu. Faz parte, e eu conto todas." : "Empate: o preço fechou igual à entrada.");
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
    $("mStake").textContent = "Valor " + money(tr0() ? tr0().stake || stake() : stake()).replace(/^-/, "");
    const tr = openTrade();
    const dirEl = $("dir");
    if (tr) {
      $("tradeTitle").textContent = "Trade aberto";
      dirEl.className = "dir " + tr.dir; dirEl.textContent = tr.dir === "UP" ? "▲ UP" : "▼ DOWN";
      const left = Math.max(0, tr.endAt - Date.now()), tot = tr.n * MIN;
      const s = Math.ceil(left / 1000);
      $("timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      $("bar").style.width = (100 * (1 - left / tot)).toFixed(1) + "%";
      $("mPayout").textContent = `Payout ${tr.payout}%`;
      $("mEntry").textContent = `Entrada ${fmt(tr.entry)}`;
      $("mExp").textContent = `${tr.n} min`;
    } else {
      $("tradeTitle").textContent = paused ? "Sinais pausados" : "Aguardando setup · " + STRAT_NAMES[el.strategy.value];
      if (paused) { dirEl.className = "dir PAUSE"; dirEl.textContent = "PAUSADO"; }
      else { dirEl.className = "dir WAIT"; dirEl.textContent = "SEM SINAL"; }
      const last = candles[candles.length - 1];
      if (last) { const s = Math.max(0, Math.ceil((last.t + MIN - Date.now()) / 1000)); $("timer").textContent = `0:${String(s % 60).padStart(2, "0")}`; $("bar").style.width = (100 * (1 - s / 60)) + "%"; }
      else { $("timer").textContent = "--:--"; $("bar").style.width = "0"; }
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
    const done = history.filter((h) => h.res && h.res !== "SEM DADO");
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
    const tb = $("hist");
    if (!history.length) { tb.innerHTML = '<tr><td colspan="10" class="m">Nenhum sinal ainda.</td></tr>'; return; }
    tb.innerHTML = history.slice(0, 100).map((h) => {
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
    if (!candles.length) return;
    const N = Math.max(20, Math.min(80, Math.floor(W / 9)));
    const cs = candles.slice(-N);
    const ind = indicators(candles); const off = candles.length - cs.length;
    const padR = 70, padT = 30, padB = 24, cw = (W - padR) / N;
    let hi = -Infinity, lo = Infinity; cs.forEach((c) => { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
    const tr = openTrade(); if (tr && tr.sym === asset().sym) { hi = Math.max(hi, tr.entry); lo = Math.min(lo, tr.entry); }
    if (hi === lo) { hi += hi * 1e-4; lo -= lo * 1e-4; }
    const y = (p) => padT + (hi - p) / (hi - lo) * (H - padT - padB);
    // grid
    g.strokeStyle = "#1f2a44"; g.lineWidth = 1; g.fillStyle = "#8a97b3"; g.font = "11px system-ui";
    for (let k = 0; k <= 4; k++) { const p = lo + (hi - lo) * k / 4, yy = y(p); g.beginPath(); g.moveTo(0, yy); g.lineTo(W - padR, yy); g.stroke(); g.fillText(fmt(p), W - padR + 6, yy + 4); }
    cs.forEach((c, k) => { if (k % 10 === 0) g.fillText(hhmm(c.t), k * cw, H - 6); });
    // EMAs
    const line = (arr, col) => { g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); let st = false; cs.forEach((_, k) => { const v = arr[off + k]; if (v == null) return; const xx = k * cw + cw / 2; st ? g.lineTo(xx, y(v)) : g.moveTo(xx, y(v)); st = true; }); g.stroke(); };
    if (el.strategy.value === "ema") { line(ind.e9, "#38bdf8"); line(ind.e21, "#f59e0b"); }
    if (el.strategy.value === "bb") { line(ind.bb.up, "#64748b"); line(ind.bb.lo, "#64748b"); line(ind.bb.mid, "#475569"); }
    // candles
    cs.forEach((c, k) => {
      const x = k * cw + cw / 2, up = c.c >= c.o; g.strokeStyle = g.fillStyle = up ? "#22c55e" : "#ef4444";
      g.beginPath(); g.moveTo(x, y(c.h)); g.lineTo(x, y(c.l)); g.stroke();
      const bh = Math.max(1, Math.abs(y(c.o) - y(c.c))); g.fillRect(x - cw * .35, Math.min(y(c.o), y(c.c)), cw * .7, bh);
    });
    // signal markers from history on visible candles
    history.forEach((h) => {
      if (h.sym !== asset().sym) return; const k = cs.findIndex((c) => c.t === h.sigT); if (k < 0) return;
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
    const last = candles[candles.length - 1], yy = y(last.c);
    g.fillStyle = "#38bdf8"; g.fillRect(W - padR, yy - 9, padR, 18); g.fillStyle = "#001018"; g.font = "bold 11px system-ui"; g.fillText(fmt(last.c), W - padR + 4, yy + 4);
  }

  // ---------- backtest ----------
  async function runBacktest() {
    const a = asset(), strat = el.strategy.value, n = expiry(), pay = payoutOf(a.sym), size = +$("btSize").value;
    $("btRun").disabled = true; $("btInfo").textContent = `Baixando ${size.toLocaleString("pt-BR")} velas de ${a.name}…`;
    try {
      const now = Date.now();
      const cs = (await fetchKlines(a.sym, size)).filter((c) => c.t + MIN <= now);
      const ind = indicators(cs); const trades = [];
      for (let i = 25; i + n < cs.length; i++) {
        const dir = signalAt(strat, ind, cs, i); if (!dir) continue;
        trades.push({ dir, res: outcome(dir, cs[i].c, cs[i + n].c) });
        i += n - 1; // one trade at a time, same as live
      }
      const st = stats(trades, pay, stake());
      let streak = 0, best = 0; const eq = [0];
      trades.forEach((t) => {
        if (t.res === "PERDEU") { streak++; best = Math.max(best, streak); } else if (t.res === "GANHOU") streak = 0;
        eq.push(eq[eq.length - 1] + (t.res === "GANHOU" ? stake() * pay / 100 : t.res === "PERDEU" ? -stake() : 0));
      });
      $("btOut").style.display = "";
      $("bN").textContent = trades.length;
      $("bWLR").innerHTML = `<span class="g">${st.w}</span> / <span class="r">${st.l}</span> / ${st.r}`;
      $("bWR").textContent = pct(st.wr); $("bWR").className = st.wr == null ? "" : st.wr > st.be ? "g" : "r";
      $("bBE").textContent = pct(st.be);
      $("bCI").textContent = st.ci ? `${pct(st.ci[0])} – ${pct(st.ci[1])}` : "—";
      $("bNet").textContent = money(st.net); $("bNet").className = st.net >= 0 ? "g" : "r";
      $("bStreak").textContent = best;
      const v = $("bVerdict");
      if (st.n < 30) { v.className = "verdict meh"; v.innerHTML = `<b>Poucos sinais (${st.n}) para concluir qualquer coisa.</b> Aumente o número de velas.`; }
      else if (st.ci[0] > st.be) { v.className = "verdict ok"; v.innerHTML = `<b>Acima do empate neste período</b> (mesmo o pior caso da faixa, ${pct(st.ci[0])}, passa de ${pct(st.be)}). Antes de acreditar, rode em outro ativo e em outro tamanho: resultado bom em um período costuma não se repetir. E os preços OTC da corretora não são estes.`; }
      else if (st.ci[1] < st.be) { v.className = "verdict bad"; v.innerHTML = `<b>Perde dinheiro.</b> Acertou ${pct(st.wr)} e precisava de ${pct(st.be)}. Com ${money(stake())} por entrada, o resultado foi ${money(st.net)}.`; }
      else { v.className = "verdict meh"; v.innerHTML = `<b>Não dá para dizer que tem vantagem.</b> Acertou ${pct(st.wr)}, mas o acerto real pode estar entre ${pct(st.ci[0])} e ${pct(st.ci[1])}, e o empate é ${pct(st.be)}. Com essa quantidade de sinais, o resultado ainda pode ser sorte. Compare com a estratégia "Cara ou coroa (controle)" e teste com mais velas.`; }
      $("btInfo").textContent = `${a.name} · ${STRAT_NAMES[strat]} · expiração ${n} min · payout ${pay}% · ${cs.length.toLocaleString("pt-BR")} velas de ${new Date(cs[0].t).toLocaleString("pt-BR")} a ${new Date(cs[cs.length - 1].t).toLocaleString("pt-BR")}`;
      drawEquity(eq);
    } catch (e) { $("btInfo").textContent = "Erro ao baixar as velas: " + e.message; }
    $("btRun").disabled = false;
  }
  function drawEquity(eq) {
    const c = $("eq"), dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hi = Math.max(0, ...eq), lo = Math.min(0, ...eq), pad = 18, y = (v) => pad + (hi - v) / ((hi - lo) || 1) * (H - 2 * pad);
    const x = (k) => 50 + k / Math.max(1, eq.length - 1) * (W - 60);
    g.strokeStyle = "#334155"; g.beginPath(); g.moveTo(50, y(0)); g.lineTo(W - 10, y(0)); g.stroke();
    g.fillStyle = "#8a97b3"; g.font = "11px system-ui"; g.fillText(money(hi), 2, y(hi) + 4); g.fillText(cur + " 0", 2, y(0) + 4); g.fillText(money(lo), 2, y(lo) + 4);
    g.strokeStyle = eq[eq.length - 1] >= 0 ? "#22c55e" : "#ef4444"; g.lineWidth = 1.6; g.beginPath();
    eq.forEach((v, k) => k ? g.lineTo(x(k), y(v)) : g.moveTo(x(k), y(v))); g.stroke();
  }

  // ---------- events ----------
  function syncPayoutInput() { el.payout.value = payoutOf(asset().sym); }
  el.asset.onchange = () => { LS.set("asset", el.asset.value); syncPayoutInput(); $("btOut").style.display = "none"; loadAsset(); };
  el.strategy.onchange = () => { LS.set("strategy", el.strategy.value); draw(); renderPanel(); };
  el.expiry.onchange = () => { LS.set("expiry", +el.expiry.value); renderPanel(); };
  el.payout.oninput = () => { const v = Math.min(100, Math.max(1, +el.payout.value || 0)); if (!v) return; payouts[asset().sym] = v; LS.set("payouts", payouts); renderPanel(); };
  el.stake.oninput = () => { LS.set("stake", stake()); renderPanel(); };
  $("resetSession").onclick = () => { if (!confirm("Apagar o histórico e as estatísticas desta sessão?")) return; history = []; LS.set("history", history); renderHistory(); renderPanel(); draw(); };
  $("btRun").onclick = runBacktest;
  window.addEventListener("resize", draw);
  setInterval(() => { renderPanel(); }, 250);
  setInterval(resolveOtherAssets, 5000);

  // ---------- extension bridge ----------
  // Inside the extension the page runs in an iframe; content.js reads the asset and payout
  // shown by the broker and posts them here.
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  let lastDetect = null;
  function applyDetect(d) {
    paused = null;
    const follow = $("follow").checked;
    const amt = Number.isFinite(d && d.amount) && d.amount > 0 ? d.amount : null;
    if (follow && d && d.currency && d.currency !== cur) { cur = d.currency; LS.set("cur", cur); }
    if (follow && amt && +el.stake.value !== amt) { el.stake.value = amt; LS.set("stake", amt); }
    const amtTxt = amt ? ` · valor <b>${esc(money(amt))}</b>` : " · valor não encontrado";
    if (!d || !d.raw) {
      $("brokerTxt").innerHTML = "Nenhum mercado encontrado na página." + (d ? amtTxt : "") + "<div class=\"m\">Use <b>Apontar mercado</b> abaixo.</div>";
      renderPanel(); return;
    }
    const sym = typeof d.sym === "string" && ASSETS.some((x) => x.sym === d.sym) ? d.sym : null;
    const pay = Number.isFinite(d.payout) && d.payout >= 10 && d.payout <= 100 ? Math.round(d.payout) : null;
    let html = `Mercado: <b>${esc(d.raw)}</b>` + (pay ? ` · payout <b>${pay}%</b>` : " · payout não encontrado") + amtTxt;
    if (follow) {
      if (d.otc) paused = "OTC é preço gerado pela corretora, não existe dado real para comparar";
      else if (!sym) paused = "este mercado não tem dados reais grátis aqui";
      else {
        if (pay && payouts[sym] !== pay) { payouts[sym] = pay; LS.set("payouts", payouts); }
        if (el.asset.value !== sym) { el.asset.value = sym; el.asset.onchange(); } else syncPayoutInput();
        html += ` → sinais de <b>${esc(asset().name)}</b>`;
      }
    }
    if (paused) html += `<div class="w">Sem sinal: ${esc(paused)}. Sinais só em BTC, ETH, SOL, BNB, XRP, EUR/USD e ouro fora do OTC.</div>`;
    const t = d.taught || {};
    if (t.asset || t.payout || t.amount) html += `<div class="m" style="font-size:11px;margin-top:4px">Lendo do ponto que você marcou: ${[t.asset && "mercado", t.payout && "payout", t.amount && "valor"].filter(Boolean).join(", ")}</div>`;
    $("brokerTxt").innerHTML = html;
    renderPanel();
  }
  if (window.top !== window) {
    document.body.classList.add("compact");
    $("broker").style.display = "";
    $("follow").checked = LS.get("follow", true);
    $("follow").onchange = () => { LS.set("follow", $("follow").checked); applyDetect(lastDetect); };
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent) return;
      const d = e.data; if (!d || d.type !== "sh-detect") return;
      lastDetect = {
        raw: typeof d.raw === "string" ? d.raw.slice(0, 40) : null, sym: d.sym, otc: !!d.otc, payout: +d.payout, amount: +d.amount,
        currency: ["R$", "$", "US$", "€", "£"].includes(d.currency) ? d.currency : null, taught: d.taught && typeof d.taught === "object" ? d.taught : {},
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
