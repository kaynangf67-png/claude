import { CHALLENGE_DAYS } from "./missions";

// Pesquisas curtas da Primeira Turma. Todas as perguntas são opcionais e neutras:
// o objetivo é entender o produto, não colher elogios. Nada de dados de saúde.
// As chaves e opções espelham a validação de public.submit_feedback() no banco.

export type FeedbackStage = "inicial" | "dia7" | "dia21" | "geral";

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface FeedbackQuestion {
  key: string;
  label: string;
  kind: "text" | "choice";
  options?: ChoiceOption[];
  placeholder?: string;
}

export interface FeedbackStageDef {
  stage: Exclude<FeedbackStage, "geral">;
  title: string;
  intro: string;
  questions: FeedbackQuestion[];
}

export const FEEDBACK_STAGES: Record<Exclude<FeedbackStage, "geral">, FeedbackStageDef> = {
  inicial: {
    stage: "inicial",
    title: "Antes de começar",
    intro: "Três perguntas rápidas sobre o que você espera. Responda só o que quiser.",
    questions: [
      { key: "interesse", kind: "text", label: "O que fez você se interessar por este desafio?" },
      { key: "dificuldade", kind: "text", label: "Qual é a principal dificuldade que você quer trabalhar?" },
      { key: "utilidade", kind: "text", label: "O que tornaria esta experiência útil para você?" },
    ],
  },
  dia7: {
    stage: "dia7",
    title: "Uma semana de desafio",
    intro: "Sua opinião sincera ajuda a melhorar a próxima versão. Críticas são tão úteis quanto elogios.",
    questions: [
      {
        key: "facilidade",
        kind: "choice",
        label: "Até agora, usar o desafio foi:",
        options: [
          { value: "muito_facil", label: "Muito fácil" },
          { value: "facil", label: "Fácil" },
          { value: "neutro", label: "Nem fácil nem difícil" },
          { value: "dificil", label: "Difícil" },
          { value: "muito_dificil", label: "Muito difícil" },
        ],
      },
      { key: "mais_util", kind: "text", label: "Qual missão ou ideia foi mais útil até aqui?" },
      { key: "impedimentos", kind: "text", label: "O que atrapalhou você de fazer as missões, se algo atrapalhou?" },
      { key: "melhorias", kind: "text", label: "O que você melhoraria?" },
    ],
  },
  dia21: {
    stage: "dia21",
    title: "Fim da Primeira Turma",
    intro: "Últimas perguntas. Vale qualquer resposta, inclusive “não completei” ou “não pagaria”.",
    questions: [
      {
        key: "quanto_completou",
        kind: "choice",
        label: "Quanto do desafio você conseguiu fazer?",
        options: [
          { value: "tudo", label: "Todas ou quase todas as missões" },
          { value: "mais_da_metade", label: "Mais da metade" },
          { value: "menos_da_metade", label: "Menos da metade" },
          { value: "quase_nada", label: "Quase nada" },
        ],
      },
      { key: "estrategias", kind: "text", label: "Quais estratégias você pretende continuar usando, se alguma?" },
      { key: "faltou", kind: "text", label: "O que faltou na experiência?" },
      {
        key: "recomendaria",
        kind: "choice",
        label: "Você recomendaria para alguém com objetivos parecidos?",
        options: [
          { value: "sim", label: "Sim" },
          { value: "talvez", label: "Talvez" },
          { value: "nao", label: "Não" },
        ],
      },
      { key: "recomendaria_motivo", kind: "text", label: "Por quê?" },
      {
        key: "pagaria",
        kind: "choice",
        label: "Você consideraria pagar por uma versão melhorada?",
        options: [
          { value: "sim", label: "Sim" },
          { value: "talvez", label: "Talvez" },
          { value: "nao", label: "Não" },
        ],
      },
      { key: "pagaria_expectativa", kind: "text", label: "O que você esperaria que ela incluísse?" },
    ],
  },
};

export const CONTACT_TOPICS: ChoiceOption[] = [
  { value: "sugestao", label: "Sugestão" },
  { value: "problema", label: "Algo não funcionou" },
  { value: "privacidade", label: "Meus dados / privacidade" },
  { value: "outro", label: "Outro assunto" },
];

export const FEEDBACK_TEXT_MAX = 1000;

/** Etapa liberada no mesmo critério do banco (submit_feedback). */
export function isStageOpen(stage: Exclude<FeedbackStage, "geral">, unlockedDay: number, completedCount: number): boolean {
  if (stage === "inicial") return unlockedDay >= 1;
  if (stage === "dia7") return unlockedDay >= 7 || completedCount >= 7;
  return unlockedDay >= CHALLENGE_DAYS || completedCount >= CHALLENGE_DAYS;
}

/** A pesquisa que deve ser oferecida agora (a mais recente aberta e ainda não respondida). */
export function pendingStage(
  answered: FeedbackStage[],
  unlockedDay: number,
  completedCount: number,
): Exclude<FeedbackStage, "geral"> | null {
  const order: Exclude<FeedbackStage, "geral">[] = ["dia21", "dia7", "inicial"];
  for (const s of order) if (isStageOpen(s, unlockedDay, completedCount) && !answered.includes(s)) return s;
  return null;
}

/** Remove respostas vazias: perguntas puladas não são enviadas. */
export function compactAnswers(answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    const t = v.trim();
    if (t) out[k] = t.slice(0, FEEDBACK_TEXT_MAX);
  }
  return out;
}
