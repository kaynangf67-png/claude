import { describe, expect, it } from "vitest";
import { h1Zones, setupFromZones } from "./zones";
import type { Candle } from "./signal";

const h = (t: number, o: number, hi: number, lo: number, c: number): Candle => ({ t, o, h: hi, l: lo, c });

describe("zonas de H1", () => {
  it("um pavio repetido vira zona; nível tocado uma vez não entra", () => {
    const h1 = [h(0, 1, 1.1005, 0.999, 1.0), h(1, 1, 1.1003, 0.998, 1.0), h(2, 1, 1.0, 0.9, 0.95)];
    const z = h1Zones(h1, 1.0);
    expect(z.resistances[0].price).toBeCloseTo(1.1004, 4);
    expect(z.resistances[0].touches).toBe(2);
    expect(z.supports[0].touches).toBe(2); // 0.999 e 0.998 também formam um nível repetido
    expect(z.supports[0].price).toBeCloseTo(0.9985, 4);
  });
});

describe("setup de M5", () => {
  const z = { resistances: [{ price: 1.1, touches: 3 }, { price: 1.12, touches: 2 }], supports: [{ price: 1.08, touches: 2 }] };
  it("rompimento de resistência gera CALL com alvo na próxima zona", () => {
    const m5 = [h(0, 1.095, 1.099, 1.094, 1.098), h(1, 1.099, 1.104, 1.098, 1.103)];
    const s = setupFromZones(m5, z);
    expect(s?.dir).toBe("CALL");
    expect(s?.kind).toBe("rompimento");
    expect(s?.target).toBe(1.12);
  });
  it("rejeição na resistência com vela de baixa gera PUT", () => {
    const m5 = [h(0, 1.095, 1.099, 1.094, 1.098), h(1, 1.099, 1.1005, 1.097, 1.0975)];
    const s = setupFromZones(m5, z);
    expect(s?.dir).toBe("PUT");
    expect(s?.kind).toBe("rejeição");
  });
  it("sem zona por perto não há setup", () => {
    const m5 = [h(0, 1.09, 1.091, 1.089, 1.09), h(1, 1.09, 1.092, 1.089, 1.091)];
    expect(setupFromZones(m5, z)).toBeNull();
  });
  it("relação ganho/risco abaixo de 1,5 não gera setup", () => {
    const zz = { resistances: [{ price: 1.1, touches: 3 }, { price: 1.1008, touches: 2 }], supports: [] };
    const m5 = [h(0, 1.095, 1.099, 1.094, 1.098), h(1, 1.099, 1.104, 1.098, 1.103)];
    expect(setupFromZones(m5, zz)).toBeNull();
  });
});
