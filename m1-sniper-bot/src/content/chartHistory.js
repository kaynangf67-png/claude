// Lê o HISTÓRICO de velas do próprio gráfico da Quotex passando um "mouse
// virtual" sobre o gráfico e lendo a legenda OHLC (Abertura/Fechamento/
// Alto/Baixo) de cada vela. Não usa API: só o que o gráfico já mostra.
// Pode não funcionar se o gráfico ignorar eventos de mouse simulados; nesse
// caso o bot volta ao aquecimento normal.

import { parsePrice } from './quotexPage.js';

const LABELS = {
  open: /^(abertura|abert\.?|open|o)$/i,
  close: /^(fechamento|fech\.?|close|c)$/i,
  high: /^(alto|alta|máxima|maxima|máx\.?|max\.?|high|h)$/i,
  low: /^(baixo|baixa|mínima|minima|mín\.?|min\.?|low|l)$/i,
};
const M1 = 60_000;

function ownText(e) {
  return [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
}

/** Acha os elementos da legenda OHLC (rótulo → elemento com o valor). */
export function findLegend(doc = document) {
  const found = {};
  for (const e of doc.querySelectorAll('body *')) {
    if (e.closest('#m1-sniper-bot-host')) continue;
    const t = ownText(e);
    if (!t || t.length > 30) continue;
    const m = t.match(/^([^\d:]+?)\s*:?\s*([\d.,]+)?$/);
    if (!m) continue;
    for (const [k, re] of Object.entries(LABELS)) {
      if (found[k] || !re.test(m[1].trim())) continue;
      if (m[2]) { found[k] = { el: e, inline: true }; continue; }
      // valor: irmão seguinte, irmão do pai, ou o texto da "linha" (pai) sem o rótulo
      const cands = [e.nextElementSibling, e.parentElement?.nextElementSibling].filter(Boolean);
      const v = cands.find((c) => parsePrice(c.textContent) != null && c.textContent.trim().length < 25);
      if (v) found[k] = { el: v, inline: false };
      else if (e.parentElement && parsePrice(e.parentElement.textContent.replace(t, '')) != null && e.parentElement.textContent.length < 40) {
        found[k] = { el: e.parentElement, inline: false, strip: t };
      }
    }
  }
  return found.open && found.close && found.high && found.low ? found : null;
}

export function readLegend(legend) {
  if (!legend) return null;
  const val = (f) => parsePrice(f.inline ? (ownText(f.el).match(/[\d.,]+$/)?.[0] ?? '') : f.strip ? f.el.textContent.replace(f.strip, '') : f.el.textContent);
  const o = { open: val(legend.open), high: val(legend.high), low: val(legend.low), close: val(legend.close) };
  return Object.values(o).every((v) => v != null) ? o : null;
}

export function biggestCanvas(doc = document) {
  let best = null, area = 0;
  for (const c of doc.querySelectorAll('canvas')) {
    if (c.closest('#m1-sniper-bot-host')) continue;
    const r = c.getBoundingClientRect();
    if (r.width * r.height > area) { area = r.width * r.height; best = c; }
  }
  return area > 40_000 ? best : null;
}

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 8)));

/** Mouse simulado comum (eventos do próprio script). */
export const syntheticMover = {
  name: 'simulado',
  async begin(x, y) { fire(x, y, 'mouseover'); fire(x, y, 'mouseenter'); fire(x, y); },
  async move(x, y) { fire(x, y); },
  async end(r) { leaveChart(r); },
};

/** Mouse do Chrome via chrome.debugger (eventos confiáveis). `send` = mensagem ao service worker. */
export function trustedMover(send) {
  return {
    name: 'Chrome',
    async begin(x, y) {
      const a = await send({ type: 'dbg', op: 'attach' });
      if (a?.error) throw new Error('não foi possível usar o mouse do Chrome: ' + a.error);
      await send({ type: 'dbg', op: 'move', x, y });
    },
    async move(x, y) { const r = await send({ type: 'dbg', op: 'move', x, y }); if (r?.error) throw new Error(r.error); },
    async end(r) {
      // sai do gráfico (canto superior esquerdo da página) e desconecta
      await send({ type: 'dbg', op: 'move', x: 2, y: 2 }).catch(() => {});
      await send({ type: 'dbg', op: 'detach' }).catch(() => {});
    },
  };
}

let lastTarget = null;
let chartCanvas = null;
function fire(x, y, type = 'mousemove', forced = null) {
  const target = forced || document.elementFromPoint(x, y);
  if (!target || target.closest('#m1-sniper-bot-host')) return;
  if (type === 'mousemove') lastTarget = target;
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y + 80, view: window, buttons: 0 };
  const pinit = { ...init, pointerType: 'mouse', pointerId: 1, isPrimary: true, width: 1, height: 1 };
  // envia ao elemento sob o ponto e, se houver, também ao canvas do gráfico
  const targets = [target];
  if (chartCanvas && chartCanvas !== target && !target.contains?.(chartCanvas)) targets.push(chartCanvas);
  for (const t of targets) {
    if (type === 'mousemove') {
      t.dispatchEvent(new PointerEvent('pointermove', pinit));
      t.dispatchEvent(new MouseEvent('mousemove', init));
    } else if (type === 'mouseover' || type === 'mouseenter') {
      t.dispatchEvent(new PointerEvent(type === 'mouseover' ? 'pointerover' : 'pointerenter', { ...pinit, bubbles: type === 'mouseover' }));
      t.dispatchEvent(new MouseEvent(type, { ...init, bubbles: type === 'mouseover' }));
    } else t.dispatchEvent(new MouseEvent(type, init));
  }
}

/**
 * Varre o gráfico da direita para a esquerda.
 * @returns {{ok:boolean, candles?:Array, error?:string, read?:number}}
 */
export async function readChartHistory({ livePrice, now = Date.now(), step = 2, maxCandles = 300, onProgress, mover = syntheticMover } = {}) {
  const canvas = biggestCanvas();
  if (!canvas) return { ok: false, error: 'gráfico (canvas) não encontrado', info: canvasInfo() };
  chartCanvas = canvas;
  const r = canvas.getBoundingClientRect();
  // Na Quotex a legenda OHLC só aparece com o mouse SOBRE o gráfico: entra primeiro, depois procura.
  let legend = findLegend();
  await mover.begin(r.left + r.width * 0.6, r.top + r.height * 0.55);
  if (!legend) {
    for (const fx of [0.6, 0.4, 0.75, 0.25]) {
      const px = r.left + r.width * fx, py = r.top + r.height * 0.55;
      for (let k = 0; k < 6 && !legend; k++) { await mover.move(px + k * 3, py); await frame(); await frame(); legend = findLegend(); }
      if (legend) break;
    }
  }
  if (!legend) {
    await mover.end(r);
    return { ok: false, error: 'legenda Abertura/Fechamento/Alto/Baixo não apareceu nem com o mouse virtual sobre o gráfico', info: canvasInfo() + ' · textos com rótulos OHLC: ' + ohlcTextsInfo() };
  }
  const legendStart = readLegend(legend);
  const y = r.top + r.height * 0.55;
  const seq = [];
  let lastOpen = null;
  try {
    for (let x = r.right - 4; x > r.left + 4 && seq.length < maxCandles; x -= step) {
      await mover.move(x, y);
      await frame();
      const o = readLegend(legend);
      if (!o) continue;
      // A vela só muda quando a ABERTURA muda (a vela atual muda fechamento/extremos ao vivo).
      if (o.open !== lastOpen) { seq.push({ ...o, x }); lastOpen = o.open; onProgress?.(seq.length); }
      else seq[seq.length - 1] = { ...o, x: seq[seq.length - 1].x }; // atualiza a mesma vela (mantém o x onde começou)
    }
  } finally {
    // devolve a legenda para a vela atual e sai do gráfico
    await mover.move(r.right - 4, y).catch(() => {});
    await frame();
    await mover.end(r);
  }
  const res = buildHistory(seq, { livePrice, now });
  res.info = `mouse ${mover.name} · ${canvasInfo()} · legenda inicial ${JSON.stringify(legendStart)} · mudanças lidas ${seq.length} · preço ao vivo ${livePrice}`;
  return res;
}

function leaveChart(r) {
  const t = lastTarget;
  const y = r.top + r.height * 0.55;
  for (const type of ['mouseout', 'mouseleave']) fire(r.right - 4, y, type, t);
  if (t) t.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse', pointerId: 1, isPrimary: true, clientX: r.right + 50, clientY: y }));
  if (chartCanvas && chartCanvas !== t) chartCanvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, pointerType: 'mouse', pointerId: 1, isPrimary: true, clientX: r.right + 50, clientY: y }));
}

/** Para o diagnóstico: textos da página que parecem rótulos OHLC. */
function ohlcTextsInfo() {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (out.length >= 8 || e.closest('#m1-sniper-bot-host')) continue;
    const t = ownText(e);
    if (t && t.length < 30 && /abert|fech|alto|baixo|máx|mín|open|close|high|low/i.test(t)) out.push(`"${t}"`);
  }
  return out.join(' ') || 'nenhum';
}

function canvasInfo() {
  const cs = [...document.querySelectorAll('canvas')].filter((c) => !c.closest('#m1-sniper-bot-host'))
    .map((c) => { const r = c.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
  return `canvas: ${cs.join(', ') || 'nenhum'}`;
}

/**
 * Converte a sequência lida (da direita para a esquerda) em velas M1 com horário.
 * Exige: vela atual compatível com o preço ao vivo, espaçamento regular e OHLC coerente.
 */
export function buildHistory(seq, { livePrice, now }) {
  if (seq.length < 10) return { ok: false, error: `poucas velas lidas (${seq.length}) — o gráfico não respondeu ao mouse virtual`, read: seq.length };
  // vela mais à direita = vela atual
  if (Number.isFinite(livePrice) && Math.abs(seq[0].close - livePrice) / livePrice > 0.002) {
    return { ok: false, error: 'a última vela lida não bate com o preço ao vivo (legenda não segue o mouse?)', read: seq.length };
  }
  // espaçamento: mediana dos passos; corta no primeiro buraco (vela faltando)
  const dx = seq.slice(1).map((s, i) => seq[i].x - s.x).filter((d) => d > 0);
  const med = [...dx].sort((a, b) => a - b)[Math.floor(dx.length / 2)] || 0;
  let n = seq.length;
  for (let i = 1; i < seq.length; i++) {
    const d = seq[i - 1].x - seq[i].x;
    if (med && i > 1 && d > med * 1.7) { n = i; break; }   // pulou uma vela: usa só o trecho contínuo
  }
  const m0 = Math.floor(now / M1) * M1;
  const candles = [];
  for (let i = 0; i < n; i++) {
    const s = seq[i];
    if (!(s.high >= Math.max(s.open, s.close) - 1e-9 && s.low <= Math.min(s.open, s.close) + 1e-9)) {
      return { ok: false, error: 'valores incoerentes na legenda (Alto/Baixo)', read: seq.length };
    }
    candles.unshift({ time: m0 - i * M1, open: s.open, high: s.high, low: s.low, close: s.close });
  }
  return { ok: true, candles, read: seq.length, used: n };
}
