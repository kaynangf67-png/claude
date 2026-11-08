// Interação com a página da Quotex.
// - Leitura: ativo aberto, conta DEMO/REAL, valor da operação.
// - Escrita: SOMENTE o clique no botão CALL/PUT calibrado pelo usuário,
//   e só quando o modo automático está armado.
// A Quotex não documenta seu HTML; por isso o usuário CALIBRA os elementos
// (clica neles uma vez) e o bot grava seletores CSS.

import { SYMBOLS } from '../data/binance.js';

/** DEMO/REAL a partir da URL (ex.: /pt/demo-trade vs /pt/trade). */
export function detectPageMode(loc = location) {
  const p = loc.pathname.toLowerCase();
  if (p.includes('demo')) return 'DEMO';
  if (/\/trade(\/|$)/.test(p)) return 'REAL';
  return 'UNKNOWN';
}

const PAIR_RE = /\b([A-Z]{2,6})\s*\/\s*([A-Z]{2,6})(\s*\(?OTC\)?)?/i;

export function parseAsset(text) {
  const m = String(text || '').match(PAIR_RE);
  if (!m) return null;
  return { base: m[1].toUpperCase(), quote: m[2].toUpperCase(), otc: !!m[3], label: m[0].replace(/\s+/g, ' ').trim() };
}

/** Ativo aberto: elemento calibrado primeiro; depois o título da aba. */
export function detectAsset(calib = null, doc = document) {
  if (calib?.asset) {
    const el = safeQuery(calib.asset, doc);
    const a = el && parseAsset(el.textContent);
    if (a) return { ...a, from: 'calibrado' };
  }
  const t = parseAsset(doc.title);
  return t ? { ...t, from: 'título' } : null;
}

/** Símbolo da fonte de dados correspondente ao ativo da Quotex (ou null). */
export function assetToSymbol(asset) {
  if (!asset || asset.otc) return null; // OTC é preço sintético da corretora
  const quotes = asset.quote === 'USD' || asset.quote === 'USDT' ? ['USDT'] : [asset.quote];
  for (const q of quotes) {
    const sym = asset.base + q;
    // EURUSDT é só aproximação do EUR/USD: não é aceito como correspondência.
    if (SYMBOLS[sym] && sym !== 'EURUSDT') return sym;
  }
  return null;
}

/** O ativo da Quotex corresponde ao símbolo analisado? null = desconhecido. */
export function assetMatches(asset, symbol) {
  if (!asset) return null;
  return assetToSymbol(asset) === symbol;
}

/** Lê o valor da operação no campo calibrado. */
export function readAmount(calib, doc = document) {
  const el = calib?.amount && safeQuery(calib.amount, doc);
  if (!el) return null;
  const raw = 'value' in el && el.value !== undefined ? el.value : el.textContent;
  const m = String(raw).replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const v = Number(m[0].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

export function safeQuery(sel, doc = document) {
  try { return doc.querySelector(sel); } catch { return null; }
}

/** Seletor CSS estável para um elemento (id; senão caminho com nth-of-type). */
export function cssPath(el) {
  if (!(el instanceof Element)) return null;
  const esc = (s) => (window.CSS?.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.documentElement) {
    if (node.id && !/\d{3,}/.test(node.id)) { parts.unshift('#' + esc(node.id)); break; }
    let part = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === node.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}

/**
 * Captura o PRÓXIMO clique na página para calibrar um elemento.
 * O clique é BLOQUEADO (não chega à Quotex), então nenhuma operação é aberta.
 */
export function captureNextClick(isOwnUi) {
  return new Promise((resolve) => {
    const block = (e) => { if (!isOwnUi(e)) { e.preventDefault(); e.stopImmediatePropagation(); } };
    const onClick = (e) => {
      if (isOwnUi(e)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      cleanup();
      // Sobe até o elemento "clicável" mais próximo (botão/input) para um seletor estável.
      const t = e.target.closest('button, input, [role="button"], a, label') || e.target;
      resolve(t);
    };
    const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); } };
    const types = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
    function cleanup() {
      window.removeEventListener('click', onClick, true);
      for (const t of types) window.removeEventListener(t, block, true);
      window.removeEventListener('keydown', onKey, true);
      document.documentElement.style.cursor = '';
    }
    for (const t of types) window.addEventListener(t, block, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    document.documentElement.style.cursor = 'crosshair';
  });
}

/** Clica no botão CALL/PUT calibrado. Retorna {ok, error}. */
export function clickDirection(calib, direction, doc = document) {
  const sel = direction === 'CALL' ? calib?.call : calib?.put;
  const el = sel && safeQuery(sel, doc);
  if (!el) return { ok: false, error: `Botão ${direction} calibrado não encontrado na página` };
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return { ok: false, error: `Botão ${direction} desabilitado` };
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { ok: false, error: `Botão ${direction} invisível` };
  el.click();
  return { ok: true };
}
