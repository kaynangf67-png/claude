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

/**
 * Junta caracteres desenhados um a um ("0" "." "7" "8"…) em textos inteiros:
 * mesmo canvas, mesma cor, mesma linha (y) e encostados no eixo x.
 */
export function assembleRuns(items) {
  const singles = items.filter((i) => i.t.length <= 3 && /^[\d.,:%+\-]+$/.test(i.t));
  if (singles.length < 3) return items;
  const rest = items.filter((i) => !singles.includes(i));
  const rows = new Map();
  for (const it of singles) {
    const k = `${it.c}|${it.f}|${Math.round(it.y / 2)}`;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(it);
  }
  const runs = [];
  for (const row of rows.values()) {
    // mesmo caractere/posição repetido (dois quadros no mesmo lote): fica o mais recente
    const byPos = new Map();
    for (const it of row) byPos.set(Math.round(it.x), it);
    const arr = [...byPos.values()].sort((a, b) => a.x - b.x);
    let cur = null;
    for (const it of arr) {
      const gap = cur ? it.x - (cur.endX) : Infinity;
      const maxGap = Math.max(2, (it.w || 6) * 0.9);
      if (cur && gap >= -1 && gap <= maxGap) { cur.t += it.t; cur.endX = it.x + (it.w || 6); }
      else { if (cur) runs.push(cur); cur = { ...it, endX: it.x + (it.w || 6) }; }
    }
    if (cur) runs.push(cur);
  }
  return rest.concat(runs.map(({ endX, ...r }) => r));
}

let helloAt = 0;
function ingest(rawItems) {
  const items = assembleRuns(rawItems);
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
    const g = groups.get(k) || { changes: [], sig: '', last: null, perBatch: 0, lastAt: 0, firstAt: now };
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
    if (e.data.hello) { helloAt = Date.now(); return; }
    ingest(e.data.items);
  });
}

/**
 * Números que o gráfico está desenhando e que mudam (candidatos a preço ao vivo).
 * Cada grupo = um texto do gráfico (mesmo canvas + cor + coluna).
 */
export function canvasCandidates(maxAgeMs = 60_000) {
  const now = Date.now();
  return [...groups.entries()]
    .filter(([, g]) => now - g.lastAt < maxAgeMs && g.lastAt > resetAt && g.perBatch <= 3 && g.last)
    .map(([key, g]) => {
      const seenS = Math.max(1, Math.min(20, (now - Math.max(g.firstAt, resetAt)) / 1000));
      return { key, color: g.last.f, value: parsePrice(g.last.t), text: g.last.t, rate: g.changes.length / seenS, seenS, ageMs: now - g.lastAt };
    })
    .sort((a, b) => b.rate - a.rate);
}

let selectedKey = null;
let resetAt = 0; // após trocar de ativo, só valem números redesenhados depois da troca

/** Troca de ativo: esquece o rótulo escolhido e procura o novo (mesma cor e ritmo). */
export function resetCanvasSelection() {
  selectedKey = null;
  resetAt = Date.now();
  for (const g of groups.values()) g.changes = []; // ritmo recomeça a contar
}

/**
 * Preço ao vivo pela escolha do usuário (pref = { key, color, rate }).
 * Na mesma página usa o mesmo grupo; após recarregar, o grupo da mesma cor
 * com ritmo de mudança parecido. Sem escolha: só usa se houver UM candidato.
 */
export function canvasPriceFor(pref) {
  const cands = canvasCandidates();
  if (!cands.length) return null;
  if (!pref) return autoPick(cands);
  let c = cands.find((x) => x.key === (selectedKey || pref.key));
  if (!c) {
    const same = cands.filter((x) => x.color === pref.color);
    if (!same.length) return null;
    // ritmo (mudanças por segundo) mais parecido com o do número escolhido
    const dist = (x) => Math.abs(Math.log((x.rate + 0.1) / ((pref.rate ?? 0) + 0.1)));
    c = same.sort((a, b) => dist(a) - dist(b))[0];
    // só fixa depois de observar por 10 s (ritmo confiável); antes, reavalia a cada leitura
    if (c.seenS >= 10) selectedKey = c.key;
    else if (same.length > 1) return null; // ainda incerto: melhor não ler do que ler errado
  }
  return c.value;
}

export function selectCanvasKey(key) { selectedKey = key; }

/**
 * Escolha AUTOMÁTICA do preço ao vivo entre os números que o gráfico desenha.
 * O preço aparece em vários rótulos que concordam entre si (mesma cor, valores
 * a < 0,05% um do outro) e mudam no ritmo de ticks (0,5–8 por segundo).
 * Animações (muito rápidas) e marcações fixas (quase paradas) ficam de fora.
 * Retorna o valor do meio do maior grupo que concorda.
 */
export function autoPick(cands = canvasCandidates()) {
  const live = cands.filter((c) => c.ageMs < 8000 && c.seenS >= 3 && c.rate >= 0.3 && Number.isFinite(c.value));
  if (!live.length) return cands.length === 1 ? cands[0].value : null;
  if (live.length === 1) return live[0].value;
  const tick = (c) => (c.rate >= 0.5 && c.rate <= 8 ? 1 : 0);
  let best = null;
  for (const c of live) {
    const members = live.filter((o) => o.color === c.color && Math.abs(o.value - c.value) / c.value < 0.0005);
    const score = members.length * 2 + members.reduce((a, m) => a + tick(m), 0) / members.length;
    if (!best || score > best.score) best = { score, members };
  }
  // empate entre grupos diferentes de 1 só número: ambíguo demais
  const ties = live.filter((c) => {
    const m = live.filter((o) => o.color === c.color && Math.abs(o.value - c.value) / c.value < 0.0005);
    return m.length * 2 + m.reduce((a, x) => a + tick(x), 0) / m.length === best.score && !best.members.includes(c);
  });
  if (best.members.length === 1 && ties.length) return null;
  const vals = best.members.map((m) => m.value).sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

/** Compatibilidade. */
export function canvasLivePrice() { return canvasPriceFor(null); }

export const canvasTapActive = () => Date.now() - lastAt < 5000;

/** Situação da leitura do gráfico, para mensagens claras no painel. */
export function canvasStatus() {
  const now = Date.now();
  if (now - lastAt > 5000) return helloAt || batches ? 'gráfico não está desenhando textos (talvez desenhe por outro meio)' : 'leitura do gráfico não iniciada — recarregue a página da Quotex (F5)';
  const n = canvasCandidates().length;
  if (n > 1) return `o gráfico mostra ${n} números que mudam — escolha qual é o preço em ⚙ → Preço ao vivo → ESCOLHER`;
  return n ? 'aguarde alguns segundos' : `gráfico desenha ${lastItems.length} texto(s), mas nenhum número de preço`;
}

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
  return [`textos do canvas: ${now - lastAt < 5000 ? 'recebendo' : 'NADA recebido'} (${batches} lotes; script ${helloAt ? 'ativo' : 'NÃO detectado'})`, ...gs.slice(0, 10), 'amostra: ' + sample.join(' ')];
}
