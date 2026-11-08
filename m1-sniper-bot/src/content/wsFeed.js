// Lê o histórico de velas e as cotações que a PÁGINA da Quotex recebe pelo
// WebSocket (repassados por canvasTap.js). Não envia nada à Quotex.
// O formato exato não é documentado: o leitor reconhece velas em vários formatos
// e valida cada uma (máxima >= abertura/fechamento >= mínima, espaçamento de 1 min).
import { parseAsset } from './quotexPage.js';
import { tapInfo } from './canvasText.js';

const M1 = 60_000;
const stats = { messages: 0, events: new Map(), samples: [], histories: [] };
const histories = new Map(); // ativo normalizado -> { candles, at }
const quotes = new Map();    // ativo normalizado -> { price, at }
const listeners = new Set();

/** "AUD/CHF (OTC)" -> "audchfotc"; "AUDCHF_otc" -> "audchfotc"; "Bitcoin (OTC)" -> "btcusdotc". */
export function normAsset(s) {
  if (!s) return '';
  const a = parseAsset(String(s));
  if (a && /[a-z]/i.test(a.base)) return (a.base + a.quote + (a.otc ? 'otc' : '')).toLowerCase();
  return String(s).toLowerCase().replace(/[^a-z]/g, '');
}

const toMs = (t) => (t > 1e12 ? t : t > 1e9 ? t * 1000 : null);

/** Lista de velas [t,a,b,c,d,...] ou objetos {time/open/high/low/close}. */
function asCandles(arr) {
  if (!Array.isArray(arr) || arr.length < 10) return null;
  const rows = arr.slice(0, 5000);
  if (rows.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    const k = (o, ...names) => names.find((n) => Number.isFinite(Number(o[n])));
    const sample = rows[0];
    const kt = k(sample, 'time', 't', 'timestamp', 'from'), ko = k(sample, 'open', 'o'), kh = k(sample, 'high', 'h', 'max'), kl = k(sample, 'low', 'l', 'min'), kc = k(sample, 'close', 'c');
    if (!kt || !ko || !kh || !kl || !kc) return null;
    return rows.map((o) => ({ time: toMs(Number(o[kt])), open: +o[ko], high: +o[kh], low: +o[kl], close: +o[kc] }));
  }
  if (!rows.every((r) => Array.isArray(r) && r.length >= 5 && r.slice(0, 5).every((v) => Number.isFinite(Number(v))))) return null;
  const orders = [
    { o: 1, c: 2, h: 3, l: 4 }, // tempo, abertura, fechamento, máxima, mínima
    { o: 1, h: 2, l: 3, c: 4 }, // tempo, abertura, máxima, mínima, fechamento
  ];
  for (const ord of orders) {
    const cs = rows.map((r) => ({ time: toMs(Number(r[0])), open: +r[ord.o], high: +r[ord.h], low: +r[ord.l], close: +r[ord.c] }));
    const valid = cs.filter((x) => x.time && x.high >= Math.max(x.open, x.close) - 1e-12 && x.low <= Math.min(x.open, x.close) + 1e-12).length;
    if (valid / cs.length >= 0.97) return cs;
  }
  return null;
}

/** Lista de ticks [t, preço, ...] densa -> velas M1. */
function ticksToCandles(arr) {
  if (!Array.isArray(arr) || arr.length < 30) return null;
  if (!arr.every((r) => Array.isArray(r) && r.length >= 2 && Number.isFinite(+r[0]) && Number.isFinite(+r[1]) && toMs(+r[0]))) return null;
  const map = new Map();
  for (const r of arr) {
    const t = toMs(+r[0]), p = +r[1];
    const m = Math.floor(t / M1) * M1;
    const c = map.get(m);
    if (!c) map.set(m, { time: m, open: p, high: p, low: p, close: p, first: t, last: t });
    else { if (t < c.first) { c.open = p; c.first = t; } if (t >= c.last) { c.close = p; c.last = t; } c.high = Math.max(c.high, p); c.low = Math.min(c.low, p); }
  }
  const out = [...map.values()].sort((a, b) => a.time - b.time).map(({ first, last, ...c }) => c);
  return out.length >= 5 ? out : null;
}

/** Só aceita séries M1 (espaçamento de 1 minuto na maior parte). */
function isM1(cs) {
  if (!cs || cs.length < 5) return false;
  let ok = 0;
  for (let i = 1; i < cs.length; i++) if (cs[i].time - cs[i - 1].time === M1) ok++;
  return ok / (cs.length - 1) >= 0.8;
}

function findAssetName(obj, depth = 0) {
  if (!obj || depth > 3) return null;
  if (typeof obj === 'string') return /^[A-Za-z#]{3,12}[_-]?(otc)?$/i.test(obj) || parseAsset(obj) ? obj : null;
  if (Array.isArray(obj)) { for (const v of obj.slice(0, 4)) { const r = typeof v === 'string' ? findAssetName(v, depth + 1) : null; if (r) return r; } return null; }
  if (typeof obj === 'object') for (const k of ['asset', 'symbol', 'pair', 'instrument', 'active', 'name']) if (typeof obj[k] === 'string') return obj[k];
  return null;
}

/** Percorre o JSON procurando velas/ticks e cotações. */
function scan(node, ctxAsset, depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) {
    let cs = asCandles(node);
    if (!cs) cs = ticksToCandles(node);
    if (cs && isM1(cs)) { addHistory(ctxAsset, cs); return; }
    // cotação ao vivo: ["AUDCHF_otc", tempo, preço, ...]
    if (node.length >= 3 && typeof node[0] === 'string' && Number.isFinite(+node[1]) && toMs(+node[1]) && Number.isFinite(+node[2])) {
      quotes.set(normAsset(node[0]), { price: +node[2], at: Date.now() });
    }
    for (const v of node.slice(0, 50)) if (v && typeof v === 'object') scan(v, findAssetName(v) || ctxAsset, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    const a = findAssetName(node) || ctxAsset;
    for (const v of Object.values(node)) if (v && typeof v === 'object') scan(v, a, depth + 1);
  }
}

function addHistory(asset, cs) {
  const key = normAsset(asset) || '?';
  const prev = histories.get(key);
  const map = new Map((prev?.candles || []).map((c) => [c.time, c]));
  for (const c of cs) map.set(c.time, c);
  const candles = [...map.values()].sort((a, b) => a.time - b.time).slice(-600);
  histories.set(key, { candles, at: Date.now(), raw: asset });
  stats.histories.push(`${asset || '?'}: ${cs.length} velas`);
  if (stats.histories.length > 10) stats.histories.shift();
  for (const fn of listeners) fn(key);
}

export function ingestWsText(text) {
  stats.messages++;
  const m = text.match(/^\d*-?\s*\[\s*"([^"]{1,40})"/);
  const ev = m ? m[1] : text.trim().startsWith('{') ? '{json}' : text.trim().startsWith('[') ? '[json]' : 'outro';
  stats.events.set(ev, (stats.events.get(ev) || 0) + 1);
  if (stats.samples.length < 6 && text.length > 200) stats.samples.push(text.slice(0, 160));
  const start = text.search(/[\[{]/);
  if (start < 0) return;
  let json;
  try { json = JSON.parse(text.slice(start)); } catch { return; }
  scan(json, findAssetName(json));
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__m1ws !== 1 || typeof e.data.data !== 'string') return;
    try { ingestWsText(e.data.data); } catch { /* formato inesperado */ }
  });
}

/** Histórico recebido para o ativo (rótulo da Quotex). Se não houver nome, aceita o único histórico recente. */
export function wsHistoryFor(label) {
  const k = normAsset(label);
  if (histories.has(k)) return histories.get(k).candles;
  const unnamed = histories.get('?');
  return unnamed && Date.now() - unnamed.at < 120_000 ? unnamed.candles : null;
}

export function wsQuoteFor(label, maxAgeMs = 3000) {
  const q = quotes.get(normAsset(label));
  return q && Date.now() - q.at < maxAgeMs ? q.price : null;
}

export function onWsHistory(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function wsInfo() {
  const ev = [...stats.events.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}×${v}`).join(' ');
  const t = tapInfo();
  return [
    `leitor da página: ${t.active ? 'ativo' : 'NÃO ativo (recarregue a página com F5)'} · conexão observada: ${t.wsHooked ? 'sim' : 'não'}`,
    `mensagens recebidas: ${stats.messages}`,
    `tipos: ${ev || 'nenhum'}`,
    `históricos reconhecidos: ${stats.histories.join(' | ') || 'nenhum'}`,
    `cotações: ${[...quotes.keys()].slice(0, 8).join(', ') || 'nenhuma'}`,
    ...stats.samples.map((s) => `amostra: ${s}`),
  ];
}
