import { describe, expect, it } from "vitest";
import { runBacktest } from "./backtest.js";
import { assessQuality } from "./candles.js";
import { analyze, relabel, swingRisk } from "./engine.js";
import { handleForexAnalyze, handleForexBacktest, setupStrength, type Deps } from "./handlers.js";
import { aggregate as aggUtc } from "./marketData.js";
import { aggregate, noisy } from "./testkit.js";
import type { Candle, TF } from "./types.js";

/** Mesma forma de mercado da suíte curta, mas com velas de 1 hora (setup do swing). */
const H = 3600;
const h1 = noisy(15, 3400).map((k, i) => ({ ...k, t: 1_800_000_000 - (1_800_000_000 % 86400) + i * H }));
const d1 = aggUtc(h1, 86400);
const nowS = h1.at(-1)!.t + H;

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

describe("H4 montado a partir do H1", () => {
  it("agrupa em blocos UTC de 4 horas com OHLC corretos", () => {
    const base = 1_800_000_000 - (1_800_000_000 % 14400);
    const c: Candle[] = [0, 1, 2, 3, 4].map((i) => ({ t: base + i * H, o: 1 + i, h: 2 + i, l: 0.5 + i, c: 1.5 + i }));
    const h4 = aggUtc(c, 14400);
    expect(h4).toHaveLength(2);
    expect(h4[0]).toEqual({ t: base, o: 1, h: 5, l: 0.5, c: 4.5, v: undefined });
    expect(h4[1].t).toBe(base + 14400);
  });
});

describe("qualidade dos dados no swing", () => {
  it("vela diária fechada há 20 horas é normal no D1, mas seria atraso no H1", () => {
    const now = d1.at(-1)!.t + 86400 + 20 * H;
    expect(assessQuality(d1, "D1", now).issues.some((x) => x.includes("última vela"))).toBe(false);
    const h1Old = h1.map((k) => ({ ...k }));
    expect(assessQuality(h1Old, "H1", h1Old.at(-1)!.t + H + 20 * H).issues.some((x) => x.includes("última vela"))).toBe(true);
  });
  it("lacuna de fim de semana não conta como vela faltando no D1", () => {
    const weekdays = d1.filter((k) => { const wd = new Date(k.t * 1000).getUTCDay(); return wd !== 0 && wd !== 6; });
    expect(assessQuality(weekdays, "D1", weekdays.at(-1)!.t + 86400, false).issues.join(" ")).not.toMatch(/faltando/);
  });
});

describe("motor no horizonte swing", () => {
  const base = { symbol: "EURUSD", label: "EUR/USD", pip: 0.0001, currencies: ["EUR", "USD"], now: nowS, events: [], skipFreshness: true };
  it("mesma lógica do curto, só com rótulos de D1/H4/H1/M15", () => {
    const candles = { H1: d1, M5: h1, M1: null, M15: null };
    const curto = analyze({ ...base, candles });
    const swing = analyze({ ...base, candles, horizon: "swing" });
    expect(swing.horizon).toBe("swing");
    expect(curto.horizon).toBe("curto");
    expect(swing.data.ok).toBe(true); // 3400 velas H1 → 141 D1, acima do mínimo de 120
    expect(swing.decision).toBe(curto.decision);
    expect(swing.trade?.sl).toBe(curto.trade?.sl);
    expect(swing.tfs.M5.tf).toBe("H1"); // a chave é o papel (setup); o rótulo é o tempo gráfico real
    expect(swing.tfs.H1.tf).toBe("D1");
    const txt = strings(swing).join("\n");
    expect(txt).not.toMatch(/\bM5\b/);
    expect(txt).not.toMatch(/últimos 30 minutos|operação curta/);
    if (swing.trade) expect(swing.trade.maxHoldMin).toBe(5 * 24 * 60);
    expect(swing.context30).toMatch(/últimas 6 horas \(6 velas H1\)/);
  });
  it("relabel troca D1/H4/H1/M15 de uma vez, sem trocar em cadeia", () => {
    expect(relabel("H1 e M5 e M1 e M15", { H1: "D1", M15: "H4", M5: "H1", M1: "M15" })).toBe("D1 e H1 e M15 e H4");
  });
});

describe("/api/forex com horizon=swing", () => {
  it("busca D1, H1, M15 e H4 e devolve o horizonte e os papéis", async () => {
    const asked: TF[] = [];
    const series: Deps["series"] = async (_id, tf) => {
      asked.push(tf);
      if (tf === "M15") throw new Error("sem M15");
      const c = tf === "D1" ? d1 : tf === "H4" ? aggregate(h1, 4) : h1;
      return { candles: c, duplicates: 0, invalid: 0 };
    };
    const res = await handleForexAnalyze(new Request("http://x/api/forex", { method: "POST", body: JSON.stringify({ asset: "EURUSD", horizon: "swing", explain: false }) }),
      { series, calendar: async () => [], now: () => nowS * 1000 });
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(asked.sort()).toEqual(["D1", "H1", "H4", "M15"]);
    expect(j.horizon).toBe("swing");
    expect(j.roleTf).toEqual({ ctx: "D1", struct: "H4", setup: "H1", trigger: "M15" });
    expect(j.data.issues.join(" ")).not.toMatch(/\bM5\b/);
    expect(JSON.stringify(j)).not.toMatch(/NaN/);
  });
  it("sem horizon continua no curto (H1, M5, M1, M15)", async () => {
    const asked: TF[] = [];
    const series: Deps["series"] = async (_id, tf) => { asked.push(tf); throw new Error("x"); };
    await handleForexAnalyze(new Request("http://x/api/forex", { method: "POST", body: JSON.stringify({ asset: "EURUSD" }) }), { series, calendar: async () => [] });
    expect(asked.sort()).toEqual(["H1", "M1", "M15", "M5"]);
  });
});

describe("backtest swing", () => {
  it("anda vela a vela no H1 com contexto D1, e cada operação dura no máximo 120 velas", () => {
    const r = runBacktest(h1, d1, { pip: 0.0001, label: "EUR/USD", symbol: "EURUSD", currencies: ["EUR", "USD"], horizon: "swing", budgetMs: 20_000 });
    expect(r.analyzed).toBeGreaterThan(0);
    for (const t of r.list) {
      expect(t.tf).toBe("H1");
      expect((t.closedAt ?? t.at) - t.at).toBeLessThanOrEqual(120 * H);
    }
  });
  it("rota aceita horizon=swing", async () => {
    const series: Deps["series"] = async (_id, tf) => ({ candles: tf === "D1" ? d1 : h1, duplicates: 0, invalid: 0 });
    const j = await (await handleForexBacktest(new Request("http://x/api/forex-backtest?symbol=EURUSD&horizon=swing&stride=6"), { series, now: () => nowS * 1000 })).json();
    expect(j.horizon).toBe("swing");
    expect(j.period.tfSeconds).toBe(3600);
  });
});

describe("stop do swing pela estrutura do H4", () => {
  const h4 = (pivots: { price: number; type: "high" | "low" }[]) => ({ pivots: pivots.map((p, i) => ({ ...p, i, t: i })) }) as never;
  it("compra: stop no último fundo do H4 abaixo da entrada, se for mais longe que o do setup", () => {
    const r = swingRisk("BUY", 1.1, 1.099, h4([{ price: 1.095, type: "low" }, { price: 1.12, type: "high" }, { price: 1.097, type: "low" }]), 0.001);
    expect(r.invalidation).toBe(1.097);
  });
  it("venda: stop no último topo do H4 acima da entrada", () => {
    expect(swingRisk("SELL", 1.1, 1.101, h4([{ price: 1.104, type: "high" }]), 0.001).invalidation).toBe(1.104);
  });
  it("sem H4 ou sem pivô além da entrada, fica a invalidação do setup", () => {
    expect(swingRisk("BUY", 1.1, 1.099, null, 0.001).invalidation).toBe(1.099);
    expect(swingRisk("BUY", 1.1, 1.099, h4([{ price: 1.105, type: "low" }]), 0.001).invalidation).toBe(1.099);
  });
  it("no motor, o stop do swing fica a pelo menos 1 ATR do H4 da entrada", () => {
    const h4c = aggUtc(h1, 14400);
    const s = analyze({ symbol: "EURUSD", label: "EUR/USD", pip: 0.0001, currencies: ["EUR", "USD"], now: nowS, events: [], skipFreshness: true,
      candles: { H1: d1, M15: h4c, M5: h1, M1: null }, horizon: "swing" });
    expect(s.tfs.M15?.tf).toBe("H4");
    for (const c of [s.trade, s.plan].filter(Boolean) as { entry: number; sl: number }[])
      expect(Math.abs(c.entry - c.sl)).toBeGreaterThanOrEqual(s.tfs.M15!.atr * 0.999);
    expect(strings(s).join(" ")).not.toMatch(/ATR do H1/);
  });
});

describe("tempo gráfico escolhido (tf)", () => {
  const m5 = noisy(15, 2360);
  const byTf = (tf: TF): Candle[] => {
    const step = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 }[tf];
    return m5.map((k, i) => ({ ...k, t: 1_800_000_000 - (1_800_000_000 % 86400) + i * step }));
  };
  const call = async (tf: string) => {
    const asked: TF[] = [];
    const series: Deps["series"] = async (_id, t) => { asked.push(t); return { candles: byTf(t), duplicates: 0, invalid: 0 }; };
    const r = await handleForexAnalyze(new Request("http://x/api/forex", { method: "POST", body: JSON.stringify({ asset: "EURUSD", tf, explain: false }) }),
      { series, calendar: async () => [], now: () => (byTf("M1").at(-1)!.t + 60) * 1000 });
    return { j: await r.json(), asked: asked.sort(), status: r.status };
  };
  it("M15: contexto H4, estrutura H1, setup M15, gatilho M5 (day trade)", async () => {
    const { j, asked, status } = await call("M15");
    expect(status).toBe(200);
    expect(asked).toEqual(["H1", "H4", "M15", "M5"]);
    expect(j.roleTf).toEqual({ ctx: "H4", struct: "H1", setup: "M15", trigger: "M5" });
    expect(j.horizon).toBe("curto");
    expect(j.context30).toMatch(/últimas 1,5 horas \(6 velas M15\)/);
  });
  it("M1 busca cada tempo uma vez só; H4 vira swing com contexto D1", async () => {
    const m1 = await call("M1");
    expect(m1.asked).toEqual(["M1", "M15", "M5"]);
    expect(m1.j.roleTf.setup).toBe("M1");
    const h4 = await call("H4");
    expect(h4.asked).toEqual(["D1", "H1", "H4"]);
    expect(h4.j.horizon).toBe("swing");
  });
  it("tf inválido cai no horizonte", async () => {
    const { asked } = await call("M7");
    expect(asked).toEqual(["H1", "M1", "M15", "M5"]);
  });
});

describe("IA recomenda o tempo gráfico (tf=auto)", () => {
  const m5 = noisy(15, 2360);
  const byTf = (tf: TF): Candle[] => {
    const step = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 }[tf];
    return m5.map((k, i) => ({ ...k, t: 1_800_000_000 - (1_800_000_000 % 86400) + i * step }));
  };
  const call = async (horizon: string, fail?: TF) => {
    const asked: TF[] = [];
    const series: Deps["series"] = async (_id, t) => { asked.push(t); if (t === fail) throw new Error("fora"); return { candles: byTf(t), duplicates: 0, invalid: 0 }; };
    const r = await handleForexAnalyze(new Request("http://x/api/forex", { method: "POST", body: JSON.stringify({ asset: "EURUSD", tf: "auto", horizon, explain: false }) }),
      { series, calendar: async () => [], now: () => (byTf("M1").at(-1)!.t + 60) * 1000 });
    return { j: await r.json(), asked: asked.sort(), status: r.status };
  };
  it("day trade compara M1, M5 e M15, busca cada tempo uma vez e devolve o de setup mais forte", async () => {
    const { j, asked, status } = await call("curto");
    expect(status).toBe(200);
    expect(asked).toEqual(["H1", "H4", "M1", "M15", "M5"]);
    expect(j.autoPick.ranking.map((x: { tf: string }) => x.tf).sort()).toEqual(["M1", "M15", "M5"]);
    expect(j.autoPick.tf).toBe(j.autoPick.ranking[0].tf);
    expect(j.roleTf.setup).toBe(j.autoPick.tf);
    expect(j.autoPick.reason.length).toBeGreaterThan(10);
  });
  it("swing compara H1 e H4", async () => {
    const { j } = await call("swing");
    expect(j.horizon).toBe("swing");
    expect(j.autoPick.ranking.map((x: { tf: string }) => x.tf).sort()).toEqual(["H1", "H4"]);
  });
  it("se um tempo falha, os outros seguem; se todos falham, 502", async () => {
    const ok = await call("swing", "H4"); // H4 é setup do H4 → só sobra o H1
    expect(ok.status).toBe(200);
    expect(ok.j.autoPick.ranking.map((x: { tf: string }) => x.tf)).toEqual(["H1"]);
    expect((await call("swing", "D1")).status).toBe(502); // D1 é o contexto dos dois
  });
  it("ordem: dados válidos > entrada > aguardando > nada; depois confluência", () => {
    const mk = (state: string, score: number | null, ok = true) => ({ state, score: score === null ? null : { total: score }, data: { ok }, trade: null }) as never;
    const order = [mk("sem_operacao", 90), mk("entrada_confirmada", 70), mk("aguardando_confirmacao", 95), mk("entrada_confirmada", 80), mk("entrada_confirmada", 99, false)]
      .sort((a, b) => setupStrength(b) - setupStrength(a)).map((x: { state: string; score: { total: number } | null }) => `${x.state}:${x.score?.total}`);
    expect(order).toEqual(["entrada_confirmada:80", "entrada_confirmada:70", "aguardando_confirmacao:95", "sem_operacao:90", "entrada_confirmada:99"]);
  });
});
