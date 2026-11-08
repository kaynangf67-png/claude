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

// Nomes como a Quotex costuma exibir criptomoedas (ex.: "Bitcoin (OTC)").
const NAME_TO_BASE = [
  [/bitcoin(?!\s*cash)/i, 'BTC'], [/ethereum(?!\s*classic)/i, 'ETH'], [/\bbnb\b|binance\s*coin/i, 'BNB'],
  [/solana/i, 'SOL'], [/ripple|\bxrp\b/i, 'XRP'], [/cardano/i, 'ADA'], [/dogecoin/i, 'DOGE'],
  [/litecoin/i, 'LTC'], [/\btron\b/i, 'TRX'], [/avalanche/i, 'AVAX'], [/chainlink/i, 'LINK'], [/polkadot/i, 'DOT'],
];

export function parseAsset(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const otc = /\bOTC\b/i.test(raw);
  const m = raw.match(PAIR_RE);
  if (m) return { base: m[1].toUpperCase(), quote: m[2].toUpperCase(), otc: otc || !!m[3], label: m[0].trim(), raw };
  for (const [re, base] of NAME_TO_BASE) {
    const n = raw.match(re);
    if (n) return { base, quote: 'USD', otc, label: n[0] + (otc ? ' (OTC)' : ''), raw };
  }
  return null;
}

/** Ativo aberto: elemento calibrado primeiro; depois o título da aba. */
export function detectAsset(calib = null, doc = document) {
  if (calib?.asset) {
    const el = resolveCalib(calib.asset, doc, 'asset');
    const a = el && readActiveAsset(el);
    if (a) return { ...a, from: 'calibrado' };
    if (el) return null; // achou o elemento, mas não dá para saber qual ativo está aberto
  }
  const t = parseAsset(doc.title);
  return t ? { ...t, from: 'título' } : null;
}

const ACTIVE_RE = /(^|[-_\s])(active|selected|current|is-active|opened|open)([-_\s]|$)/i;
const isActiveEl = (e) => ACTIVE_RE.test(typeof e.className === 'string' ? e.className : '')
  || e.getAttribute?.('aria-selected') === 'true' || e.getAttribute?.('aria-current') === 'true' || e.getAttribute?.('aria-current') === 'page';

/**
 * O elemento calibrado pode ser a BARRA de abas (vários ativos). Nesse caso
 * escolhe a aba ativa (classe active/selected ou aria-selected).
 */
export function readActiveAsset(el) {
  // Itens "folha": elementos cujo texto é um ativo e nenhum filho também é.
  const items = [];
  const walk = (e) => {
    const kids = [...e.children].filter((k) => parseAsset(k.textContent));
    if (!kids.length) { if (parseAsset(e.textContent)) items.push(e); return; }
    if (kids.length === 1 && !items.length && parseAsset(e.textContent)?.label === parseAsset(kids[0].textContent)?.label) { walk(kids[0]); return; }
    kids.forEach(walk);
  };
  walk(el);
  if (items.length <= 1) return parseAsset((items[0] || el).textContent);
  // Vários ativos: procura a aba ativa (no item ou em um ancestral dentro da barra).
  for (const it of items) {
    for (let e = it; e && e !== el.parentElement; e = e.parentElement) {
      if (isActiveEl(e)) return parseAsset(it.textContent);
    }
  }
  return null;
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
  const el = calib?.amount && resolveCalib(calib.amount, doc);
  if (!el) return null;
  return parseMoney(readText(el));
}

/** Texto útil de um elemento: valor do input (inclusive dentro dele) ou texto. */
export function readText(el) {
  if (!el) return '';
  const input = el.matches?.('input, textarea') ? el : el.querySelector?.('input');
  if (input && input.value != null && input.value !== '') return String(input.value);
  return String(el.textContent || '');
}

/**
 * Converte valores como "5,000 R$", "5.000,50", "1,5", "$10" em número.
 * Separador seguido de exatamente 3 dígitos = milhar; de 1–2 dígitos = decimal.
 */
export function parseMoney(text) {
  const m = String(text).replace(/\s/g, '').match(/\d[\d.,]*/);
  if (!m) return null;
  let t = m[0].replace(/[.,]$/, '');
  const lastSep = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  if (lastSep >= 0) {
    const decimals = t.length - lastSep - 1;
    const seps = (t.match(/[.,]/g) || []).length;
    const mixed = t.includes(',') && t.includes('.');
    if (mixed || (decimals !== 3 && seps === 1)) {
      t = t.slice(0, lastSep).replace(/[.,]/g, '') + '.' + t.slice(lastSep + 1);
    } else {
      t = t.replace(/[.,]/g, ''); // só milhares
    }
  }
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/**
 * Registro de calibração: além do caminho CSS, guarda classes, texto e a
 * posição na tela. A Quotex redesenha a página com frequência; se o caminho
 * quebrar, o bot procura pelas classes e, por último, pela posição.
 */
export function makeCalib(el, kind) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cls = [...el.classList].filter((c) => !/\d{3,}|active|hover|focus|selected/i.test(c)).slice(0, 4);
  return JSON.stringify({
    v: 2, kind, sel: cssPath(el), tag: el.tagName.toLowerCase(), cls,
    text: readText(el).replace(/\s+/g, ' ').trim().slice(0, 40),
    // posição relativa à borda mais próxima (layout da Quotex é ancorado nas laterais)
    pos: { fromRight: cx > innerWidth / 2, dx: cx > innerWidth / 2 ? innerWidth - cx : cx, y: cy },
  });
}

function parseCalib(rec) {
  if (!rec) return null;
  if (rec.startsWith('{')) { try { return JSON.parse(rec); } catch { return null; } }
  return { sel: rec }; // formato antigo (só seletor)
}

const looksRight = {
  asset: (el) => !!parseAsset(el.textContent) || !!el.querySelector?.('*'),
  amount: (el) => parseMoney(readText(el)) != null,
  call: (el) => el.getBoundingClientRect().width > 0,
  put: (el) => el.getBoundingClientRect().width > 0,
};

export function resolveCalib(rec, doc = document, kind) {
  const c = parseCalib(rec);
  if (!c) return null;
  const k = kind || c.kind;
  const ok = (el) => el && !el.closest?.('#m1-sniper-bot-host') && (!looksRight[k] || looksRight[k](el));
  // 1) caminho CSS gravado — só vale se for o MESMO tipo de elemento (tag + classes)
  const sameKind = (e) => e && (!c.tag || e.tagName.toLowerCase() === c.tag) && (c.cls || []).every((x) => e.classList.contains(x));
  let el = c.sel && safeQuery(c.sel, doc);
  if (ok(el) && sameKind(el)) return el;
  // 2) mesma tag + classes
  if (c.tag && c.cls?.length) {
    const q = c.tag + c.cls.map((x) => '.' + (window.CSS?.escape ? CSS.escape(x) : x)).join('');
    const cands = [...doc.querySelectorAll(q)].filter(ok);
    if (cands.length === 1) return cands[0];
    if (cands.length > 1 && c.text) { const t = cands.find((e) => readText(e).includes(c.text.slice(0, 8))); if (t) return t; }
    if (cands.length && c.pos) return nearest(cands, c.pos);
  }
  // 3) posição na tela
  if (c.pos && doc.elementsFromPoint) {
    const x = c.pos.fromRight ? innerWidth - c.pos.dx : c.pos.dx;
    for (const e of doc.elementsFromPoint(x, c.pos.y)) {
      if (e.closest('#m1-sniper-bot-host')) continue;
      const t = e.closest('button, input, [role="button"]') || e;
      if (ok(t)) return t;
      const inner = e.querySelector?.('input');
      if (inner && ok(inner)) return inner;
    }
  }
  return null;
}

function nearest(els, pos) {
  const x = pos.fromRight ? innerWidth - pos.dx : pos.dx;
  let best = null, bd = Infinity;
  for (const e of els) { const r = e.getBoundingClientRect(); const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - pos.y); if (d < bd) { bd = d; best = e; } }
  return best;
}

/** Diagnóstico para o painel: o que foi encontrado e lido. */
export function calibReading(rec, kind, doc = document) {
  const el = resolveCalib(rec, doc, kind);
  if (!el) return { found: false, text: '' };
  return { found: true, text: readText(el).replace(/\s+/g, ' ').trim().slice(0, 30) };
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
  const rec = direction === 'CALL' ? calib?.call : calib?.put;
  const el = rec && resolveCalib(rec, doc, direction === 'CALL' ? 'call' : 'put');
  if (!el) return { ok: false, error: `Botão ${direction} calibrado não encontrado na página` };
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return { ok: false, error: `Botão ${direction} desabilitado` };
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { ok: false, error: `Botão ${direction} invisível` };
  el.click();
  return { ok: true };
}
