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
    expect((await b.signUp({ displayName: "Ana", email: "ana@x.com", password: "12345678", acceptTerms: true, marketingOptIn: false })).ok).toBe(true);
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
    await b.signUp({ displayName: "Bia", email: "bia@x.com", password: "12345678", acceptTerms: true, marketingOptIn: false });
    expect((await b.saveQuiz({ ...answers, moments: [], alternatives: ["frutas"] }, "2026-10-22")).ok).toBe(false);
    expect((await b.saveStrategy("nao-existe")).ok).toBe(false);
    expect((await b.saveStrategy("regra-10-minutos")).ok).toBe(true);
  });
});

describe("DemoBackend · Primeira Turma", () => {
  it("cria a conta com consentimento e acesso beta, e registra cada pesquisa uma vez", async () => {
    const b = new DemoBackend(new MemoryStorage());
    await b.signUp({ displayName: "Caio", email: "caio@x.com", password: "12345678", acceptTerms: true, marketingOptIn: true });
    let d = await b.loadUserData();
    expect(d.ok && d.data.access.active).toBe(true);
    expect(d.ok && d.data.profile.termsVersion).toBeTruthy();
    expect(d.ok && d.data.profile.marketingOptIn).toBe(true);

    // Antes do quiz, nenhuma etapa está aberta.
    expect((await b.submitFeedback("inicial", { interesse: "x" }, "2026-10-22")).ok).toBe(false);
    await b.saveQuiz({ ...answers, moments: [...answers.moments], alternatives: [...answers.alternatives] }, "2026-10-22");
    expect((await b.submitFeedback("inicial", { interesse: "x" }, "2026-10-22")).ok).toBe(true);
    expect((await b.submitFeedback("inicial", { interesse: "de novo" }, "2026-10-22")).ok).toBe(false);
    expect((await b.submitFeedback("dia7", {}, "2026-10-22")).ok).toBe(false);
    expect((await b.submitFeedback("dia7", {}, "2026-10-28")).ok).toBe(true);
    expect((await b.submitFeedback("geral", { mensagem: "oi" }, "2026-10-28")).ok).toBe(true);
    expect((await b.submitFeedback("geral", { mensagem: "oi de novo" }, "2026-10-28")).ok).toBe(true);

    d = await b.loadUserData();
    expect(d.ok && d.data.feedback.map((f) => f.stage)).toEqual(["inicial", "dia7", "geral", "geral"]);

    // Novidades por e-mail podem ser desligadas sem afetar o acesso.
    await b.setMarketingConsent(false);
    d = await b.loadUserData();
    expect(d.ok && d.data.profile.marketingOptIn).toBe(false);
    expect(d.ok && d.data.access.active).toBe(true);
  });

  it("não deixa a mesma missão contar XP duas vezes", async () => {
    const b = new DemoBackend(new MemoryStorage());
    await b.signUp({ displayName: "Duda", email: "duda@x.com", password: "12345678", acceptTerms: true, marketingOptIn: false });
    await b.saveQuiz({ ...answers, moments: [...answers.moments], alternatives: [...answers.alternatives] }, "2026-10-22");
    expect((await b.completeMission({ day: 1, feeling: "ok", reflection: "a" }, "2026-10-22")).ok).toBe(true);
    expect((await b.completeMission({ day: 1, feeling: "ok", reflection: "b" }, "2026-10-22")).ok).toBe(false);
    const d = await b.loadUserData();
    expect(d.ok && d.data.completions.length).toBe(1);
  });

  it("o painel do fundador não existe no modo demonstração", async () => {
    const b = new DemoBackend(new MemoryStorage());
    expect((await b.adminMetrics()).ok).toBe(false);
  });
});
