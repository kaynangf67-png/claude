import { describe, expect, it } from "vitest";
import { signUpSchema } from "@/validation/schemas";
import { compactAnswers, FEEDBACK_STAGES, isStageOpen, pendingStage } from "./feedback";

describe("pesquisas da Primeira Turma", () => {
  it("abrem no momento certo: inicial após o quiz, dia 7 e dia 21 pelo calendário ou pelas missões", () => {
    expect(isStageOpen("inicial", 0, 0)).toBe(false);
    expect(isStageOpen("inicial", 1, 0)).toBe(true);
    expect(isStageOpen("dia7", 6, 6)).toBe(false);
    expect(isStageOpen("dia7", 7, 0)).toBe(true);
    expect(isStageOpen("dia21", 21, 3)).toBe(true);
    expect(isStageOpen("dia21", 15, 15)).toBe(false);
  });

  it("oferece a pesquisa aberta mais recente e não repete as respondidas", () => {
    expect(pendingStage([], 1, 0)).toBe("inicial");
    expect(pendingStage(["inicial"], 3, 3)).toBeNull();
    expect(pendingStage(["inicial"], 7, 5)).toBe("dia7");
    expect(pendingStage([], 21, 21)).toBe("dia21");
    expect(pendingStage(["dia21"], 21, 21)).toBe("dia7");
  });

  it("não envia perguntas puladas e corta respostas longas", () => {
    const out = compactAnswers({ a: "  ", b: " sim ", c: "x".repeat(2000) });
    expect(out).toEqual({ b: "sim", c: "x".repeat(1000) });
  });

  it("usa as mesmas chaves validadas pelo banco", () => {
    expect(FEEDBACK_STAGES.inicial.questions.map((q) => q.key)).toEqual(["interesse", "dificuldade", "utilidade"]);
    expect(FEEDBACK_STAGES.dia7.questions.map((q) => q.key)).toEqual(["facilidade", "mais_util", "impedimentos", "melhorias"]);
    expect(FEEDBACK_STAGES.dia21.questions.map((q) => q.key)).toEqual([
      "quanto_completou",
      "estrategias",
      "faltou",
      "recomendaria",
      "recomendaria_motivo",
      "pagaria",
      "pagaria_expectativa",
    ]);
  });
});

describe("cadastro", () => {
  const base = { displayName: "Ana", email: "ana@x.com", password: "12345678", marketingOptIn: false };
  it("exige o aceite do aviso de privacidade, mas não o de novidades", () => {
    expect(signUpSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, acceptTerms: true }).success).toBe(true);
  });
});
