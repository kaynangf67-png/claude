import type { QuizAnswers } from "./types";

export interface QuizOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
}

interface BaseQuestion<K extends keyof QuizAnswers> {
  id: K;
  title: string;
  description: string;
}

export interface SingleQuestion<K extends keyof QuizAnswers> extends BaseQuestion<K> {
  kind: "single";
  options: QuizOption<Extract<QuizAnswers[K], string>>[];
}

export interface MultiQuestion<K extends keyof QuizAnswers> extends BaseQuestion<K> {
  kind: "multi";
  max: number;
  options: QuizOption<QuizAnswers[K] extends (infer U)[] ? Extract<U, string> : never>[];
}

export type QuizQuestion =
  | SingleQuestion<"goal">
  | MultiQuestion<"moments">
  | SingleQuestion<"frequency">
  | SingleQuestion<"difficulty">
  | SingleQuestion<"dailyTime">
  | MultiQuestion<"alternatives">
  | SingleQuestion<"budget">;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "goal",
    kind: "single",
    title: "O que você mais quer mudar nestes 21 dias?",
    description: "Escolha o objetivo principal. As missões continuam as mesmas, mas as dicas se ajustam a ele.",
    options: [
      { value: "doces", label: "Comer menos doces", hint: "Chocolates, bolos, biscoitos, sobremesas" },
      { value: "bebidas", label: "Reduzir bebidas adoçadas", hint: "Refrigerantes, sucos de caixinha, café com muito açúcar" },
      { value: "beliscos", label: "Perceber melhor meus beliscos", hint: "Aquele docinho automático ao longo do dia" },
      { value: "alimentacao_geral", label: "Melhorar minha alimentação no geral", hint: "Com o açúcar como ponto de partida" },
    ],
  },
  {
    id: "moments",
    kind: "multi",
    max: 3,
    title: "Quando a vontade de doce costuma aparecer?",
    description: "Marque até 3 situações. Não existe resposta certa — é só para entender sua rotina.",
    options: [
      { value: "manha", label: "De manhã, no café" },
      { value: "apos_almoco", label: "Logo depois do almoço" },
      { value: "tarde", label: "No meio da tarde" },
      { value: "apos_jantar", label: "Depois do jantar" },
      { value: "noite", label: "À noite, vendo TV ou no celular" },
      { value: "estresse", label: "Em momentos de estresse ou cansaço" },
      { value: "tedio", label: "Quando estou entediado(a)" },
      { value: "social", label: "Em encontros, festas e no trabalho" },
      { value: "fim_de_semana", label: "Principalmente no fim de semana" },
    ],
  },
  {
    id: "frequency",
    kind: "single",
    title: "Com que frequência você come doces ou toma bebidas adoçadas hoje?",
    description: "Uma estimativa honesta já ajuda. Ninguém vai te julgar por isso.",
    options: [
      { value: "raramente", label: "Raramente", hint: "Menos de uma vez por semana" },
      { value: "algumas_vezes_semana", label: "Algumas vezes por semana" },
      { value: "uma_vez_dia", label: "Cerca de uma vez por dia" },
      { value: "varias_vezes_dia", label: "Várias vezes por dia" },
    ],
  },
  {
    id: "difficulty",
    kind: "single",
    title: "Qual é a sua maior dificuldade na prática?",
    description: "Escolha a que mais pesa no seu dia a dia.",
    options: [
      { value: "vontade_repentina", label: "A vontade aparece de repente e é difícil esperar" },
      { value: "doces_a_vista", label: "Tem doce sempre por perto, em casa ou no trabalho" },
      { value: "habito_apos_refeicao", label: "É automático: terminei de comer, quero um doce" },
      { value: "emocional", label: "Uso o doce para aliviar estresse, ansiedade ou cansaço" },
      { value: "rotina_corrida", label: "Rotina corrida, acabo pegando o que é mais prático" },
      { value: "convivio", label: "Família, amigos ou colegas oferecem o tempo todo" },
    ],
  },
  {
    id: "dailyTime",
    kind: "single",
    title: "Quanto tempo por dia você consegue dedicar ao desafio?",
    description: "Toda missão tem uma versão curta. Você pode mudar isso depois no perfil.",
    options: [
      { value: "5", label: "Até 5 minutos", hint: "Vamos priorizar a versão rápida das missões" },
      { value: "10", label: "Cerca de 10 minutos" },
      { value: "20", label: "20 minutos ou mais", hint: "Dá para fazer a missão completa com calma" },
    ],
  },
  {
    id: "alternatives",
    kind: "multi",
    max: 5,
    title: "Que tipo de alternativa faz mais sentido para você?",
    description: "Marque quantas quiser. Isso define o que aparece primeiro no seu Guia.",
    options: [
      { value: "frutas", label: "Frutas e combinações simples" },
      { value: "bebidas", label: "Bebidas com menos ou sem açúcar" },
      { value: "lanches_salgados", label: "Lanches salgados práticos" },
      { value: "receitas_rapidas", label: "Receitas rápidas, de até 10 minutos" },
      { value: "estrategias", label: "Estratégias sem comida", hint: "Pausas, distrações, mudanças no ambiente" },
    ],
  },
  {
    id: "budget",
    kind: "single",
    title: "Como está o orçamento para comida no momento?",
    description: "Opcional na prática: serve só para não sugerir o que não cabe no seu bolso.",
    options: [
      { value: "economico", label: "Preciso economizar", hint: "Priorizar opções baratas e fáceis de achar" },
      { value: "moderado", label: "Moderado" },
      { value: "flexivel", label: "Tenho flexibilidade" },
      { value: "nao_informar", label: "Prefiro não informar" },
    ],
  },
];

export function optionLabel<K extends keyof QuizAnswers>(id: K, value: string): string {
  const q = QUIZ_QUESTIONS.find((x) => x.id === id);
  const opt = (q?.options as QuizOption[] | undefined)?.find((o) => o.value === value);
  return opt?.label ?? value;
}
