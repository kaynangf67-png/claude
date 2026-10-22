import { z } from "zod";

const goal = z.enum(["doces", "bebidas", "beliscos", "alimentacao_geral"], {
  error: "Escolha um objetivo para continuar.",
});
const moment = z.enum([
  "manha",
  "apos_almoco",
  "tarde",
  "apos_jantar",
  "noite",
  "estresse",
  "tedio",
  "social",
  "fim_de_semana",
]);
const frequency = z.enum(["raramente", "algumas_vezes_semana", "uma_vez_dia", "varias_vezes_dia"], {
  error: "Escolha a opção mais próxima da sua rotina.",
});
const difficulty = z.enum(
  ["vontade_repentina", "doces_a_vista", "habito_apos_refeicao", "emocional", "rotina_corrida", "convivio"],
  { error: "Escolha a dificuldade que mais pesa para você." },
);
const dailyTime = z.enum(["5", "10", "20"], { error: "Escolha quanto tempo você tem por dia." });
const alternative = z.enum(["frutas", "bebidas", "lanches_salgados", "receitas_rapidas", "estrategias"]);
const budget = z.enum(["economico", "moderado", "flexivel", "nao_informar"], {
  error: "Escolha uma opção (pode ser “Prefiro não informar”).",
});

/** Um schema por pergunta, usado para validar cada tela do quiz. */
export const quizStepSchemas = {
  goal,
  moments: z
    .array(moment, { error: "Marque pelo menos uma situação." })
    .min(1, "Marque pelo menos uma situação.")
    .max(3, "Marque no máximo 3 situações."),
  frequency,
  difficulty,
  dailyTime,
  alternatives: z
    .array(alternative, { error: "Marque pelo menos um tipo de alternativa." })
    .min(1, "Marque pelo menos um tipo de alternativa."),
  budget,
} as const;

export const quizAnswersSchema = z.object(quizStepSchemas);

export const quizDraftSchema = quizAnswersSchema.partial().extend({
  step: z.number().int().min(0).max(20).default(0),
});

const email = z.string().trim().toLowerCase().email("Digite um e-mail válido.").max(254, "E-mail muito longo.");

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Digite como você gostaria de ser chamado(a).")
    .max(40, "Use no máximo 40 caracteres."),
  email,
  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(72, "A senha pode ter no máximo 72 caracteres."),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Digite sua senha."),
});

export const missionCompletionSchema = z.object({
  day: z.number().int().min(1).max(21),
  feeling: z.enum(["facil", "ok", "desafiador"], { error: "Conte como foi a missão." }),
  reflection: z
    .string()
    .trim()
    .max(600, "Use no máximo 600 caracteres.")
    .transform((v) => (v.length ? v : null))
    .nullable(),
});

export const profileUpdateSchema = z.object({
  displayName: signUpSchema.shape.displayName,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type MissionCompletionInput = z.input<typeof missionCompletionSchema>;

/** Converte o erro do zod em { campo: mensagem } para os formulários. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
