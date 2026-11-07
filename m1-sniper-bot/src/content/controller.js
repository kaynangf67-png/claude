/*
 * M1 SNIPER BOT — Controlador (orquestra feed → motor → risco → histórico).
 * Não depende de DOM nem de chrome.*: recebe adaptadores (storage, feed, relógio),
 * o que permite testar o fluxo completo no Node.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const M = isNode
    ? {
        Engine: require('../core/engine.js'), Risk: require('../core/risk.js'), Stats: require('../core/stats.js'),
        History: require('../core/history.js'), Settings: require('../core/settings.js'), Binance: require('../data/binance.js'),
      }
    : root.M1;
  const mod = factory(M);
  if (isNode) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Controller = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';

  const KEYS = { settings: 'm1.settings', risk: 'm1.risk', history: 'm1.history', ui: 'm1.ui' };
  const ENTRY_GRACE_MS = 10000;   // o sinal só é operável nos primeiros 10s do candle de entrada
  const FETCH_EVERY_MS = 2000;
  const MAX_CANDLES = 600;

  function createController(deps) {
    const storage = deps.storage;
    const feed = deps.feed;
    const now = deps.now || (() => Date.now());
    const listeners = new Set();

    const st = {
      ready: false,
      active: false,
      settings: M.Settings.sanitize({}),
      risk: M.Risk.createState(now()),
      history: M.History.empty(),
      ui: { x: null, y: null, minimized: false },
      candles: [],
      forming: null,
      feed: { ok: null, error: '', lastUpdate: 0, source: 'binance' },
      lastFetch: 0,
      fetching: false,
      lastAnalyzedTime: null,
      analysis: null,
      current: null,       // sinal ativo no card (NOVO / OPERADO)
      message: '',
    };

    const emit = () => listeners.forEach((fn) => { try { fn(st); } catch (e) { /* ui */ } });
    const save = (...which) => {
      const o = {};
      which.forEach((k) => { o[KEYS[k]] = st[k]; });
      return storage.set(o);
    };
    const say = (m) => { st.message = m; };

    async function init() {
      const data = (await storage.get(Object.values(KEYS))) || {};
      st.settings = M.Settings.sanitize(data[KEYS.settings]);
      st.history = data[KEYS.history] && Array.isArray(data[KEYS.history].signals) ? data[KEYS.history] : M.History.empty();
      st.ui = Object.assign(st.ui, data[KEYS.ui] || {});
      const r = M.Risk.rollover(data[KEYS.risk], now());
      st.risk = r.state;
      // Operação aberta que sobreviveu a um reinício continua visível para registrar o resultado.
      if (st.risk.openTradeId) {
        const t = st.history.trades.find((x) => x.id === st.risk.openTradeId);
        const s = st.history.signals.find((x) => x.id === st.risk.openTradeId);
        if (t && !t.result && s) st.current = Object.assign({}, s, { status: 'OPERADO' });
        else st.risk = Object.assign({}, st.risk, { openTradeId: null });
      }
      st.feed.source = st.settings.source;
      st.ready = true;
      await save('settings', 'risk', 'history');
      emit();
    }

    // ------------------------------------------------------------------ feed
    async function fetchFeed() {
      if (st.settings.source !== 'binance' || st.fetching) return;
      st.fetching = true;
      st.lastFetch = now();
      const symbol = st.settings.symbol;
      try {
        const limit = st.candles.length >= M.Engine.MIN_CANDLES ? 5 : 500;
        const data = await feed.fetchKlines(symbol, limit);
        if (symbol !== st.settings.symbol) return; // trocou de ativo durante a requisição
        st.candles = M.Binance.merge(st.candles.concat(st.forming ? [st.forming] : []), data, MAX_CANDLES + 1);
        const sp = M.Binance.splitClosed(st.candles, now());
        st.candles = sp.closed.slice(-MAX_CANDLES);
        st.forming = sp.forming;
        st.feed = { ok: true, error: '', lastUpdate: now(), source: 'binance' };
        onCandles();
      } catch (e) {
        st.feed = Object.assign({}, st.feed, { ok: false, error: String(e && e.message ? e.message : e) });
      } finally {
        st.fetching = false;
        emit();
      }
    }

    function loadManualCSV(text) {
      const { candles, errors } = M.Settings.parseCandlesCSV(text);
      if (!candles.length) { say(`Nenhum candle lido. ${errors.slice(0, 2).join('; ')}`); emit(); return { ok: false, errors }; }
      const bad = M.Engine.validateCandles(candles);
      if (bad) { say(`Dados inválidos: ${bad}`); emit(); return { ok: false, errors: [bad] }; }
      st.candles = candles.slice(-MAX_CANDLES);
      st.forming = null;
      st.lastAnalyzedTime = null;
      st.feed = { ok: true, error: '', lastUpdate: now(), source: 'manual' };
      say(`${candles.length} candles carregados${errors.length ? ` (${errors.length} linhas ignoradas)` : ''}.`);
      onCandles();
      emit();
      return { ok: true, errors, count: candles.length };
    }

    // --------------------------------------------------------------- análise
    function onCandles() {
      resolveFeedOutcomes();
      const last = st.candles[st.candles.length - 1];
      if (!last || last.time === st.lastAnalyzedTime) return;
      st.lastAnalyzedTime = last.time;
      const res = M.Engine.evaluate(st.candles, { minScore: st.settings.minScore, adxMin: st.settings.adxMin });
      st.analysis = Object.assign(res, { at: now(), asset: st.settings.symbol });
      if (res.signal) maybeCreateSignal(res, last);
    }

    function assetName() {
      if (st.settings.source === 'manual') return st.settings.assetLabel || 'MANUAL';
      return st.settings.assetLabel || st.settings.symbol;
    }

    function maybeCreateSignal(res, trigger) {
      const entryTime = trigger.time + 60000;
      const id = `${st.settings.source}:${st.settings.symbol}:${trigger.time}`;
      if (st.history.signals.some((s) => s.id === id)) return; // mesmo candle → sem duplicidade
      const chk = M.Risk.check(st.risk, { active: st.active });
      if (!chk.ok) { st.analysis.blockedBy = chk.reason; return; }
      if (st.current) { st.analysis.blockedBy = 'Já existe um sinal em aberto.'; return; }
      if (now() > entryTime + ENTRY_GRACE_MS) { st.analysis.blockedBy = 'Sinal chegou atrasado (dados antigos); descartado.'; return; }
      const sig = {
        id, asset: assetName(), symbol: st.settings.symbol, source: st.settings.source,
        direction: res.signal, score: res.score, parts: res.parts, reasons: res.reasons,
        signalTime: trigger.time, entryTime, expiryTime: entryTime + 60000,
        createdAt: now(), status: 'NOVO', feedResult: null, accountMode: st.settings.accountMode,
      };
      st.current = sig;
      st.history = M.History.putSignal(st.history, sig);
      save('history');
      if (deps.onSignal) deps.onSignal(sig);
    }

    function resolveFeedOutcomes() {
      if (st.settings.source !== 'binance') return;
      let changed = false;
      const byTime = new Map(st.candles.map((c) => [c.time, c]));
      const pending = st.history.signals.filter((s) => !s.feedResult && s.source === 'binance' && s.symbol === st.settings.symbol);
      for (const s of pending) {
        const c = byTime.get(s.entryTime);
        if (!c) continue;
        const r = M.History.binaryOutcome(s.direction, c);
        st.history = M.History.putSignal(st.history, { id: s.id, feedResult: r, entryOpen: c.open, entryClose: c.close });
        const t = st.history.trades.find((x) => x.id === s.id);
        if (t && !t.result) st.history = M.History.putTrade(st.history, { id: t.id, feedResult: r });
        if (st.current && st.current.id === s.id) st.current = Object.assign({}, st.current, { feedResult: r });
        changed = true;
        if (st.settings.autoRecord && st.risk.openTradeId === s.id) recordResult(r, true);
      }
      if (changed) save('history');
    }

    // ------------------------------------------------------------- tick
    function tick() {
      const t = now();
      const r = M.Risk.rollover(st.risk, t);
      if (r.rolled) { st.risk = r.state; say('Novo dia: contadores zerados.'); save('risk'); }
      if (st.current && st.current.status === 'NOVO' && t > st.current.entryTime + ENTRY_GRACE_MS) {
        st.history = M.History.putSignal(st.history, { id: st.current.id, status: 'EXPIRADO' });
        st.current = null;
        save('history');
      }
      // Só consulta o feed com o painel ativo ou com operação aguardando resultado.
      if (st.settings.source === 'binance' && (st.active || st.current) && t - st.lastFetch >= FETCH_EVERY_MS) fetchFeed();
      emit();
    }

    // ------------------------------------------------------------ ações
    function setActive(on) {
      if (on) {
        const lock = M.Risk.lockReason(st.risk);
        if (lock) { say(lock.reason); emit(); return false; }
        st.active = true;
        st.lastFetch = 0;
        say('Análise ativada. Aguardando fechamento de candle.');
      } else {
        st.active = false;
        if (st.current && st.current.status === 'NOVO') {
          st.history = M.History.putSignal(st.history, { id: st.current.id, status: 'CANCELADO' });
          st.current = null;
          save('history');
        }
        say('Análise desativada. Nenhum sinal novo será gerado.');
      }
      emit();
      return true;
    }

    function confirmEntry() {
      const s = st.current;
      if (!s || s.status !== 'NOVO') { say('Não há sinal para confirmar.'); emit(); return false; }
      if (now() > s.entryTime + ENTRY_GRACE_MS) { say('Janela de entrada encerrada.'); emit(); return false; }
      const r = M.Risk.registerEntry(st.risk, s.id, { active: st.active });
      if (!r.ok) { say(r.reason); emit(); return false; }
      st.risk = r.state;
      st.current = Object.assign({}, s, { status: 'OPERADO' });
      st.history = M.History.putSignal(st.history, { id: s.id, status: 'OPERADO' });
      st.history = M.History.putTrade(st.history, {
        id: s.id, asset: s.asset, symbol: s.symbol, source: s.source, direction: s.direction, score: s.score,
        stake: st.settings.stake, currency: st.settings.currency, accountMode: st.settings.accountMode,
        entryTime: s.entryTime, expiryTime: s.expiryTime, confirmedAt: now(), result: null, feedResult: s.feedResult,
      });
      say('Entrada registrada. Opere manualmente na corretora.');
      save('risk', 'history');
      emit();
      return true;
    }

    function cancelEntry() {
      const s = st.current;
      if (!s || s.status !== 'OPERADO') return false;
      st.risk = M.Risk.cancelEntry(st.risk, s.id);
      st.history = Object.assign({}, st.history, { trades: st.history.trades.filter((t) => t.id !== s.id) });
      st.history = M.History.putSignal(st.history, { id: s.id, status: 'NAO_OPERADO' });
      st.current = null;
      say('Entrada desfeita.');
      save('risk', 'history');
      emit();
      return true;
    }

    function ignoreSignal() {
      const s = st.current;
      if (!s || s.status !== 'NOVO') return false;
      st.history = M.History.putSignal(st.history, { id: s.id, status: 'IGNORADO' });
      st.current = null;
      save('history');
      emit();
      return true;
    }

    function recordResult(result, auto) {
      const s = st.current;
      if (!s || s.status !== 'OPERADO') return false;
      const trade = st.history.trades.find((t) => t.id === s.id);
      const r = M.Risk.registerResult(st.risk, s.id, result, trade ? trade.stake : st.settings.stake);
      if (!r.ok) { say(r.reason); emit(); return false; }
      st.risk = r.state;
      st.history = M.History.putTrade(st.history, { id: s.id, result, resolvedAt: now(), autoRecorded: !!auto });
      st.current = null;
      const lock = M.Risk.lockReason(st.risk);
      if (lock) { st.active = false; say(lock.reason); }
      else say(`Resultado registrado: ${result}.`);
      save('risk', 'history');
      emit();
      return true;
    }

    function setStake(v) {
      const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
      const chk = M.Risk.canSetStake(st.risk, n);
      if (!chk.ok) { say(chk.reason); emit(); return false; }
      st.settings = M.Settings.sanitize(Object.assign({}, st.settings, { stake: n }));
      say(`Valor por operação: ${st.settings.currency} ${st.settings.stake.toFixed(2).replace('.', ',')}`);
      save('settings');
      emit();
      return true;
    }

    function realValidation() {
      return M.Stats.realValidation(st.history.trades, st.settings.payout);
    }

    function updateSettings(patch) {
      const p = Object.assign({}, patch);
      delete p.stake; // valor só muda por setStake (regra anti-martingale)
      if (p.accountMode === 'REAL' && st.settings.accountMode !== 'REAL') {
        const v = realValidation();
        if (!v.ok) { say(`Conta REAL bloqueada: ${v.reason}`); emit(); return false; }
      }
      if (st.current && (p.symbol !== undefined || p.source !== undefined)) {
        if ((p.symbol && p.symbol !== st.settings.symbol) || (p.source && p.source !== st.settings.source)) {
          say('Finalize o sinal/operação atual antes de trocar de ativo ou fonte.'); emit(); return false;
        }
      }
      const prev = st.settings;
      st.settings = M.Settings.sanitize(Object.assign({}, st.settings, p));
      if (prev.symbol !== st.settings.symbol || prev.source !== st.settings.source) {
        st.candles = []; st.forming = null; st.lastAnalyzedTime = null; st.analysis = null; st.lastFetch = 0;
        st.feed = { ok: null, error: '', lastUpdate: 0, source: st.settings.source };
      }
      save('settings');
      emit();
      return true;
    }

    function setUI(patch) { st.ui = Object.assign({}, st.ui, patch); save('ui'); emit(); }

    function resetHistory() {
      if (st.current) { say('Finalize a operação atual antes de limpar o histórico.'); emit(); return false; }
      st.history = M.History.empty();
      say('Histórico apagado (os contadores do dia e o bloqueio continuam valendo).');
      save('history');
      emit();
      return true;
    }

    function stats() {
      return {
        trades: M.Stats.compute(st.history.trades, st.settings.payout),
        signals: M.Stats.compute(st.history.signals.map((s) => ({ asset: s.asset, result: s.feedResult })), st.settings.payout),
      };
    }

    function exportCSV() {
      const trades = M.History.toCSV(st.history.trades.map((t) => Object.assign({}, t, {
        entry: new Date(t.entryTime).toISOString(),
      })), ['entry', 'asset', 'direction', 'score', 'stake', 'currency', 'accountMode', 'result', 'feedResult']);
      const signals = M.History.toCSV(st.history.signals.map((s) => Object.assign({}, s, {
        entry: new Date(s.entryTime).toISOString(),
      })), ['entry', 'asset', 'direction', 'score', 'status', 'feedResult']);
      return { trades, signals };
    }

    return {
      state: st,
      init, tick, fetchFeed, loadManualCSV,
      setActive, confirmEntry, cancelEntry, ignoreSignal, recordResult,
      setStake, updateSettings, setUI, resetHistory, stats, exportCSV, realValidation,
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      ENTRY_GRACE_MS,
    };
  }

  return { createController, KEYS, ENTRY_GRACE_MS };
});
