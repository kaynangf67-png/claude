import { describe, expect, it } from "vitest";
import { buildChallengeView } from "./challengeView";
import { rankGuide, GUIDE_ITEMS } from "./guide";
import { MISSIONS } from "./missions";
import { addDays, daysBetween, evaluateAchievements, levelFor, nextMissionDay, totalXp, unlockedDay } from "./progress";
import type { MissionCompletion, SavedStrategy, UserData } from "./types";
import { buildSampleData } from "@/services/demoBackend";

const c = (day: number, iso: string, reflection: string | null = null): MissionCompletion => ({
  id: `c${day}`,
  userId: "u",
  day,
  completedAt: iso,
  feeling: "ok",
  reflection,
});

describe("conteúdo", () => {
  it("tem 21 missões numeradas de 1 a 21, com estratégias existentes", () => {
    expect(MISSIONS.map((m) => m.day)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    for (const m of MISSIONS) if (m.strategyId) expect(GUIDE_ITEMS.some((g) => g.id === m.strategyId)).toBe(true);
  });
});

describe("datas", () => {
  it("conta dias entre chaves locais, inclusive na virada do mês", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dia liberado", () => {
  it("libera um dia por dia, de 1 a 21", () => {
    expect(unlockedDay(null, "2026-10-22")).toBe(0);
    expect(unlockedDay("2026-10-22", "2026-10-22")).toBe(1);
    expect(unlockedDay("2026-10-20", "2026-10-22")).toBe(3);
    expect(unlockedDay("2026-09-01", "2026-10-22")).toBe(21);
  });

  it("a próxima missão é a primeira liberada e não concluída (dias perdidos continuam disponíveis)", () => {
    const done = [c(1, "2026-10-01T10:00:00Z"), c(2, "2026-10-02T10:00:00Z"), c(4, "2026-10-04T10:00:00Z")];
    expect(nextMissionDay(done, 5)).toBe(3);
    expect(nextMissionDay([c(1, "2026-10-01T10:00:00Z")], 1)).toBeNull();
  });
});

describe("XP e níveis", () => {
  it("soma missão + reflexão + estratégias (com limite) e ignora duplicadas", () => {
    const strategies: SavedStrategy[] = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, userId: "u", strategyId: `x${i}`, note: null, savedAt: "2026-10-01T00:00:00Z" }));
    const xp = totalXp([c(1, "2026-10-01T10:00:00Z", "oi"), c(1, "2026-10-01T11:00:00Z"), c(2, "2026-10-02T10:00:00Z", "  ")], strategies);
    expect(xp).toBe(120 + 100 + 100);
  });

  it("calcula nível e progresso", () => {
    expect(levelFor(0).current.name).toBe("Semente");
    const l = levelFor(500);
    expect(l.current.name).toBe("Broto");
    expect(l.xpToNext).toBe(200);
    expect(l.percentToNext).toBe(50);
    expect(levelFor(5000).next).toBeNull();
  });
});

describe("conquistas", () => {
  it("desbloqueia primeiro passo, retomada após pausa e semana 1", () => {
    const days = [1, 2, 3, 4, 5, 6, 7];
    const list = days.map((d) => c(d, `2026-10-${String(d < 4 ? d : d + 3).padStart(2, "0")}T12:00:00`));
    const a = evaluateAchievements(list, []);
    const get = (id: string) => a.find((x) => x.id === id)!;
    expect(get("primeiro-passo").unlocked).toBe(true);
    expect(get("semana-1").unlocked).toBe(true);
    expect(get("retomada").unlocked).toBe(true);
    expect(get("metade").unlocked).toBe(false);
  });
});

describe("visão do desafio", () => {
  it("a conta de exemplo está no Dia 6 com o Dia 3 pendente", () => {
    const data: UserData = buildSampleData("u", "2026-10-22");
    const v = buildChallengeView(data, "2026-10-22");
    expect(v.calendarDay).toBe(6);
    expect(v.completedCount).toBe(4);
    expect(v.nextDay).toBe(3);
    expect(v.waitingForTomorrow).toBe(false);
  });

  it("indica espera pelo dia seguinte quando tudo o que foi liberado está feito", () => {
    const data: UserData = {
      profile: {
        id: "u",
        displayName: "A",
        email: "a@a.com",
        challengeStartedOn: "2026-10-22",
        onboardingCompletedAt: "x",
        createdAt: "x",
        termsVersion: "v",
        termsAcceptedAt: "x",
        marketingOptIn: false,
      },
      quiz: null,
      completions: [c(1, "2026-10-22T10:00:00Z")],
      strategies: [],
      access: { active: true, source: "beta", cohort: "primeira-turma" },
      feedback: [],
    };
    expect(buildChallengeView(data, "2026-10-22").waitingForTomorrow).toBe(true);
  });
});

describe("guia", () => {
  it("prioriza categorias preferidas sem esconder itens", () => {
    const ranked = rankGuide(GUIDE_ITEMS, { alternatives: ["bebidas"], moments: ["manha"], budget: "economico" });
    expect(ranked).toHaveLength(GUIDE_ITEMS.length);
    expect(ranked[0]!.category).toBe("bebidas");
  });
});
