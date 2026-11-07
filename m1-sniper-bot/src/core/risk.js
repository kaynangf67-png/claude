/*
 * M1 SNIPER BOT — Gerenciamento de risco diário (puro, testável).
 *  - Meta: 10 GREEN/dia → bloqueio até o dia seguinte.
 *  - Limite: 3 LOSS/dia → bloqueio até o dia seguinte.
 *  - Dia = data LOCAL do usuário (YYYY-MM-DD). O estado é persistido pelo controlador,
 *    então o bloqueio continua valendo depois de reiniciar o navegador.
 *  - Sem martingale: depois de um LOSS o valor da operação não pode subir no mesmo dia.
 *  - Sem duplicidade: uma operação aberta por vez e cada sinal só pode ser operado uma vez.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.M1 = root.M1 || {};
  root.M1.Risk = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LIMITS = Object.freeze({ dailyGreens: 10, dailyLosses: 3 });

  function localDateKey(d) {
    const x = d instanceof Date ? d : new Date(d);
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  }

  function createState(now) {
    return {
      dateKey: localDateKey(now),
      greens: 0,
      losses: 0,
      draws: 0,
      stakeCap: null,         // teto do valor após o 1º LOSS do dia
      openTradeId: null,
      tradedSignalIds: [],
    };
  }

  /** Se a data local mudou, zera o dia. Operação aberta de outro dia é descartada do estado diário. */
  function rollover(state, now) {
    const key = localDateKey(now);
    if (!state || state.dateKey !== key) return { state: createState(now), rolled: true };
    return { state, rolled: false };
  }

  function lockReason(state) {
    if (state.greens >= LIMITS.dailyGreens) return { code: 'GOAL', reason: `Meta diária atingida (${LIMITS.dailyGreens} GREEN). Bloqueado até amanhã.` };
    if (state.losses >= LIMITS.dailyLosses) return { code: 'STOP', reason: `Limite diário de ${LIMITS.dailyLosses} LOSS atingido. Bloqueado até amanhã.` };
    return null;
  }

  /** Pode gerar/aceitar novos sinais? */
  function check(state, ctx) {
    const lock = lockReason(state);
    if (lock) return Object.assign({ ok: false }, lock);
    if (!ctx || !ctx.active) return { ok: false, code: 'OFF', reason: 'Painel desativado.' };
    if (state.openTradeId) return { ok: false, code: 'OPEN', reason: 'Já existe uma operação em andamento.' };
    return { ok: true, code: 'OK', reason: '' };
  }

  function registerEntry(state, signalId, ctx) {
    const c = check(state, ctx);
    if (!c.ok) return { ok: false, state, reason: c.reason };
    if (state.tradedSignalIds.includes(signalId)) return { ok: false, state, reason: 'Este sinal já foi operado (duplicidade bloqueada).' };
    return {
      ok: true,
      reason: '',
      state: Object.assign({}, state, {
        openTradeId: signalId,
        tradedSignalIds: state.tradedSignalIds.concat(signalId).slice(-200),
      }),
    };
  }

  /** Cancela a operação aberta sem resultado (ex.: usuário não entrou de fato). */
  function cancelEntry(state, signalId) {
    if (state.openTradeId !== signalId) return state;
    return Object.assign({}, state, { openTradeId: null });
  }

  function registerResult(state, signalId, result, stake) {
    if (state.openTradeId !== signalId) return { ok: false, state, reason: 'Operação não está aberta.' };
    if (!['GREEN', 'LOSS', 'EMPATE'].includes(result)) return { ok: false, state, reason: 'Resultado inválido.' };
    const s = Object.assign({}, state, { openTradeId: null });
    if (result === 'GREEN') s.greens += 1;
    if (result === 'LOSS') {
      s.losses += 1;
      s.stakeCap = s.stakeCap == null ? stake : Math.min(s.stakeCap, stake);
    }
    if (result === 'EMPATE') s.draws += 1;
    return { ok: true, state: s, reason: '' };
  }

  function canSetStake(state, newStake) {
    if (!Number.isFinite(newStake) || newStake <= 0) return { ok: false, reason: 'Valor inválido.' };
    if (state.openTradeId) return { ok: false, reason: 'Não é possível alterar o valor com operação em andamento.' };
    if (state.stakeCap != null && newStake > state.stakeCap)
      return { ok: false, reason: `Após LOSS o valor não pode subir hoje (máximo ${state.stakeCap}). Sem martingale.` };
    return { ok: true, reason: '' };
  }

  return { LIMITS, localDateKey, createState, rollover, check, lockReason, registerEntry, cancelEntry, registerResult, canSetStake };
});
