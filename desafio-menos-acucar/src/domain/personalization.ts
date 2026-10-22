import { optionLabel } from "./quiz";
import type { MainDifficulty, MainGoal, Mission, QuizAnswers } from "./types";

const GOAL_FOCUS: Record<MainGoal, string> = {
  doces: "perceber quando os doces aparecem na sua rotina e testar trocas que façam sentido para você",
  bebidas: "olhar com atenção para o que você bebe ao longo do dia e ajustar uma bebida de cada vez",
  beliscos: "notar os beliscos automáticos e transformar alguns deles em escolhas conscientes",
  alimentacao_geral: "usar o açúcar como ponto de partida para escolhas mais conscientes no dia a dia",
};

const DIFFICULTY_TIP: Record<MainDifficulty, string> = {
  vontade_repentina: "Quando a vontade vier de repente, experimente esperar 10 minutos antes de decidir.",
  doces_a_vista: "Mudar o lugar onde os doces ficam guardados pode reduzir as decisões que você precisa tomar.",
  habito_apos_refeicao: "Criar um sinal de fim de refeição, como escovar os dentes ou tomar um chá, ajuda a quebrar o automático.",
  emocional: "Ter pausas sem comida prontas para os dias difíceis amplia suas opções, sem proibir nada.",
  rotina_corrida: "Deixar um lanche prático separado com antecedência evita decidir com pressa.",
  convivio: "Uma frase gentil e pronta deixa mais fácil recusar quando você não quiser — e aceitar quando quiser.",
};

export function goalFocus(goal: MainGoal): string {
  return GOAL_FOCUS[goal];
}

export function difficultyTip(d: MainDifficulty): string {
  return DIFFICULTY_TIP[d];
}

export interface WelcomeSummary {
  focus: string;
  moments: string[];
  tip: string;
  pace: string;
}

export function welcomeSummary(q: QuizAnswers): WelcomeSummary {
  return {
    focus: GOAL_FOCUS[q.goal],
    moments: q.moments.map((m) => optionLabel("moments", m)),
    tip: DIFFICULTY_TIP[q.difficulty],
    pace:
      q.dailyTime === "5"
        ? "Vamos destacar a versão rápida de cada missão, que cabe em 5 minutos."
        : q.dailyTime === "10"
          ? "As missões levam cerca de 10 minutos. Nos dias corridos, use a versão rápida."
          : "Você terá tempo para a versão completa das missões e para escrever suas reflexões.",
  };
}

/** A versão rápida vem primeiro para quem tem até 5 minutos. */
export function prefersQuickVersion(q: QuizAnswers | null, mission: Mission): boolean {
  if (!q) return false;
  return q.dailyTime === "5" || (q.dailyTime === "10" && mission.minutes > 10);
}
