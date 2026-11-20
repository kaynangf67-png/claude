// Cálculos puros do Trade Calendar (sem DOM), testáveis em Node.

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const pad = (n) => String(n).padStart(2, '0');

export function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
}
export function todayParts(now = new Date()) {
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}
export function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
export function firstWeekday(y, m) { return new Date(y, m, 1).getDay(); }

/** Arredonda para centavos evitando erros de ponto flutuante. */
export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/** Resultado líquido de um registro. Dias sem operação valem 0. */
export function netOf(entry) {
  if (!entry || entry.noTrade) return 0;
  return round2((entry.gain || 0) - (entry.loss || 0));
}

/** Normaliza um registro vindo do formulário ou de um backup. Retorna null se inválido. */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v) => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) && n > 0 ? round2(n) : 0;
  };
  const noTrade = Boolean(raw.noTrade);
  const ops = Math.max(0, Math.min(9999, Math.floor(Number(raw.ops) || 0)));
  const notes = typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '';
  return {
    gain: noTrade ? 0 : num(raw.gain),
    loss: noTrade ? 0 : num(raw.loss),
    ops: noTrade ? 0 : ops,
    notes,
    noTrade,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

/** Lista os registros de um período (ordenados por data). */
export function entriesIn(entries, { year, month } = {}) {
  const out = [];
  for (const key of Object.keys(entries)) {
    const p = parseKey(key);
    if (year !== undefined && p.y !== year) continue;
    if (month !== undefined && p.m !== month) continue;
    out.push({ key, ...p, entry: entries[key], net: netOf(entries[key]) });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

/**
 * Resumo de um conjunto de dias.
 * - lucro/prejuízo: soma dos resultados líquidos dos dias positivos / negativos
 * - taxa de acerto: dias positivos ÷ (dias positivos + dias negativos)
 */
export function summarize(list) {
  let profit = 0, loss = 0, gross = 0, grossLoss = 0, pos = 0, neg = 0, flat = 0, noTrade = 0, ops = 0;
  let best = null, worst = null;
  for (const it of list) {
    if (it.entry.noTrade) { noTrade++; continue; }
    const n = it.net;
    gross += it.entry.gain || 0;
    grossLoss += it.entry.loss || 0;
    ops += it.entry.ops || 0;
    if (n > 0) { profit += n; pos++; } else if (n < 0) { loss += n; neg++; } else { flat++; }
    if (n > 0 && (!best || n > best.net)) best = it;
    if (n < 0 && (!worst || n < worst.net)) worst = it;
  }
  const decided = pos + neg;
  const traded = pos + neg + flat;
  return {
    profit: round2(profit),
    loss: round2(loss), // negativo
    net: round2(profit + loss),
    grossGain: round2(gross),
    grossLoss: round2(grossLoss),
    positiveDays: pos,
    negativeDays: neg,
    flatDays: flat,
    noTradeDays: noTrade,
    tradedDays: traded,
    ops,
    winRate: decided ? pos / decided : null,
    avgProfit: pos ? round2(profit / pos) : null,
    avgLoss: neg ? round2(loss / neg) : null,
    avgPerDay: traded ? round2((profit + loss) / traded) : null,
    best,
    worst,
  };
}

/** Série acumulada para o gráfico de evolução. */
export function cumulative(points) {
  let acc = 0;
  return points.map((p) => { acc = round2(acc + p.value); return { ...p, total: acc }; });
}

/** Resultado por mês de um ano: 12 posições. */
export function monthlyTotals(entries, year) {
  return MONTHS.map((_, m) => ({ month: m, ...summarize(entriesIn(entries, { year, month: m })) }));
}

/** Anos com registro, em ordem crescente. */
export function yearsWithData(entries) {
  return [...new Set(Object.keys(entries).map((k) => parseKey(k).y))].sort((a, b) => a - b);
}

// ---------- formatação ----------
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const plain2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MINUS = '−';
/** R$ 1.234,56 (com sinal opcional). */
export function money(v, { sign = false } = {}) {
  const s = brl.format(Math.abs(v)).replace(/ /g, ' ');
  if (v < 0) return MINUS + s;
  if (sign && v > 0) return '+' + s;
  return s;
}
/** Versão curta para espaços pequenos: R$ 12,3 mil */
export function moneyShort(v, { sign = false } = {}) {
  const a = Math.abs(v);
  let s;
  if (a >= 1e6) s = 'R$ ' + dec1.format(a / 1e6) + ' mi';
  else if (a >= 1e4) s = 'R$ ' + dec1.format(a / 1e3) + ' mil';
  else return money(v, { sign });
  if (v < 0) return MINUS + s;
  return (sign && v > 0 ? '+' : '') + s;
}
/** Valor dentro da célula do calendário (sem R$, sem centavos): +1.250 / −320 / +12,5k */
export function cellValue(v) {
  const a = Math.abs(v);
  let s;
  if (a >= 1e5) s = int.format(a / 1e3) + 'k';
  else if (a >= 1e4) s = dec1.format(a / 1e3) + 'k';
  else if (a > 0 && a < 1) s = plain2.format(a);
  else s = int.format(Math.round(a));
  return (v > 0 ? '+' : v < 0 ? MINUS : '') + s;
}
export function decimal(v) { return plain2.format(v); }
export function percent(r) { return r == null ? '—' : int.format(Math.round(r * 100)) + '%'; }

/** Converte texto digitado (ex. "1.234,56", "1234.5") em número. */
export function parseMoney(text) {
  if (typeof text !== 'string') return 0;
  let t = text.replace(/[^\d.,]/g, '');
  if (!t) return 0;
  const lastComma = t.lastIndexOf(','), lastDot = t.lastIndexOf('.');
  const sep = Math.max(lastComma, lastDot);
  if (sep >= 0 && t.length - sep - 1 <= 2) {
    t = t.slice(0, sep).replace(/[.,]/g, '') + '.' + t.slice(sep + 1);
  } else {
    t = t.replace(/[.,]/g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) ? round2(n) : 0;
}

export function longDate(y, m, d) {
  const wd = WEEKDAYS_SHORT[new Date(y, m, d).getDay()];
  return `${wd[0].toUpperCase() + wd.slice(1)}, ${d} de ${MONTHS_SHORT[m]}. de ${y}`;
}
