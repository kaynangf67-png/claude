// Estado da aplicação + redutor puro. TODA mutação passa por `reduce`, que
// aplica as regras de risco. O service worker é o único que grava o estado.
import { rollDay, lockFor, checkAmount, newDay, LOCK_MESSAGES, MIN_SCORE_FLOOR } from './risk.js';
import { realReadiness, REAL_CONFIRM_PHRASE } from './stats.js';
import { dayKey } from './time.js';

export const STATE_VERSION = 1;
const MAX_TRADES = 5000, MAX_SIGNALS = 5000, MAX_EVENTS = 400;

export const DEFAULT_SETTINGS = Object.freeze({
  amount: 1,
  timeZone: 'America/Sao_Paulo',
  tzMigrated: true,
  minScore: 80,
  symbol: 'BTCUSDT',
  payout: 0.85,          // payout informado pelo usuário (usado só nas estatísticas)
  signalTtlSec: 15,      // segundos após a abertura do candle de entrada em que o sinal ainda vale
  panel: { x: null, y: 16, minimized: false, chart: true },
  // Calibração dos elementos da Quotex (seletores CSS gravados pelo usuário).
  calib: { price: null, asset: null, amount: null, call: null, put: null },
  // Fonte das velas: 'quotex' = preço lido da tela da Quotex (inclui OTC); 'binance' = API pública.
  feed: 'quotex',
  // Somente sinais: o bot NUNCA clica na Quotex (pedido do usuário). AUTO bloqueado.
  signalsOnly: true,
  // De onde vêm os sinais: 'bot' (estratégia do bot) ou 'tradingview' (alertas do seu script no TradingView).
  signalSource: 'bot',
  // Estratégia de sinais: 'priceAction' (S/R, pullback, Fibonacci, tendência),
  // 'sniperPro' (script Pine do usuário) ou 'padrao' (indicadores 0–100).
  strategy: 'priceAction',
  // Execução automática: só vale no dia em que foi armada.
  auto: { armedDay: null, expiryConfirmed: false },
});

export const AUTO_ENTRY_WINDOW_MS = 6000; // auto só entra nos primeiros 6 s da vela de entrada
export const AUTO_ABORT_WINDOW_MS = 15000;

export function calibComplete(s) {
  const c = s.settings.calib || {};
  // Ativo, valor, % e tempo são lidos do painel de operação ao lado do botão CALL.
  return !!(c.call && c.put);
}

export function autoArmed(s) {
  return s.settings.auto?.armedDay === s.day.key && !!s.settings.auto?.expiryConfirmed && calibComplete(s);
}

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo'; // horário de Brasília

export function initialState(now = Date.now()) {
  const timeZone = DEFAULT_TIME_ZONE;
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS, timeZone, panel: { ...DEFAULT_SETTINGS.panel }, calib: { ...DEFAULT_SETTINGS.calib }, auto: { ...DEFAULT_SETTINGS.auto } },
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
    settings: {
      ...base.settings, ...(saved.settings || {}),
      panel: { ...base.settings.panel, ...(saved.settings?.panel || {}) },
      calib: { ...base.settings.calib, ...(saved.settings?.calib || {}) },
      auto: { ...base.settings.auto, ...(saved.settings?.auto || {}) },
    },
    account: { ...base.account, ...(saved.account || {}) },
    day: saved.day && typeof saved.day.key === 'string' ? { ...newDay(saved.day.key), ...saved.day } : base.day,
    trades: Array.isArray(saved.trades) ? saved.trades : [],
    signalLog: Array.isArray(saved.signalLog) ? saved.signalLog : [],
    events: Array.isArray(saved.events) ? saved.events : [],
    version: STATE_VERSION,
  };
  // Fuso FIXO: horário de Brasília. Seguro para instalações antigas (UTC):
  // o dia de Brasília nunca está à frente, então nada é zerado nem desbloqueado.
  if (s.settings.timeZone !== DEFAULT_TIME_ZONE) {
    s.settings.timeZone = DEFAULT_TIME_ZONE;
    const k = dayKey(now, DEFAULT_TIME_ZONE);
    const empty = !s.day.locked && !s.openTrade && s.day.greens + s.day.losses + s.day.draws === 0;
    if (k < s.day.key && empty) s.day = newDay(k);
  }
  s.settings.tzMigrated = true;
  // v1.15: somente sinais (sem operar sozinho), aplicado uma vez; desarma o AUTO.
  if (!saved.settings?.signalsOnlyV1) { s.settings.signalsOnly = true; s.settings.auto = { ...s.settings.auto, armedDay: null }; s.settings.signalsOnlyV1 = true; }
  // v1.13: estratégia padrão passa a ser price action (pedido do usuário); aplica uma vez.
  if (!saved.settings?.strategyPAv1) { s.settings.strategy = 'priceAction'; s.settings.strategyPAv1 = true; }
  // v1.9.4: preço passa a ser automático; descarta a escolha manual antiga uma vez.
  if (!saved.settings?.priceAutoV1) {
    if (typeof s.settings.calib?.price === 'string' && s.settings.calib.price.includes('"kind":"canvas"')) s.settings.calib = { ...s.settings.calib, price: null };
    s.settings.priceAutoV1 = true;
  }
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
        s.settings.auto = { ...s.settings.auto, armedDay: null };
        if (s.activeSignal) { markSignal(s, s.activeSignal.id, { userAction: 'cancelled' }); s.activeSignal = null; }
        log(s, now, 'info', 'Painel DESATIVADO (novos sinais e automático interrompidos)');
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
      if (v.timeZone !== undefined && v.timeZone !== DEFAULT_TIME_ZONE) return fail('O horário é fixo: Brasília');
      if (v.minScore !== undefined) {
        const m = Number(v.minScore);
        if (!Number.isFinite(m) || m < MIN_SCORE_FLOOR || m > 100) return fail(`Pontuação mínima deve ficar entre ${MIN_SCORE_FLOOR} e 100`);
        s.settings.minScore = Math.round(m);
      }
      if (v.symbol !== undefined) {
        if (s.openTrade || s.activeSignal) return fail('Troque o ativo sem sinal ou operação em aberto');
        if (!/^([A-Z0-9]{5,20}|QX:[^<>]{2,40})$/.test(v.symbol)) return fail('Símbolo inválido');
        s.settings.symbol = v.symbol;
      }
      if (v.signalSource !== undefined) {
        if (!['bot', 'tradingview'].includes(v.signalSource)) return fail('Fonte de sinais inválida');
        s.settings.signalSource = v.signalSource;
      }
      if (v.signalsOnly !== undefined) {
        if (s.openTrade) return fail('Espere a operação aberta terminar');
        s.settings.signalsOnly = !!v.signalsOnly;
        if (s.settings.signalsOnly) s.settings.auto = { ...s.settings.auto, armedDay: null };
        log(s, now, 'warn', s.settings.signalsOnly ? 'Operação automática DESLIGADA (somente sinais)' : 'Operação automática PERMITIDA (ainda precisa armar)');
      }
      if (v.strategy !== undefined) {
        if (!['priceAction', 'sniperPro', 'padrao'].includes(v.strategy)) return fail('Estratégia inválida');
        if (s.openTrade || s.activeSignal) return fail('Troque a estratégia sem sinal ou operação em aberto');
        s.settings.strategy = v.strategy;
      }
      if (v.feed !== undefined) {
        if (!['quotex', 'binance'].includes(v.feed)) return fail('Fonte inválida');
        if (s.openTrade || s.activeSignal) return fail('Troque a fonte sem sinal ou operação em aberto');
        s.settings.feed = v.feed;
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

    case 'SET_CALIB': {
      const { key, selector } = action;
      if (!['price', 'asset', 'amount', 'call', 'put'].includes(key)) return fail('Item de calibração inválido');
      if (selector !== null && (typeof selector !== 'string' || !selector || selector.length > 3000)) return fail('Seletor inválido');
      if (s.openTrade) return fail('Calibre sem operação aberta');
      s.settings.calib = { ...s.settings.calib, [key]: selector };
      s.settings.auto = { ...s.settings.auto, armedDay: null }; // mudou calibração → precisa armar de novo
      log(s, now, 'info', `Calibração ${key}: ${selector ? 'gravada' : 'apagada'}`);
      return { state: s };
    }

    case 'SET_AUTO': {
      if (!action.armed) {
        s.settings.auto = { ...s.settings.auto, armedDay: null };
        log(s, now, 'info', 'Automático DESARMADO');
        return { state: s };
      }
      if (s.settings.signalsOnly !== false) return fail('Modo somente sinais: o bot não opera sozinho');
      if (s.day.locked) return fail(LOCK_MESSAGES[s.day.locked]);
      if (!s.active) return fail('Ligue o painel antes de armar o automático');
      if (!calibComplete(s)) return fail('Calibre os botões Comprar (CALL) e Vender (PUT) antes de armar');
      if (!action.expiryConfirmed) return fail('Confirme que a expiração na Quotex está em 1 minuto');
      s.settings.auto = { armedDay: s.day.key, expiryConfirmed: true };
      log(s, now, 'warn', `Automático ARMADO (${s.account.mode}) — o bot vai clicar CALL/PUT sozinho`);
      return { state: s };
    }

    case 'AUTO_ENTRY': {
      const sig = s.activeSignal;
      if (s.settings.signalsOnly !== false) return fail('Modo somente sinais');
      if (!autoArmed(s)) return fail('Automático não está armado');
      if (!sig || sig.id !== action.signalId) return fail('Sinal não está mais disponível');
      if (!s.active) return fail('Painel desativado');
      if (s.day.locked) return fail(LOCK_MESSAGES[s.day.locked]);
      if (s.openTrade) return fail('Já existe operação aberta');
      if (now > sig.entryTime + AUTO_ENTRY_WINDOW_MS) return fail('Tarde demais para entrada automática');
      if (action.pageMode !== s.account.mode) return fail(`Conta da página (${action.pageMode}) ≠ modo do bot (${s.account.mode})`);
      if (action.pageAsset !== sig.symbol) return fail('Mercado aberto na Quotex não é o indicado');
      if (action.pageExpirySec != null && action.pageExpirySec !== 60) return fail(`Tempo na Quotex não é 1 minuto (${action.pageExpirySec}s)`);
      if (Math.abs(Number(action.pageAmount) - s.settings.amount) > 0.001) return fail(`Valor na Quotex (${action.pageAmount}) ≠ valor do bot (${s.settings.amount.toFixed(2)})`);
      const amtErr = checkAmount(s.settings.amount, s.day);
      if (amtErr) return fail(amtErr);
      s.openTrade = {
        id: `T-${sig.id}`, signalId: sig.id, symbol: sig.symbol, direction: sig.direction, score: sig.score,
        amount: s.settings.amount, mode: s.account.mode, confirmedAt: now, auto: true,
        entryTime: sig.entryTime, expiryTime: now + 60_000, suggested: null,
      };
      markSignal(s, sig.id, { userAction: 'auto' });
      s.activeSignal = null;
      log(s, now, 'trade', `AUTO: clicando ${sig.direction} ${sig.symbol} valor ${s.settings.amount.toFixed(2)} (${s.account.mode})`);
      return { state: s };
    }

    case 'ABORT_AUTO_TRADE': {
      const t = s.openTrade;
      if (!t || t.id !== action.tradeId || !t.auto) return fail('Nenhuma operação automática correspondente');
      if (now > t.confirmedAt + AUTO_ABORT_WINDOW_MS) return fail('Janela para cancelar expirou');
      s.openTrade = null;
      markSignal(s, t.signalId, { userAction: 'auto_failed' });
      s.settings.auto = { ...s.settings.auto, armedDay: null };
      log(s, now, 'warn', `AUTO falhou ao clicar (${String(action.reason || '').slice(0, 120)}). Automático desarmado.`);
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
      const rec = { ...t, result: action.result, time: t.entryTime, recordedAt: now, dayKey: s.day.key, recordedBy: action.by === 'auto' ? 'auto' : 'user' };
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
        s.settings.auto = { ...s.settings.auto, armedDay: null };
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
