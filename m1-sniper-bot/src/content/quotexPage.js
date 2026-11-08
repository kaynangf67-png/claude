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

// ------------------------------------------------------------------ painel de operação
// A partir do botão CALL calibrado, acha o painel de operação da Quotex
// (onde ficam ativo + %, Tempo, Investimento, Pagamento, Comprar/Vender).

const MONEY_LEAF_RE = /^\s*(R\$|US\$|\$|€|£|₹)?\s*\d[\d.,]*\s*(R\$|\$|€|£|₹|BRL|USD|USDT|EUR)?\s*$/i;
const TIME_LEAF_RE = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/;

/**
 * Visível na tela? A Quotex mantém no HTML listas/menus fechados (ex.: seletor
 * de ativos com "Bitcoin (OTC)" no topo). Elementos invisíveis são ignorados.
 */
export function isVisible(el) {
  if (!el?.getBoundingClientRect) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    if (e === document.body) break;
  }
  return true;
}

function leaves(root) {
  const out = [];
  for (const e of root.querySelectorAll('*')) {
    if (e.closest('#m1-sniper-bot-host')) continue;
    let text = null;
    if (e.matches('input, textarea')) text = String(e.value || '');
    else if (e.children.length === 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      text = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
    }
    if (!text) continue;
    if (!isVisible(e)) continue; // só depois de ter texto (custo menor)
    out.push({ el: e, text });
  }
  return out;
}

export function tradePanel(calib, doc = document) {
  const btn = calib?.call && resolveCalib(calib.call, doc, 'call');
  if (!btn) return null;
  for (let e = btn.parentElement, d = 0; e && d < 12; e = e.parentElement, d++) {
    if (e === doc.body || e === doc.documentElement) break;
    const lv = leaves(e);
    const hasAsset = lv.some((l) => parseAsset(l.text));
    const hasMoney = lv.some((l) => !/%|:/.test(l.text) && MONEY_LEAF_RE.test(l.text));
    if (hasAsset && hasMoney) return e;
  }
  return null;
}

/**
 * Acha o campo do bloco de um rótulo: sobe até 3 níveis a partir do rótulo e
 * procura primeiro <input>, depois textos que passem no teste.
 */
function fieldNear(panel, labelRe, test) {
  const lv = leaves(panel);
  for (const lab of lv.filter((l) => labelRe.test(l.text) && l.text.length < 30 && !l.el.matches('input'))) {
    // Sobe até 3 níveis a partir do rótulo; em cada nível (caixa do campo):
    // 1º <input>, 2º texto DEPOIS do rótulo, 3º texto ANTES (rótulo flutuante
    // costuma vir depois do valor no HTML).
    for (let box = lab.el.parentElement, d = 0; box && d < 3 && panel.contains(box); box = box.parentElement, d++) {
      const inner = leaves(box).filter((l) => l.el !== lab.el && test(l.text));
      const after = (l) => !!(lab.el.compareDocumentPosition(l.el) & Node.DOCUMENT_POSITION_FOLLOWING);
      const pick = inner.find((l) => l.el.matches('input')) || inner.find(after) || inner.filter((l) => !after(l)).at(-1);
      if (pick) return pick;
    }
  }
  return null;
}

let prCache = { at: 0, key: '', val: null };
/** Esquece leituras guardadas (botão ⟳ do painel). */
export function clearCaches() { prCache = { at: 0, key: '', val: null }; legendCache = null; legendScanAt = 0; }
export function panelReadings(calib, doc = document) {
  const key = (calib?.call || '') + '|' + (calib?.asset || '');
  if (doc === document && Date.now() - prCache.at < 400 && prCache.key === key) return prCache.val;
  const val = panelReadingsRaw(calib, doc);
  if (doc === document) prCache = { at: Date.now(), key, val };
  return val;
}

function panelReadingsRaw(calib, doc = document) {
  const panel = tradePanel(calib, doc);
  if (!panel) return null;
  const lv = leaves(panel);
  // Ativo aberto = o nome mais PRÓXIMO ACIMA do botão Comprar (cabeçalho do painel).
  // Ignora a lista "Operações"/histórico, que fica abaixo dos botões e não muda.
  const btn = calib?.call && resolveCalib(calib.call, doc, 'call');
  const assetLeaves = lv.filter((l) => parseAsset(l.text));
  const before = btn ? assetLeaves.filter((l) => btn.compareDocumentPosition(l.el) & Node.DOCUMENT_POSITION_PRECEDING) : [];
  const assetLeaf = before.at(-1) || assetLeaves[0] || null;
  const asset = assetLeaf ? parseAsset(assetLeaf.text) : null;
  // % logo depois do nome do ativo (cabeçalho "Bitcoin (OTC)  80%")
  let payout = assetLeaf ? parsePercent(assetLeaf.text) : null;
  if (payout == null && assetLeaf) {
    const i = lv.indexOf(assetLeaf);
    const next = lv.slice(i + 1, i + 4).find((l) => /%/.test(l.text));
    if (next) payout = parsePercent(next.text);
  }
  // Investimento e Tempo: lidos no BLOCO do rótulo ("Investimento", "Tempo"),
  // preferindo o <input> do bloco. Evita pegar relógio, saldo ou pagamento.
  const isMoney = (t) => !/%|:/.test(t) && MONEY_LEAF_RE.test(t) && parseMoney(t) > 0;
  // Tempo de expiração na Quotex: sempre HH:MM:SS (00:01:00). Contagens regressivas
  // do gráfico ("00:05") e relógios têm outro formato/valor e são ignorados.
  const isTime = (t) => /^\s*\d{2}:\d{2}:\d{2}\s*$/.test(t);
  const INV_RE = /^\s*(investimento|investment|invest|amount|valor)\b/i;
  const TIME_RE = /^\s*(tempo|time|expira\w*|expiration|dura\w*)\b/i;
  const body = doc.body;
  const inv = fieldNear(panel, INV_RE, isMoney)
    || lv.find((l) => isMoney(l.text) && l.el.matches('input'))
    || fieldNear(body, INV_RE, isMoney) || null;                       // rótulo fora do bloco detectado
  const tl = fieldNear(panel, TIME_RE, isTime)
    || lv.find((l) => isTime(l.text) && /^\s*00:/.test(l.text))
    || fieldNear(body, TIME_RE, (t) => isTime(t) && /^\s*00:/.test(t))
    || [...doc.querySelectorAll('input')].map((e) => ({ el: e, text: String(e.value || '') })).find((l) => isTime(l.text) && /^\s*00:/.test(l.text))
    || null; // expiração < 1h
  let expirySec = null;
  if (tl) {
    const [, a, b, c] = tl.text.match(TIME_LEAF_RE);
    expirySec = c != null ? (+a) * 3600 + (+b) * 60 + (+c) : (+a) * 60 + (+b);
  }
  return {
    asset: asset ? { ...asset, from: 'painel' } : null,
    payout: payout == null ? null : Math.round(payout) / 100,
    amount: inv ? parseMoney(inv.text) : null,
    amountText: inv?.text ?? null,
    expirySec, expiryText: tl?.text ?? null,
  };
}

/** Ativo aberto: painel de operação; depois elemento calibrado; depois o título da aba. */
export function detectAsset(calib = null, doc = document) {
  // 1º: o lugar que o USUÁRIO apontou (botão ⟳ / calibração do ativo) — tem prioridade.
  if (calib?.asset) {
    const el = resolveCalib(calib.asset, doc, 'asset');
    const a = el && isVisible(el) && readActiveAsset(el);
    if (a) return { ...a, from: 'ponto indicado' };
  }
  // 2º: painel de operação ao lado do botão Comprar.
  const pr = calib?.call ? panelReadings(calib, doc) : null;
  if (pr?.asset) return pr.asset;
  // 3º: título da aba do navegador.
  const t = parseAsset(doc.title);
  return t ? { ...t, from: 'título' } : null;
}

/**
 * A partir do elemento clicado pelo usuário, escolhe o que vigiar:
 * - se ele estiver numa BARRA com vários ativos e a barra marcar a aba ativa,
 *   vigia a barra (troca de aba é acompanhada);
 * - senão, vigia o próprio elemento com o nome (ex.: cabeçalho do painel).
 */
export function assetTargetFromClick(clicked) {
  let el = clicked;
  for (let i = 0; i < 4 && el && !parseAsset(el.textContent); i++) el = el.parentElement;
  if (!el || !parseAsset(el.textContent)) return null;
  // menor elemento com o nome (evita pegar um bloco grande)
  while (el.children.length) {
    const k = [...el.children].find((c) => parseAsset(c.textContent) && isVisible(c));
    if (!k || parseAsset(k.textContent).label !== parseAsset(el.textContent).label) break;
    el = k;
  }
  for (let bar = el.parentElement, d = 0; bar && d < 6 && bar !== document.body; bar = bar.parentElement, d++) {
    const items = [...bar.querySelectorAll('*')].filter((e) => e.children.length === 0 && parseAsset(e.textContent) && isVisible(e));
    const labels = new Set(items.map((e) => parseAsset(e.textContent).label));
    if (labels.size >= 2) {
      const act = activeAssetItem(bar);
      if (act && parseAsset(act.textContent)?.label === parseAsset(el.textContent).label) return bar;
      break;
    }
  }
  return el;
}

const ACTIVE_RE = /(^|[-_\s])(active|selected|current|is-active|opened|open)([-_\s]|$)/i;
const isActiveEl = (e) => ACTIVE_RE.test(typeof e.className === 'string' ? e.className : '')
  || e.getAttribute?.('aria-selected') === 'true' || e.getAttribute?.('aria-current') === 'true' || e.getAttribute?.('aria-current') === 'page';

/**
 * O elemento calibrado pode ser a BARRA de abas (vários ativos). Nesse caso
 * escolhe a aba ativa (classe active/selected ou aria-selected).
 */
export function readActiveAsset(el) {
  const it = activeAssetItem(el);
  return it ? parseAsset(it.textContent) : null;
}

/** Elemento (aba/item) do ativo aberto dentro do elemento calibrado. */
export function activeAssetItem(el) {
  // Itens "folha": elementos cujo texto é um ativo e nenhum filho também é.
  const items = [];
  const walk = (e) => {
    const kids = [...e.children].filter((k) => parseAsset(k.textContent));
    if (!kids.length) { if (parseAsset(e.textContent) && isVisible(e)) items.push(e); return; }
    if (kids.length === 1 && !items.length && parseAsset(e.textContent)?.label === parseAsset(kids[0].textContent)?.label) { walk(kids[0]); return; }
    kids.forEach(walk);
  };
  walk(el);
  if (items.length <= 1) return parseAsset((items[0] || el).textContent) ? (items[0] || el) : null;
  // Vários ativos: procura a aba ativa (no item ou em um ancestral dentro da barra).
  for (const it of items) {
    for (let e = it; e && e !== el.parentElement; e = e.parentElement) {
      if (isActiveEl(e)) return it;
    }
  }
  return null;
}

/** Lê um percentual (ex.: "71%", "+85 %") de um texto. */
export function parsePercent(text) {
  const m = String(text || '').match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return v > 0 && v <= 200 ? v : null;
}

/**
 * Payout do mercado aberto, lido da aba/item do ativo na Quotex (ex.: "Ethereum 85%").
 * Procura no próprio item e, se não houver, nos vizinhos próximos.
 * Retorna fração (0.85) ou null.
 */
export function readPayout(calib, doc = document) {
  const pr = calib?.call ? panelReadings(calib, doc) : null;
  if (pr?.payout != null) return pr.payout;
  if (!calib?.asset) return null;
  const el = resolveCalib(calib.asset, doc, 'asset');
  const it = el && activeAssetItem(el);
  if (!it) return null;
  let p = parsePercent(it.textContent);
  // % às vezes fica num irmão/pai imediato (ex.: <div><span>Ethereum</span><span>85%</span></div>)
  for (let e = it.parentElement, depth = 0; p == null && e && depth < 2; e = e.parentElement, depth++) {
    if ((e.textContent.match(/%/g) || []).length === 1) p = parsePercent(e.textContent);
  }
  return p == null ? null : Math.round(p) / 100;
}

/** Símbolo da fonte de dados correspondente ao ativo da Quotex (ou null). */
export function assetToSymbol(asset, { allowOtc = false } = {}) {
  if (!asset) return null;
  if (asset.otc && !allowOtc) return null; // OTC é preço sintético da corretora
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
  const pr = calib?.call ? panelReadings(calib, doc) : null;
  if (pr?.amount != null) return pr.amount;
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
  // Ignora percentuais (ex.: payout "71%") — nunca são o valor da operação.
  const clean = String(text).replace(/\s/g, '').replace(/\d[\d.,]*%/g, ' ');
  const m = clean.match(/\d[\d.,]*/);
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

/** Preço de cotação (ex.: "75135.26", "1.08523", "75,135.26"). */
export function parsePrice(text) {
  const m = String(text || '').replace(/\s/g, '').match(/\d[\d.,]*/);
  if (!m) return null;
  let t = m[0].replace(/[.,]$/, '');
  const dots = (t.match(/\./g) || []).length, commas = (t.match(/,/g) || []).length;
  if (dots && commas) { const dec = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ','; t = t.split(dec === '.' ? ',' : '.').join('').replace(',', '.'); }
  else if (dots > 1) t = t.split('.').join('');
  else if (commas > 1) t = t.split(',').join('');
  else if (commas === 1) t = /,\d{3}$/.test(t) && t.length > 5 ? t.replace(',', '') : t.replace(',', '.');
  const v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Preço ao vivo. 1º: elemento calibrado (se for texto). 2º: legenda do gráfico
 * ("Fechamento: 75277.27"), que na Quotex é texto mesmo quando o rótulo azul
 * do eixo é desenhado em canvas (ilegível).
 * Retorna { price, from } ou null.
 */
export function readPriceInfo(calib, doc = document) {
  const el = calib?.price && resolveCalib(calib.price, doc, 'price');
  const v = el ? parsePrice(readText(el)) : null;
  if (v != null) return { price: v, from: 'rótulo' };
  const lg = legendClose(doc);
  if (lg != null) return { price: lg, from: 'legenda' };
  return null;
}

export function readPrice(calib, doc = document) {
  return readPriceInfo(calib, doc)?.price ?? null;
}

const CLOSE_RE = /^\s*(fechamento|fech\.?|close|c)\s*:?\s*([\d.,]+)?\s*$/i;
let legendCache = null; let legendScanAt = 0;

/** Valor de "Fechamento" na legenda OHLC do gráfico (sem depender de calibração). */
export function legendClose(doc = document) {
  const fromCache = () => {
    const c = legendCache?.deref?.();
    if (!c || !c.label.isConnected) return null;
    const own = ownText(c.label).match(CLOSE_RE);
    if (own?.[2]) return parsePrice(own[2]);
    return c.value?.isConnected ? parsePrice(readText(c.value)) : null;
  };
  let v = fromCache();
  if (v != null) return v;
  if (Date.now() - legendScanAt < 3000) return null;
  legendScanAt = Date.now();
  for (const e of doc.querySelectorAll('body *')) {
    if (e.closest('#m1-sniper-bot-host')) continue;
    const m = ownText(e).match(CLOSE_RE);
    if (!m || /^c$/i.test(m[1]) && !m[2]) continue;
    let valueEl = null;
    if (!m[2]) {
      // valor no próximo elemento (irmão ou célula seguinte)
      valueEl = e.nextElementSibling || e.parentElement?.nextElementSibling || null;
      if (!valueEl || parsePrice(readText(valueEl)) == null) continue;
    }
    legendCache = new WeakRef({ label: e, value: valueEl });
    v = fromCache();
    if (v != null) return v;
  }
  return null;
}

function ownText(e) {
  return [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
}

/** Diagnóstico para o usuário colar no chat: estrutura do painel de operação e do preço. */
export function diagnostics(calib, doc = document) {
  const lines = [`url: ${location.pathname}`];
  const outline = (root, maxDepth = 9, maxLines = 220) => {
    const out = [];
    const walk = (e, d) => {
      if (out.length >= maxLines || d > maxDepth || e.id === 'm1-sniper-bot-host') return;
      const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      const own = ownText(e).slice(0, 40);
      const val = e.matches('input, textarea') ? ` value="${String(e.value).slice(0, 30)}"` : '';
      out.push(`${'  '.repeat(d)}${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}${own ? ` "${own}"` : ''}${val}`);
      for (const k of e.children) walk(k, d + 1);
    };
    walk(root, 0);
    return out;
  };
  const btn = calib?.call && resolveCalib(calib.call, doc, 'call');
  if (btn) {
    let box = btn; for (let i = 0; i < 6 && box.parentElement && box.parentElement !== doc.body; i++) box = box.parentElement;
    lines.push('--- painel de operação (a partir do botão Comprar) ---', ...outline(box));
  } else lines.push('botão Comprar não encontrado');
  const pc = calib?.price ? (() => { try { return JSON.parse(calib.price); } catch { return { sel: calib.price }; } })() : null;
  lines.push('--- preço calibrado ---', pc ? `tag=${pc.tag} classes=${(pc.cls || []).join('.')} texto="${pc.text}"` : 'não calibrado');
  const lg = legendClose(doc);
  lines.push(`legenda Fechamento: ${lg ?? 'não encontrada'}`);
  const a = detectAsset(calib, doc);
  const pr = calib?.call ? panelReadings(calib, doc) : null;
  lines.push('--- ativo ---', `lido: ${a?.label ?? 'nenhum'} (de: ${a?.from ?? '-'})`, `painel: ${pr?.asset?.label ?? '-'} · ${pr?.payout ?? '-'} · tempo ${pr?.expiryText ?? '-'} · inv ${pr?.amountText ?? '-'}`);
  const seen = [];
  for (const e of doc.querySelectorAll('body *')) {
    if (seen.length >= 25 || e.closest('#m1-sniper-bot-host')) continue;
    const t = ownText(e);
    if (t && t.length < 40 && parseAsset(t)) {
      const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      seen.push(`${isVisible(e) ? 'VISÍVEL ' : 'oculto  '} ${e.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${t}"`);
    }
  }
  lines.push('nomes de ativos na página:', ...seen);
  return lines.join('\n');
}

const looksRight = {
  price: (el) => parsePrice(readText(el)) != null && !/%|:/.test(readText(el)),
  asset: (el) => !!parseAsset(el.textContent) || !!el.querySelector?.('*'),
  amount: (el) => parseMoney(readText(el)) != null && !/%/.test(readText(el)),
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
    if (k === 'price') return null; // preço: nunca "chuta" entre vários rótulos do eixo
    if (cands.length > 1 && c.text) { const t = cands.find((e) => readText(e).includes(c.text.slice(0, 8))); if (t) return t; }
    if (cands.length && c.pos) return nearest(cands, c.pos);
  }
  // 3) posição na tela (não vale para o preço, que se move no eixo)
  if (c.pos && doc.elementsFromPoint && k !== 'price') {
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
