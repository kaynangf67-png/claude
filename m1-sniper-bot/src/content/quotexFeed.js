// Monta velas M1 a partir do PREÇO AO VIVO lido na tela da Quotex.
// É a mesma cotação do gráfico que o usuário vê (inclusive OTC).
// Limitações: só existe histórico a partir do momento em que a página
// ficou aberta; máximas/mínimas vêm de leituras a cada 250 ms.

const M1 = 60_000;
const MAX_CANDLES = 400;
const MAX_FILL_GAP_MIN = 2;      // lacunas curtas são preenchidas com vela "parada"
const MAX_JUMP = 0.2;            // salto > 20% em relação ao último preço = leitura errada
const STORE_PREFIX = 'm1qx:';
const STORE_MAX_AGE = 3 * M1;    // histórico salvo só vale se a última vela for recente

export class QuotexFeed {
  constructor({ storage = globalThis.chrome?.storage?.local, onClose } = {}) {
    this.storage = storage;
    this.series = new Map();   // key -> candles[]
    this.loaded = new Set();
    this.lastTick = new Map(); // key -> { t, price }
    this.rejects = new Map();  // key -> { price, n } leituras fora do padrão seguidas
    this.onClose = onClose;
  }

  async ensureLoaded(key, now) {
    if (this.loaded.has(key) || !this.storage) { this.loaded.add(key); return; }
    try {
      const got = await this.storage.get(STORE_PREFIX + key);
      const arr = got?.[STORE_PREFIX + key];
      if (Array.isArray(arr) && arr.length && now - arr.at(-1).time < STORE_MAX_AGE && !this.series.get(key)?.length) {
        this.series.set(key, arr.filter((c) => Number.isFinite(c.close)));
      }
    } catch { /* sem histórico salvo */ }
    this.loaded.add(key);
  }

  /** Registra uma leitura de preço no instante t (ms, horário corrigido). */
  tick(key, price, t) {
    if (!key || !Number.isFinite(price) || price <= 0) return false;
    const prev = this.lastTick.get(key);
    if (prev && Math.abs(price - prev.price) / prev.price > MAX_JUMP) {
      // Leitura suspeita. Se o "novo nível" se repetir por ~2 s, o errado era o
      // anterior (ex.: preço do ativo antigo lido logo após a troca): recomeça.
      const rj = this.rejects.get(key);
      const same = rj && Math.abs(price - rj.price) / rj.price < 0.02;
      const n = same ? rj.n + 1 : 1;
      this.rejects.set(key, { price, n });
      if (n < 8) return false;
      this.series.set(key, []);
      this.rejects.delete(key);
    } else this.rejects.delete(key);
    this.lastTick.set(key, { t, price });
    const m = Math.floor(t / M1) * M1;
    let arr = this.series.get(key);
    if (!arr) { arr = []; this.series.set(key, arr); }
    const last = arr.at(-1);
    if (last && last.time === m) {
      if (price > last.high) last.high = price;
      if (price < last.low) last.low = price;
      last.close = price;
      return true;
    }
    if (last && m < last.time) return false; // relógio voltou: ignora
    if (last) {
      const gap = (m - last.time) / M1 - 1;
      if (gap > MAX_FILL_GAP_MIN) arr.length = 0;               // lacuna longa: recomeça
      else for (let k = 1; k <= gap; k++) arr.push({ time: last.time + k * M1, open: last.close, high: last.close, low: last.close, close: last.close, filled: true });
      // vela inicial incompleta (página aberta no meio do minuto) é descartada
      if (arr.length && arr[0].partial && arr.length >= 1) { arr.shift(); }
      this.onClose?.(key);
    }
    const startedLate = !last && t - m > 3000;
    arr.push({ time: m, open: price, high: price, low: price, close: price, ...(startedLate ? { partial: true } : {}) });
    if (arr.length > MAX_CANDLES) arr.splice(0, arr.length - MAX_CANDLES);
    return true;
  }

  /** Velas (fechadas + a em formação), sem a vela inicial incompleta. */
  candles(key) {
    const arr = this.series.get(key) || [];
    return arr.filter((c) => !c.partial).map(({ filled, partial, ...c }) => c);
  }

  lastTickAt(key) { return this.lastTick.get(key)?.t ?? 0; }

  async persist(key) {
    if (!this.storage) return;
    const arr = (this.series.get(key) || []).filter((c) => !c.partial);
    try { await this.storage.set({ [STORE_PREFIX + key]: arr.slice(-MAX_CANDLES) }); } catch { /* cota */ }
  }
}

export function feedKey(asset) {
  return asset ? asset.label.replace(/\s+/g, ' ').trim().slice(0, 40) : null;
}
