import { describe, expect, it } from "vitest";
import { DemoBackend, type KeyValueStorage } from "./demoBackend";

class MemoryStorage implements KeyValueStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const answers = {
  goal: "doces",
  moments: ["tarde"],
  frequency: "uma_vez_dia",
  difficulty: "emocional",
  dailyTime: "5",
  alternatives: ["frutas"],
  budget: "nao_informar",
} as const;

describe("DemoBackend", () => {
  it("cadastra, faz login, salva quiz e conclui só missões liberadas", async () => {
    const b = new DemoBackend(new MemoryStorage());
    expect((await b.signUp({ displayName: "Ana", email: "ana@x.com", password: "12345678" })).ok).toBe(true);
    await b.signOut();
    expect((await b.signIn({ email: "ana@x.com", password: "errada" })).ok).toBe(false);
    expect((await b.signIn({ email: "ana@x.com", password: "12345678" })).ok).toBe(true);

    expect((await b.saveQuiz({ ...answers, moments: [...answers.moments], alternatives: [...answers.alternatives] }, "2026-10-22")).ok).toBe(true);
    expect((await b.completeMission({ day: 2, feeling: "ok", reflection: null }, "2026-10-22")).ok).toBe(false);
    expect((await b.completeMission({ day: 1, feeling: "ok", reflection: null }, "2026-10-22")).ok).toBe(true);
    expect((await b.completeMission({ day: 1, feeling: "ok", reflection: null }, "2026-10-22")).ok).toBe(false);
    expect((await b.completeMission({ day: 2, feeling: "facil", reflection: "x" }, "2026-10-23")).ok).toBe(true);

    const data = await b.loadUserData();
    expect(data.ok && data.data.completions.length).toBe(2);
    expect(data.ok && data.data.profile.challengeStartedOn).toBe("2026-10-22");
  });

  it("rejeita quiz inválido e estratégia inexistente", async () => {
    const b = new DemoBackend(new MemoryStorage());
    await b.signUp({ displayName: "Bia", email: "bia@x.com", password: "12345678" });
    expect((await b.saveQuiz({ ...answers, moments: [], alternatives: ["frutas"] }, "2026-10-22")).ok).toBe(false);
    expect((await b.saveStrategy("nao-existe")).ok).toBe(false);
    expect((await b.saveStrategy("regra-10-minutos")).ok).toBe(true);
  });
});
