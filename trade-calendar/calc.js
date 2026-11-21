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
    followed: raw.followed === true ? true : raw.followed === false ? false : null,
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
    positiveRate: traded ? pos / traded : null,
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

// ---------- datas e períodos (chaves AAAA-MM-DD comparáveis como texto) ----------
export function fromKey(key) { const { y, m, d } = parseKey(key); return new Date(y, m, d); }
export function keyOf(dt) { return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
export function todayKey(now = new Date()) { return keyOf(now); }
export function addDaysKey(key, n) { const dt = fromKey(key); dt.setDate(dt.getDate() + n); return keyOf(dt); }
/** Segunda-feira da semana da data. */
export function weekStartKey(key) { const dt = fromKey(key); dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); return keyOf(dt); }
export function monthStartKey(key) { const { y, m } = parseKey(key); return dateKey(y, m, 1); }
export function monthEndKey(y, m) { return dateKey(y, m, daysInMonth(y, m)); }
export function daysBetween(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 864e5); }

/** Registros entre start e end (inclusive), ordenados por data. */
export function entriesInRange(entries, start, end) {
  const out = [];
  for (const key of Object.keys(entries)) {
    if (key < start || key > end) continue;
    out.push({ key, ...parseKey(key), entry: entries[key], net: netOf(entries[key]) });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : 1));
  return out;
}

export const PERIODS = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Esta semana' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'custom', label: 'Personalizado' },
];

/** Intervalo {start, end} de cada período, sempre relativo a "hoje". */
export function periodRange(id, today, custom) {
  switch (id) {
    case 'today': return { start: today, end: today };
    case 'week': return { start: weekStartKey(today), end: today };
    case '30d': return { start: addDaysKey(today, -29), end: today };
    case 'month': return { start: monthStartKey(today), end: today };
    case 'lastMonth': {
      const { y, m } = parseKey(today);
      const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
      return { start: dateKey(py, pm, 1), end: monthEndKey(py, pm) };
    }
    case 'custom': {
      if (custom && /^\d{4}-\d{2}-\d{2}$/.test(custom.start) && /^\d{4}-\d{2}-\d{2}$/.test(custom.end)) {
        return custom.start <= custom.end ? { start: custom.start, end: custom.end } : { start: custom.end, end: custom.start };
      }
      return { start: monthStartKey(today), end: today };
    }
    default: return { start: today, end: today };
  }
}

/** Pares de períodos para a seção "Comparação de desempenho". */
export function comparisons(today) {
  const ws = weekStartKey(today);
  return [
    { id: 'day', title: 'Hoje vs. ontem', curName: 'Hoje', prevName: 'Ontem',
      cur: { start: today, end: today }, prev: { start: addDaysKey(today, -1), end: addDaysKey(today, -1) } },
    { id: 'week', title: 'Esta semana vs. semana passada', curName: 'Esta semana', prevName: 'Semana passada',
      cur: { start: ws, end: today }, prev: { start: addDaysKey(ws, -7), end: addDaysKey(ws, -1) } },
    { id: 'month', title: 'Este mês vs. mês passado', curName: 'Este mês', prevName: 'Mês passado',
      cur: periodRange('month', today), prev: periodRange('lastMonth', today) },
    { id: '30d', title: 'Últimos 30 dias vs. 30 anteriores', curName: 'Últimos 30 dias', prevName: '30 dias anteriores',
      cur: { start: addDaysKey(today, -29), end: today }, prev: { start: addDaysKey(today, -59), end: addDaysKey(today, -30) } },
  ];
}

/** Diferença em reais e variação percentual (null quando o anterior é zero). */
export function change(cur, prev) {
  const diff = round2(cur - prev);
  return { diff, pct: prev === 0 ? null : diff / Math.abs(prev) };
}

/** Agrupa os resultados para o gráfico: 'day' (só dias operados), 'week' (seg–dom) ou 'month'. */
export function buckets(list, mode, start, end) {
  if (mode === 'day') {
    return list.filter((i) => !i.entry.noTrade).map((i) => ({
      key: i.key, value: i.net, label: shortDate(i.key, true), short: `${i.d}/${i.m + 1}`,
    }));
  }
  const sums = new Map();
  for (const i of list) {
    if (i.entry.noTrade) continue;
    const k = mode === 'week' ? weekStartKey(i.key) : monthStartKey(i.key);
    sums.set(k, round2((sums.get(k) || 0) + i.net));
  }
  const out = [];
  if (mode === 'week') {
    for (let k = weekStartKey(start); k <= end; k = addDaysKey(k, 7)) {
      const p = parseKey(k), e = addDaysKey(k, 6);
      out.push({ key: k, value: sums.get(k) || 0, label: `Semana ${shortDate(k)} – ${shortDate(e)}`, short: `${p.d}/${p.m + 1}` });
    }
  } else {
    let { y, m } = parseKey(start);
    const last = parseKey(end);
    while (y < last.y || (y === last.y && m <= last.m)) {
      const k = dateKey(y, m, 1);
      out.push({ key: k, value: sums.get(k) || 0, label: `${MONTHS[m]} ${y}`, short: MONTHS_SHORT[m] });
      m++; if (m > 11) { m = 0; y++; }
    }
  }
  return out;
}

/** "20 de nov." (com ano opcional). */
export function shortDate(key, withYear = false) {
  const { y, m, d } = parseKey(key);
  return `${d} de ${MONTHS_SHORT[m]}.${withYear ? ' ' + y : ''}`;
}
/** Texto de um intervalo: "16 – 20 de nov.", "21 de out. – 20 de nov.", com ano quando diferente do atual. */
export function rangeLabel(start, end, currentYear) {
  const a = parseKey(start), b = parseKey(end);
  const yr = (p) => (p.y !== currentYear ? ' de ' + p.y : '');
  if (start === end) return `${a.d} de ${MONTHS_SHORT[a.m]}.${yr(a)}`;
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} de ${MONTHS_SHORT[b.m]}.${yr(b)}`;
  if (a.y === b.y) return `${a.d} de ${MONTHS_SHORT[a.m]}. – ${b.d} de ${MONTHS_SHORT[b.m]}.${yr(b)}`;
  return `${a.d}/${a.m + 1}/${a.y} – ${b.d}/${b.m + 1}/${b.y}`;
}

// ---------- gerenciamento: plano do dia ----------
/**
 * Avalia um dia contra o plano { enabled, stop, target, maxOps } (0 = regra desligada).
 * Bater o stop exatamente é respeitar o plano; passar dele, não.
 */
export function evaluateDay(entry, plan) {
  const none = { status: 'none', reasons: [], hitStop: false, overStop: false, hitTarget: false, overOps: false, net: 0 };
  if (!plan || !plan.enabled || !entry || entry.noTrade) return none;
  const net = netOf(entry);
  const stop = plan.stop || 0, target = plan.target || 0, maxOps = plan.maxOps || 0;
  const hitStop = stop > 0 && net <= -stop;
  const overStop = stop > 0 && net < -stop - 0.005;
  const hitTarget = target > 0 && net >= target;
  const overOps = maxOps > 0 && (entry.ops || 0) > maxOps;
  const reasons = [];
  if (overStop) reasons.push('stop');
  if (overOps) reasons.push('ops');
  if (entry.followed === false) reasons.push('manual');
  return { status: reasons.length ? 'broken' : 'ok', reasons, hitStop, overStop, hitTarget, overOps, net };
}

/** Dias dentro e fora do plano num período, com a média de resultado de cada grupo. */
export function discipline(list, plan) {
  let ok = 0, broken = 0, sumOk = 0, sumBroken = 0;
  for (const it of list) {
    const ev = evaluateDay(it.entry, plan);
    if (ev.status === 'ok') { ok++; sumOk += ev.net; } else if (ev.status === 'broken') { broken++; sumBroken += ev.net; }
  }
  return {
    ok, broken,
    rate: ok + broken ? ok / (ok + broken) : null,
    avgOk: ok ? round2(sumOk / ok) : null,
    avgBroken: broken ? round2(sumBroken / broken) : null,
  };
}

/** Sequência de dias operados seguidos dentro do plano, contando para trás a partir de "hoje". */
export function disciplineStreak(entries, plan, today) {
  if (!plan || !plan.enabled) return 0;
  const keys = Object.keys(entries).filter((k) => k <= today).sort().reverse();
  let n = 0;
  for (const k of keys) {
    const ev = evaluateDay(entries[k], plan);
    if (ev.status === 'none') continue;
    if (ev.status === 'broken') break;
    n++;
  }
  return n;
}

// ---------- saldo da conta ----------
/** Limpa a configuração da conta: { initial, start, moves: [{ id, date, type: 'dep'|'wd', value }] }. */
export function normalizeAccount(raw) {
  const okDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? round2(n) : 0; };
  if (!raw || typeof raw !== 'object') return { initial: 0, start: null, moves: [] };
  const moves = (Array.isArray(raw.moves) ? raw.moves : [])
    .filter((m) => m && okDate(m.date) && (m.type === 'dep' || m.type === 'wd') && num(m.value) > 0)
    .map((m) => ({ id: String(m.id || `${m.date}-${m.type}-${m.value}`), date: m.date, type: m.type, value: num(m.value) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { initial: num(raw.initial), start: okDate(raw.start) ? raw.start : null, moves };
}
export const accountConfigured = (acc) => Boolean(acc && (acc.initial > 0 || (acc.moves && acc.moves.length)));

/**
 * Saldo ao fim do dia `upto` (inclusive):
 * saldo inicial + resultado dos dias registrados desde a data inicial + aportes − saques.
 */
export function accountBalance(entries, acc, upto) {
  const a = normalizeAccount(acc);
  const start = a.start || '0000-00-00';
  let trading = 0;
  for (const k of Object.keys(entries)) if (k >= start && k <= upto) trading += netOf(entries[k]);
  let deposits = 0, withdrawals = 0;
  for (const m of a.moves) {
    if (m.date < start || m.date > upto) continue;
    if (m.type === 'dep') deposits += m.value; else withdrawals += m.value;
  }
  trading = round2(trading); deposits = round2(deposits); withdrawals = round2(withdrawals);
  const invested = round2(a.initial + deposits);
  return {
    balance: round2(a.initial + trading + deposits - withdrawals),
    trading, deposits, withdrawals, invested,
    pct: invested > 0 ? trading / invested : null,
  };
}
