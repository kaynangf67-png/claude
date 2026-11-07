// Verificação de dados de candles antes de qualquer análise.

export const M1_MS = 60_000;

export function isValidCandle(c) {
  if (!c || typeof c !== 'object') return false;
  const nums = [c.time, c.open, c.high, c.low, c.close];
  if (!nums.every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
  if (c.open <= 0 || c.close <= 0 || c.low <= 0) return false;
  if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) return false;
  if (c.time % M1_MS !== 0) return false;
  return true;
}

/**
 * Valida a série: candles válidos, ordenados, espaçados exatamente 1 min e sem
 * lacunas na janela exigida (`required` últimos candles).
 */
export function validateSeries(candles, required) {
  if (!Array.isArray(candles)) return { ok: false, reason: 'Série inválida' };
  if (candles.length < required) {
    return { ok: false, reason: `Histórico insuficiente (${candles.length}/${required} candles)` };
  }
  const start = candles.length - required;
  for (let i = start; i < candles.length; i++) {
    if (!isValidCandle(candles[i])) return { ok: false, reason: `Candle inválido em ${new Date(candles[i]?.time).toISOString?.() ?? i}` };
    if (i > start && candles[i].time - candles[i - 1].time !== M1_MS) {
      return { ok: false, reason: 'Lacuna/desordem nos candles (possível perda de conexão)' };
    }
  }
  return { ok: true };
}

/** Mantém apenas candles cujo minuto já terminou em `now`. */
export function closedOnly(candles, now) {
  return candles.filter((c) => c.time + M1_MS <= now);
}

/** Mescla candles novos numa série existente (por `time`), mantendo no máx. `max`. */
export function mergeCandles(base, incoming, max = 600) {
  const map = new Map(base.map((c) => [c.time, c]));
  for (const c of incoming) map.set(c.time, c);
  const out = [...map.values()].sort((a, b) => a.time - b.time);
  return out.length > max ? out.slice(out.length - max) : out;
}
