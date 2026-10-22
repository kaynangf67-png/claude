import type { AlternativePreference, BudgetPreference, CravingMoment, QuizAnswers } from "./types";

export type GuideCost = "baixo" | "medio";

export interface GuideItem {
  id: string;
  category: AlternativePreference;
  title: string;
  description: string;
  howTo: string;
  cost: GuideCost;
  minutes: number;
  goodFor: CravingMoment[];
}

export const GUIDE_CATEGORY_LABELS: Record<AlternativePreference, string> = {
  frutas: "Frutas",
  bebidas: "Bebidas",
  lanches_salgados: "Lanches salgados",
  receitas_rapidas: "Receitas rápidas",
  estrategias: "Estratégias",
};

export const COST_LABELS: Record<GuideCost, string> = {
  baixo: "Custo baixo",
  medio: "Custo médio",
};

// Conteúdo educativo e prático. Sem alegações de saúde: as alternativas são opções
// para testar, não substitutos "milagrosos".
export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: "banana-canela",
    category: "frutas",
    title: "Banana com canela",
    description: "Doce natural da fruta com o aroma da canela, que lembra sobremesa.",
    howTo: "Corte uma banana em rodelas e polvilhe canela. Se quiser, aqueça por 30 segundos no micro-ondas.",
    cost: "baixo",
    minutes: 2,
    goodFor: ["apos_almoco", "apos_jantar", "noite"],
  },
  {
    id: "fruta-congelada",
    category: "frutas",
    title: "Fruta congelada",
    description: "Uva, manga ou banana congeladas viram um petisco gelado que se come devagar.",
    howTo: "Lave, seque e congele a fruta em pedaços num pote. Fica pronta para os dias de calor.",
    cost: "baixo",
    minutes: 5,
    goodFor: ["tarde", "noite", "tedio"],
  },
  {
    id: "fruta-pasta-amendoim",
    category: "frutas",
    title: "Maçã com pasta de amendoim",
    description: "Combinação crocante e cremosa que sustenta mais que a fruta sozinha.",
    howTo: "Fatie uma maçã e use uma colher de chá de pasta de amendoim integral. Confira no rótulo se não tem açúcar adicionado.",
    cost: "medio",
    minutes: 3,
    goodFor: ["tarde", "estresse"],
  },
  {
    id: "agua-saborizada",
    category: "bebidas",
    title: "Água saborizada em casa",
    description: "Água, com ou sem gás, com fruta e ervas. Ajuda a ter algo gostoso à mão.",
    howTo: "Numa garrafa, coloque rodelas de limão, laranja ou pepino e folhas de hortelã. Deixe na geladeira por algumas horas.",
    cost: "baixo",
    minutes: 5,
    goodFor: ["manha", "apos_almoco", "tarde"],
  },
  {
    id: "cafe-menos-acucar",
    category: "bebidas",
    title: "Café com menos açúcar, aos poucos",
    description: "Reduzir de forma gradual costuma ser mais fácil do que cortar de uma vez.",
    howTo: "Tire um pouco do açúcar a cada semana. Canela ou cacau em pó no café também ajudam a dar sabor.",
    cost: "baixo",
    minutes: 1,
    goodFor: ["manha", "tarde"],
  },
  {
    id: "cha-gelado",
    category: "bebidas",
    title: "Chá gelado sem açúcar",
    description: "Uma alternativa ao refrigerante com sabor e temperatura parecidos.",
    howTo: "Prepare chá de hibisco, mate ou frutas vermelhas, deixe esfriar e sirva com gelo e limão.",
    cost: "baixo",
    minutes: 10,
    goodFor: ["apos_almoco", "social", "fim_de_semana"],
  },
  {
    id: "pipoca-panela",
    category: "lanches_salgados",
    title: "Pipoca de panela",
    description: "Lanche barato, que rende bastante e combina com filme ou série.",
    howTo: "Use pouco óleo e sal na medida. Ervas secas ou páprica variam o sabor.",
    cost: "baixo",
    minutes: 8,
    goodFor: ["noite", "tedio", "fim_de_semana"],
  },
  {
    id: "ovo-cozido",
    category: "lanches_salgados",
    title: "Ovo cozido pronto na geladeira",
    description: "Um lanche que sustenta e fica pronto para os dias corridos.",
    howTo: "Cozinhe alguns ovos no domingo (10 minutos em água fervente) e guarde na geladeira por até 5 dias.",
    cost: "baixo",
    minutes: 12,
    goodFor: ["tarde", "estresse"],
  },
  {
    id: "castanhas-porcao",
    category: "lanches_salgados",
    title: "Castanhas em porções",
    description: "Crocância que ajuda no lanche da tarde. Porcionar evita comer direto do pacote.",
    howTo: "Separe pequenas porções (um punhado) em potinhos ou saquinhos para levar na bolsa.",
    cost: "medio",
    minutes: 5,
    goodFor: ["tarde", "estresse"],
  },
  {
    id: "iogurte-fruta",
    category: "receitas_rapidas",
    title: "Iogurte natural com fruta picada",
    description: "Sobremesa cremosa com o doce vindo da fruta.",
    howTo: "Misture iogurte natural com fruta picada e um pouco de aveia ou canela por cima.",
    cost: "medio",
    minutes: 3,
    goodFor: ["apos_almoco", "apos_jantar"],
  },
  {
    id: "banana-assada",
    category: "receitas_rapidas",
    title: "Banana assada na frigideira",
    description: "Fica caramelizada por fora e macia por dentro, sem adicionar açúcar.",
    howTo: "Corte a banana ao meio no sentido do comprimento e doure dos dois lados em frigideira antiaderente. Finalize com canela.",
    cost: "baixo",
    minutes: 8,
    goodFor: ["apos_jantar", "fim_de_semana"],
  },
  {
    id: "chocolate-amargo-porcao",
    category: "receitas_rapidas",
    title: "Um quadradinho, com calma",
    description: "Se o desejo é chocolate, uma porção pequena servida num pratinho pode ser suficiente.",
    howTo: "Sirva um ou dois quadradinhos de chocolate de que você goste, guarde o resto e coma devagar.",
    cost: "medio",
    minutes: 1,
    goodFor: ["apos_almoco", "apos_jantar", "social"],
  },
  {
    id: "regra-10-minutos",
    category: "estrategias",
    title: "Regra dos 10 minutos",
    description: "Esperar um pouco antes de decidir. Muitas vontades perdem força nesse intervalo.",
    howTo: "Quando a vontade vier, marque 10 minutos e faça outra coisa. Depois, decida com calma — inclusive comer, se quiser.",
    cost: "baixo",
    minutes: 10,
    goodFor: ["tarde", "noite", "estresse", "tedio"],
  },
  {
    id: "fora-da-vista",
    category: "estrategias",
    title: "Fora da vista",
    description: "Guardar os doces em lugares menos acessíveis e deixar à vista o que você quer escolher mais.",
    howTo: "Use potes fechados, prateleiras altas e o fundo do armário. Na bancada, deixe frutas ou uma garrafa de água.",
    cost: "baixo",
    minutes: 15,
    goodFor: ["noite", "tedio", "fim_de_semana"],
  },
  {
    id: "escovar-dentes",
    category: "estrategias",
    title: "Escovar os dentes depois da refeição",
    description: "Um sinal claro de que a refeição terminou. Ajuda quem sente vontade logo depois de comer.",
    howTo: "Deixe uma escova no trabalho ou na bolsa e escove logo após o almoço ou o jantar.",
    cost: "baixo",
    minutes: 3,
    goodFor: ["apos_almoco", "apos_jantar"],
  },
  {
    id: "pausa-sem-comida",
    category: "estrategias",
    title: "Pausa sem comida",
    description: "Pequenas pausas que também descansam: alongar, sair para tomar ar, ouvir uma música.",
    howTo: "Tenha três opções de até 5 minutos anotadas no celular e escolha uma quando o cansaço bater.",
    cost: "baixo",
    minutes: 5,
    goodFor: ["estresse", "tarde", "tedio"],
  },
  {
    id: "comer-com-atencao",
    category: "estrategias",
    title: "Comer com atenção",
    description: "Servir num prato, sentar e comer sem tela. Fica mais fácil perceber quando já está bom.",
    howTo: "Mesmo um doce pequeno: sirva, sente-se, deixe o celular longe e coma devagar.",
    cost: "baixo",
    minutes: 10,
    goodFor: ["noite", "apos_jantar", "social"],
  },
  {
    id: "frase-pronta",
    category: "estrategias",
    title: "Frase pronta para recusar",
    description: "Uma resposta gentil para quando oferecerem doce e você não quiser.",
    howTo: "Algo como “Agora não, obrigado(a), mas tá com uma cara ótima”. Aceitar também é uma escolha válida.",
    cost: "baixo",
    minutes: 1,
    goodFor: ["social", "fim_de_semana"],
  },
  {
    id: "ler-rotulo",
    category: "estrategias",
    title: "Ler a lista de ingredientes",
    description: "O açúcar aparece com vários nomes. Os ingredientes vêm em ordem do que tem mais para o que tem menos.",
    howTo: "Procure: açúcar, xarope de glicose, açúcar invertido, maltodextrina, mel. Veja também a lupa frontal de “alto em açúcar adicionado”.",
    cost: "baixo",
    minutes: 2,
    goodFor: ["manha", "fim_de_semana"],
  },
];

export function getGuideItem(id: string): GuideItem | undefined {
  return GUIDE_ITEMS.find((g) => g.id === id);
}

/**
 * Ordena o guia pelo que mais combina com as respostas do quiz:
 * categorias preferidas, momentos de vontade e, se a pessoa pediu economia, custo baixo.
 * Nada é escondido — só reordenado.
 */
export function rankGuide(items: GuideItem[], quiz: Pick<QuizAnswers, "alternatives" | "moments" | "budget"> | null): GuideItem[] {
  if (!quiz) return items;
  const score = (g: GuideItem) => {
    let s = 0;
    if (quiz.alternatives.includes(g.category)) s += 3;
    s += g.goodFor.filter((m) => quiz.moments.includes(m)).length;
    if (budgetPrefersLowCost(quiz.budget) && g.cost === "baixo") s += 1;
    return s;
  };
  return [...items].sort((a, b) => score(b) - score(a));
}

function budgetPrefersLowCost(b: BudgetPreference) {
  return b === "economico";
}
