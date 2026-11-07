// Estado da aplicação + redutor puro. TODA mutação passa por `reduce`, que
// aplica as regras de risco. O service worker é o único que grava o estado.
import { browserTimeZone, isValidTimeZone } from './time.js';
import { rollDay, lockFor, checkAmount, newDay, LOCK_MESSAGES, MIN_SCORE_FLOOR } from './risk.js';
import { realReadiness, REAL_CONFIRM_PHRASE } from './stats.js';
import { dayKey } from './time.js';

export const STATE_VERSION = 1;
const MAX_TRADES = 5000, MAX_SIGNALS = 5000, MAX_EVENTS = 400;

export const DEFAULT_SETTINGS = Object.freeze({
  amount: 1,
  timeZone: 'UTC',
  minScore: 80,
  symbol: 'BTCUSDT',
  payout: 0.85,          // payout informado pelo usuário (usado só nas estatísticas)
  signalTtlSec: 15,      // segundos após a abertura do candle de entrada em que o sinal ainda vale
  panel: { x: null, y: 16, minimized: false },
});

export function initialState(now = Date.now(), tz = browserTimeZone()) {
  const timeZone = isValidTimeZone(tz) ? tz : 'UTC';
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, timeZone, panel: { ...DEFAULT_SETTINGS.panel } },
    account: { mode: 'DEMO', realUnlockedAt: null },
    day: newDay(dayKey(now, timeZone)),
    active: false,
    activeSignal: null,
    openTrade: null,
    lastSignalId: null,
    trades: [],
    signalLog: [],
    events: [],
  };
}

/** Recupera/migra estado salvo; nunca descarta contadores e histórico válidos. */
export function hydrate(saved, now = Date.now()) {
  const base = initialState(now);
  if (!saved || typeof saved !== 'object') return base;
  const s = {
    ...base, ...saved,
    settings: { ...base.settings, ...(saved.settings || {}), panel: { ...base.settings.panel, ...(saved.settings?.panel || {}) } },
    account: { ...base.account, ...(saved.account || {}) },
    day: saved.day && typeof saved.day.key === 'string' ? { ...newDay(saved.day.key), ...saved.day } : base.day,
    trades: Array.isArray(saved.trades) ? saved.trades : [],
    signalLog: Array.isArray(saved.signalLog) ? saved.signalLog : [],
    events: Array.isArray(saved.events) ? saved.events : [],
    version: STATE_VERSION,
  };
  if (!isValidTimeZone(s.settings.timeZone)) s.settings.timeZone = 'UTC';
  if (s.settings.minScore < MIN_SCORE_FLOOR) s.settings.minScore = MIN_SCORE_FLOOR;
  // Reaplica a trava a partir dos contadores (defesa contra estado adulterado).
  const lock = lockFor(s.day);
  if (lock && !s.day.locked) s.day.locked = lock;
  if (s.day.locked) { s.active = false; s.activeSignal = null; }
  return s;
}

function log(s, now, level, msg, data) {
  const ev = { t: now, level, msg, ...(data ? { data } : {}) };
  s.events = [...s.events, ev].slice(-MAX_EVENTS);
}

function clone(s) { return structuredClone(s); }

export function canSignal(s) {
  if (s.day.locked) return LOCK_MESSAGES[s.day.locked];
  if (!s.active) return 'Painel desativado';
  if (s.openTrade) return 'Aguardando resultado da operação aberta';
  if (s.activeSignal) return 'Já existe um sinal em aberto';
  return null;
}

function applyTick(s, now) {
  const { day, rolled } = rollDay(s.day, now, s.settings.timeZone);
  if (rolled) {
    log(s, now, 'info', `Novo dia ${day.key}: contadores reiniciados`);
    s.day = day;
  }
  if (s.activeSignal && now > s.activeSignal.entryTime + s.settings.signalTtlSec * 1000) {
    log(s, now, 'warn', `Sinal ${s.activeSignal.direction} ${s.activeSignal.symbol} expirou sem confirmação`);
    markSignal(s, s.activeSignal.id, { userAction: 'expired' });
    s.activeSignal = null;
  }
}

function markSignal(s, id, patch) {
  s.signalLog = s.signalLog.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

/**
 * @returns {{state:object, error?:string}}
 */
export function reduce(prev, action, now = Date.now()) {
  const s = clone(prev);
  applyTick(s, now);
  const fail = (error) => {
    // Erros também ficam registrados, mas o estado (com tick aplicado) é devolvido.
    if (action.type !== 'TICK') log(s, now, 'warn', `Ação ${action.type} recusada: ${error}`);
    return { state: s, error };
  };

  switch (action.type) {
    case 'TICK':
      return { state: s };

    case 'SET_ACTIVE': {
      if (action.value) {
        if (s.day.locked) return fail(`${LOCK_MESSAGES[s.day.locked]} — bloqueado até o próximo dia`);
        const amtErr = checkAmount(s.settings.amount, s.day);
        if (amtErr) return fail(amtErr);
        s.active = true;
        log(s, now, 'info', 'Painel ATIVADO');
      } else {
        s.active = false;
        if (s.activeSignal) { markSignal(s, s.activeSignal.id, { userAction: 'cancelled' }); s.activeSignal = null; }
        log(s, now, 'info', 'Painel DESATIVADO (novos sinais interrompidos)');
      }
      return { state: s };
    }

    case 'SET_AMOUNT': {
      if (s.openTrade) return fail('Não é possível alterar o valor com uma operação aberta');
      const amount = Number(action.value);
      const err = checkAmount(amount, s.day);
      if (err) return fail(err);
      s.settings.amount = Math.round(amount * 100) / 100;
      log(s, now, 'info', `Valor por operação: ${s.settings.amount.toFixed(2)}`);
      return { state: s };
    }

    case 'SET_SETTINGS': {
      const v = action.value || {};
      if (v.timeZone !== undefined && v.timeZone !== s.settings.timeZone) {
        if (!isValidTimeZone(v.timeZone)) return fail('Fuso horário inválido');
        const today = s.day.greens + s.day.losses + s.day.draws;
        if (s.day.locked || today > 0 || s.openTrade) return fail('O fuso só pode ser alterado em um dia sem operações e sem bloqueio');
        s.settings.timeZone = v.timeZone;
        // Mantém a data atual se a nova for anterior (não reinicia contadores para trás).
        const k = dayKey(now, v.timeZone);
        if (k > s.day.key) s.day = newDay(k);
      }
      if (v.minScore !== undefined) {
        const m = Number(v.minScore);
        if (!Number.isFinite(m) || m < MIN_SCORE_FLOOR || m > 100) return fail(`Pontuação mínima deve ficar entre ${MIN_SCORE_FLOOR} e 100`);
        s.settings.minScore = Math.round(m);
      }
      if (v.symbol !== undefined) {
        if (s.openTrade || s.activeSignal) return fail('Troque o ativo sem sinal ou operação em aberto');
        if (!/^[A-Z0-9]{5,20}$/.test(v.symbol)) return fail('Símbolo inválido');
        s.settings.symbol = v.symbol;
      }
      if (v.payout !== undefined) {
        const p = Number(v.payout);
        if (!Number.isFinite(p) || p <= 0 || p > 1.5) return fail('Payout inválido (use fração, ex.: 0.85)');
        s.settings.payout = p;
      }
      if (v.signalTtlSec !== undefined) {
        const t = Number(v.signalTtlSec);
        if (!Number.isFinite(t) || t < 3 || t > 30) return fail('Validade do sinal deve ficar entre 3 e 30 s');
        s.settings.signalTtlSec = Math.round(t);
      }
      if (v.panel) s.settings.panel = { ...s.settings.panel, ...v.panel };
      if (!v.panel) log(s, now, 'info', 'Configurações atualizadas', v);
      return { state: s };
    }

    case 'PROPOSE_SIGNAL': {
      const sig = action.signal;
      const block = canSignal(s);
      if (block) return fail(block);
      if (action.pageMode === 'REAL' && s.account.mode !== 'REAL') return fail('Página da Quotex parece estar em conta REAL, mas o bot está em DEMO');
      if (!sig || typeof sig.id !== 'string' || !['CALL', 'PUT'].includes(sig.direction)) return fail('Sinal inválido');
      if (sig.symbol !== s.settings.symbol) return fail('Sinal de ativo diferente do configurado');
      if (sig.score < s.settings.minScore) return fail('Pontuação abaixo do mínimo');
      if (sig.id === s.lastSignalId || s.signalLog.some((x) => x.id === sig.id)) return fail('Sinal duplicado');
      if (now > sig.entryTime + s.settings.signalTtlSec * 1000 || now < sig.entryTime - 5000) return fail('Sinal desatualizado');
      const rec = { ...sig, createdAt: now, mode: s.account.mode, userAction: 'pending', outcome: null };
      s.activeSignal = rec;
      s.lastSignalId = sig.id;
      s.signalLog = [...s.signalLog, rec].slice(-MAX_SIGNALS);
      log(s, now, 'signal', `Sinal ${sig.direction} ${sig.symbol} (${sig.score} pts)`);
      return { state: s };
    }

    case 'DISMISS_SIGNAL': {
      if (!s.activeSignal || s.activeSignal.id !== action.signalId) return fail('Nenhum sinal correspondente');
      markSignal(s, s.activeSignal.id, { userAction: 'dismissed' });
      log(s, now, 'info', 'Sinal ignorado pelo usuário');
      s.activeSignal = null;
      return { state: s };
    }

    case 'CONFIRM_ENTRY': {
      const sig = s.activeSignal;
      if (!sig || sig.id !== action.signalId) return fail('Sinal não está mais disponível (expirado ou já usado)');
      if (!s.active) return fail('Painel desativado');
      if (s.day.locked) return fail(LOCK_MESSAGES[s.day.locked]);
      if (s.openTrade) return fail('Já existe operação aberta');
      const amtErr = checkAmount(s.settings.amount, s.day);
      if (amtErr) return fail(amtErr);
      s.openTrade = {
        id: `T-${sig.id}`, signalId: sig.id, symbol: sig.symbol, direction: sig.direction, score: sig.score,
        amount: s.settings.amount, mode: s.account.mode, confirmedAt: now,
        entryTime: sig.entryTime, expiryTime: sig.expiryTime, suggested: null,
      };
      markSignal(s, sig.id, { userAction: 'taken' });
      s.activeSignal = null;
      log(s, now, 'trade', `Entrada confirmada: ${sig.direction} ${sig.symbol} valor ${s.settings.amount.toFixed(2)} (${s.account.mode})`);
      return { state: s };
    }

    case 'SUGGEST_RESULT': {
      if (!s.openTrade || s.openTrade.id !== action.tradeId) return { state: s };
      s.openTrade.suggested = action.suggested; // { result, entryPrice, exitPrice }
      return { state: s };
    }

    case 'RECORD_RESULT': {
      const t = s.openTrade;
      if (!t || t.id !== action.tradeId) return fail('Nenhuma operação aberta correspondente');
      if (!['GREEN', 'LOSS', 'DRAW'].includes(action.result)) return fail('Resultado inválido');
      if (now < t.expiryTime) return fail('A operação ainda não expirou');
      const rec = { ...t, result: action.result, time: t.entryTime, recordedAt: now, dayKey: s.day.key };
      s.trades = [...s.trades, rec].slice(-MAX_TRADES);
      s.openTrade = null;
      if (action.result === 'GREEN') s.day.greens++;
      else if (action.result === 'LOSS') {
        s.day.losses++;
        s.day.amountCap = s.day.amountCap == null ? t.amount : Math.min(s.day.amountCap, t.amount);
      } else s.day.draws++;
      log(s, now, action.result === 'LOSS' ? 'loss' : 'green', `Resultado ${action.result}: ${t.direction} ${t.symbol}`);
      const lock = lockFor(s.day);
      if (lock) {
        s.day.locked = lock; s.day.lockedAt = now; s.active = false;
        if (s.activeSignal) { markSignal(s, s.activeSignal.id, { userAction: 'cancelled' }); s.activeSignal = null; }
        log(s, now, 'lock', `${LOCK_MESSAGES[lock]} — bloqueado até o próximo dia`);
      }
      return { state: s };
    }

    case 'SIGNAL_OUTCOMES': {
      // Resultado medido na fonte de dados (para estatística), não altera contadores.
      const map = new Map((action.outcomes || []).map((o) => [o.id, o]));
      s.signalLog = s.signalLog.map((x) => (map.has(x.id) && !x.outcome ? { ...x, ...map.get(x.id) } : x));
      return { state: s };
    }

    case 'SET_MODE': {
      if (action.mode === 'DEMO') {
        if (s.openTrade) return fail('Feche a operação aberta antes de trocar de conta');
        s.account.mode = 'DEMO';
        log(s, now, 'info', 'Modo DEMO');
        return { state: s };
      }
      if (action.mode !== 'REAL') return fail('Modo inválido');
      if (s.openTrade) return fail('Feche a operação aberta antes de trocar de conta');
      const r = realReadiness(s, now);
      if (!r.ready) return fail('Validação DEMO incompleta: ' + r.checks.filter((c) => !c.ok).map((c) => c.label).join('; '));
      if (action.confirmation !== REAL_CONFIRM_PHRASE) return fail('Confirmação expressa ausente ou incorreta');
      s.account.mode = 'REAL';
      s.account.realUnlockedAt = now;
      log(s, now, 'warn', 'Modo REAL habilitado pelo usuário após validação');
      return { state: s };
    }

    case 'LOG': {
      log(s, now, action.level || 'info', String(action.msg).slice(0, 300));
      return { state: s };
    }

    default:
      return fail(`Ação desconhecida: ${action.type}`);
  }
}
