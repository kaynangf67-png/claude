import type { Candle } from "./signal.js";

/**
 * Zonas de H1 (pavios e fechamentos de velas de 1 hora) e um setup de M5 em cima delas.
 * Regras definidas aqui, não validadas com histórico. Use como hipótese até o teste de resultado.
 */

export interface Zone { price: number; touches: number }
export interface Zones { resistances: Zone[]; supports: Zone[] }
export type SetupKind = "rompimento" | "rejeição";
export interface Setup {
  dir: "CALL" | "PUT";
  kind: SetupKind;
  zone: number;       // nível de H1 usado
  stop: number;       // preço de invalidação
  target: number | null; // próxima zona de H1 na direção
  rr: number | null;     // relação ganho/risco
}

/** Agrupa máximas e mínimas de H1 próximas entre si. Um nível só vale com pelo menos 2 toques. */
export function h1Zones(h1: Candle[], price: number, tolPct = 0.0015, lookback = 72): Zones {
  const levels: number[] = [];
  for (const k of h1.slice(-lookback)) levels.push(k.h, k.l);
  levels.sort((a, b) => a - b);
  const clusters: { sum: number; n: number }[] = [];
  for (const v of levels) {
    const last = clusters.at(-1);
    if (last && Math.abs(v - last.sum / last.n) / v <= tolPct) { last.sum += v; last.n++; }
    else clusters.push({ sum: v, n: 1 });
  }
  const zones = clusters.filter((c) => c.n >= 2).map((c) => ({ price: c.sum / c.n, touches: c.n }));
  return {
    resistances: zones.filter((z) => z.price > price).sort((a, b) => a.price - b.price).slice(0, 3),
    supports: zones.filter((z) => z.price < price).sort((a, b) => b.price - a.price).slice(0, 3),
  };
}

/** Setup na última vela fechada de M5 em relação à zona de H1 mais próxima. Relação ganho/risco mínima de 1,5. */
export function setupFromZones(m5: Candle[], z: Zones): Setup | null {
  if (m5.length < 2) return null;
  const p = m5[m5.length - 2], c = m5[m5.length - 1];
  const R = z.resistances[0]?.price, S = z.supports[0]?.price;
  const R2 = z.resistances[1]?.price, S2 = z.supports[1]?.price;
  const out = (dir: "CALL" | "PUT", kind: SetupKind, zone: number, stop: number, target: number | undefined): Setup | null => {
    const risk = Math.abs(zone - stop);
    const reward = target === undefined ? null : Math.abs(target - c.c);
    const rr = reward === null || risk === 0 ? null : reward / risk;
    if (rr !== null && rr < 1.5) return null;
    return { dir, kind, zone, stop, target: target ?? null, rr };
  };
  // rompimento de resistência: fechou acima do nível depois de estar abaixo
  if (R !== undefined && p.c <= R && c.c > R * 1.0002) return out("CALL", "rompimento", R, R * 0.9985, R2);
  // rompimento de suporte
  if (S !== undefined && p.c >= S && c.c < S * 0.9998) return out("PUT", "rompimento", S, S * 1.0015, S2);
  // rejeição na resistência: tocou o nível e fechou abaixo, com vela de baixa
  if (R !== undefined && c.h >= R * 0.9995 && c.c < R && c.c < c.o) return out("PUT", "rejeição", R, R * 1.0015, S);
  // rejeição no suporte: tocou o nível e fechou acima, com vela de alta
  if (S !== undefined && c.l <= S * 1.0005 && c.c > S && c.c > c.o) return out("CALL", "rejeição", S, S * 0.9985, R);
  return null;
}

export function zonesText(z: Zones): string {
  const f = (v: number) => Number(v.toPrecision(6));
  const r = z.resistances.map((x) => `${f(x.price)} (${x.touches} toques)`).join(", ") || "nenhuma acima";
  const s = z.supports.map((x) => `${f(x.price)} (${x.touches} toques)`).join(", ") || "nenhum abaixo";
  return `Zonas de H1 (pavios e fechamentos das últimas 72 horas): resistências ${r}; suportes ${s}.`;
}
