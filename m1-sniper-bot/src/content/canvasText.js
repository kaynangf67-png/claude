// Recebe os textos desenhados no canvas da Quotex (via canvasTap.js no mundo
// da página) e extrai: o PREÇO AO VIVO e a legenda OHLC (quando o mouse está
// sobre o gráfico).
import { isPriceText, parsePrice } from './quotexPage.js';

const OHLC = {
  open: /^(abertura|abert\.?|open|o)\s*:?/i,
  close: /^(fechamento|fech\.?|close|c)\s*:?/i,
  high: /^(alto|alta|máxima|maxima|máx\.?|max\.?|high|h)\s*:?/i,
  low: /^(baixo|baixa|mínima|minima|mín\.?|min\.?|low|l)\s*:?/i,
};

const groups = new Map();   // grupo de textos numéricos (canvas+cor+coluna) -> estado
let lastItems = [], lastAt = 0, batches = 0;
const waiters = [];

function ingest(items) {
  const now = Date.now();
  lastItems = items; lastAt = now; batches++;
  const byKey = new Map();
  for (const it of items) {
    if (!isPriceText(it.t)) continue;
    const k = `${it.c}|${it.f}|${Math.round(it.x / 40)}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(it);
  }
  for (const [k, arr] of byKey) {
    const g = groups.get(k) || { changes: [], sig: '', last: null, perBatch: 0, lastAt: 0 };
    const uniq = [...new Set(arr.map((a) => a.t))];
    const sig = uniq.slice().sort().join('|');
    if (g.sig && sig !== g.sig) g.changes.push(now);
    g.changes = g.changes.filter((t) => now - t < 20_000);
    g.sig = sig; g.perBatch = uniq.length; g.last = arr[arr.length - 1]; g.lastAt = now;
    groups.set(k, g);
  }
  for (const w of waiters.splice(0)) w();
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__m1tap !== 1 || !Array.isArray(e.data.items)) return;
    ingest(e.data.items);
  });
}

/** Preço ao vivo: grupo com 1–3 textos por quadro que muda com frequência (eixo/grade fica parado). */
export function canvasLivePrice() {
  const now = Date.now();
  let best = null, score = 0;
  for (const g of groups.values()) {
    if (now - g.lastAt > 3000 || g.perBatch > 3) continue;
    if (g.changes.length >= 3 && g.changes.length > score) { score = g.changes.length; best = g; }
  }
  return best ? parsePrice(best.last.t) : null;
}

export const canvasTapActive = () => Date.now() - lastAt < 5000;

/** Espera o próximo lote de textos desenhados (ou timeout). */
export function nextCanvasBatch(timeoutMs = 300) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, timeoutMs);
    waiters.push(() => { clearTimeout(t); resolve(); });
  });
}

/** Legenda OHLC desenhada no canvas (aparece com o mouse sobre o gráfico). */
export function canvasLegend(items = Date.now() - lastAt < 1500 ? lastItems : []) {
  const out = {};
  const nums = items.filter((i) => isPriceText(i.t));
  for (const it of items) {
    for (const [k, re] of Object.entries(OHLC)) {
      if (out[k] != null || !re.test(it.t.trim())) continue;
      if (/^[ohlc]\s*:?$/i.test(it.t.trim()) === false && it.t.trim().length <= 2) continue;
      const inline = it.t.replace(re, '').trim();
      if (inline && isPriceText(inline)) { out[k] = parsePrice(inline); continue; }
      // número mais próximo à direita, na mesma linha
      const cand = nums.filter((n) => n.c === it.c && Math.abs(n.y - it.y) <= 4 && n.x > it.x).sort((a, b) => a.x - b.x)[0];
      if (cand) out[k] = parsePrice(cand.t);
    }
  }
  return out.open != null && out.close != null && out.high != null && out.low != null ? out : null;
}

export function canvasInfo() {
  const now = Date.now();
  const gs = [...groups.entries()].filter(([, g]) => now - g.lastAt < 5000)
    .map(([k, g]) => `grupo ${k}: ${g.perBatch} texto(s)/quadro, último "${g.last?.t}", mudou ${g.changes.length}x/20s`);
  const sample = (now - lastAt < 2000 ? lastItems : []).slice(0, 12).map((i) => `"${i.t}"@${i.x},${i.y} ${i.f}`);
  return [`textos do canvas: ${now - lastAt < 5000 ? 'recebendo' : 'NADA recebido'} (${batches} lotes)`, ...gs.slice(0, 10), 'amostra: ' + sample.join(' ')];
}
