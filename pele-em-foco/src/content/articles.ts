import { SOURCES, type Source } from './sources';

export type ArticleCategory = 'Acne' | 'Rotina' | 'Produtos' | 'Estilo de vida' | 'Saúde';

export interface ArticleSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  note?: string;
}

export interface Article {
  slug: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  minutes: number;
  sections: ArticleSection[];
  sources: Source[];
}

export const ARTICLES: Article[] = [
  {
    slug: 'como-a-acne-se-forma',
    title: 'Como a acne se forma',
    summary: 'Sebo, células mortas, bactérias e inflamação: os quatro processos que atuam juntos.',
    category: 'Acne',
    minutes: 4,
    sections: [
      {
        paragraphs: [
          'A acne começa dentro do folículo pilossebáceo — o “poro”. Cada folículo tem um pelo e uma glândula que produz sebo, a oleosidade natural da pele.',
          'De forma simplificada, quatro processos costumam atuar juntos: mais produção de sebo (influência hormonal, especialmente a partir da puberdade), acúmulo de células mortas que formam um “tampão”, multiplicação da bactéria Cutibacterium acnes, que vive normalmente na pele, e inflamação.',
        ],
      },
      {
        heading: 'Os tipos de lesão',
        bullets: [
          'Cravo aberto: ponto escuro. A cor vem da oxidação, não de sujeira.',
          'Cravo fechado: pequena elevação clara.',
          'Pápula: bolinha vermelha sem pus visível.',
          'Pústula: lesão com ponto amarelado ou branco.',
          'Nódulo e cisto: lesões profundas e doloridas, com maior risco de cicatriz — merecem avaliação de dermatologista.',
        ],
      },
      {
        heading: 'Fatores que podem contribuir',
        bullets: [
          'Hormônios e genética (histórico familiar).',
          'Produtos que obstruem poros (cremes pesados, alguns produtos capilares, maquiagem pesada).',
          'Atrito e pressão: capacete, boné, alça de mochila, máscara.',
          'Espremer e cutucar, que aumentam inflamação e risco de cicatriz.',
          'Alguns medicamentos e condições de saúde — só um médico pode avaliar.',
        ],
        note: 'Acne não é falta de higiene. É uma condição da pele com várias causas, e o peso de cada uma muda de pessoa para pessoa.',
      },
    ],
    sources: [SOURCES.sbdAcne, SOURCES.msAcne, SOURCES.aadTypes, SOURCES.aadScars],
  },
  {
    slug: 'pele-oleosa',
    title: 'Pele oleosa: cuidar sem agredir',
    summary: 'Oleosidade não é acne, e tentar “secar” a pele à força costuma piorar.',
    category: 'Rotina',
    minutes: 3,
    sections: [
      {
        paragraphs: [
          'Pele oleosa tem mais tendência a poros obstruídos, mas nem toda pele oleosa tem acne. A oleosidade também tem função: ajuda a proteger a pele.',
        ],
      },
      {
        heading: 'O que ajuda',
        bullets: [
          'Lavar o rosto até duas vezes por dia e depois de suar, com limpador suave e a ponta dos dedos.',
          'Escolher produtos “oil free” e “não comedogênicos”.',
          'Usar hidratante leve depois da limpeza — sim, pele oleosa também precisa.',
        ],
      },
      {
        heading: 'O que costuma atrapalhar',
        bullets: [
          'Esfregar a pele ou usar esfoliantes ásperos.',
          'Lavar o rosto muitas vezes por dia.',
          'Produtos com muito álcool, que ressecam e irritam.',
          'Somar vários ácidos ao mesmo tempo: a AAD alerta que ácidos como salicílico, glicólico e lático podem ajudar, mas também podem ser agressivos demais.',
        ],
      },
    ],
    sources: [SOURCES.aadOily, SOURCES.aadWash, SOURCES.aadTips],
  },
  {
    slug: 'rotina-basica',
    title: 'Rotina básica: manhã e noite',
    summary: 'Limpar, hidratar e proteger de manhã. Remover, limpar, tratar (se houver) e hidratar à noite.',
    category: 'Rotina',
    minutes: 4,
    sections: [
      {
        heading: 'Manhã',
        bullets: [
          'Limpeza suave com água morna, sem esfregar.',
          'Hidratante leve, oil free.',
          'Protetor solar de amplo espectro, FPS 30 ou mais, em rosto, orelhas e pescoço.',
        ],
      },
      {
        heading: 'Noite',
        bullets: [
          'Remover maquiagem e protetor, se usou.',
          'Limpeza suave.',
          'Tratamento indicado por profissional, se houver — na quantidade e frequência orientadas.',
          'Hidratante leve.',
        ],
      },
      {
        heading: 'Regras de ouro',
        bullets: [
          'Um produto novo de cada vez, com teste em pequena área antes.',
          'Dar tempo: a AAD indica de 6 a 8 semanas de uso antes de avaliar um tratamento.',
          'Ardência forte, vermelhidão intensa ou descamação excessiva são sinais para parar e buscar orientação.',
        ],
      },
    ],
    sources: [SOURCES.aadTips, SOURCES.aadHabits, SOURCES.aadSunscreen, SOURCES.aadWash],
  },
  {
    slug: 'lendo-rotulos',
    title: 'Como ler o rótulo de um produto',
    summary: 'A frente da embalagem vende; a lista de ingredientes informa.',
    category: 'Produtos',
    minutes: 4,
    sections: [
      {
        bullets: [
          'Termos como “purificante”, “detox” e “pele perfeita” não dizem o que o produto faz nem quanto contém de cada ingrediente.',
          'No Brasil, a Anvisa exige a nomenclatura internacional INCI na rotulagem de cosméticos, e normas recentes passaram a exigir também os nomes traduzidos para o português.',
          'Em geral, os ingredientes em maior quantidade aparecem primeiro — isso dá uma noção, mas não permite deduzir porcentagens.',
        ],
      },
      {
        heading: 'Termos comuns',
        bullets: [
          'Não comedogênico: menor tendência a obstruir poros. Boa pista, não garantia.',
          'Oil free: sem óleos na fórmula.',
          'Dermatologicamente testado: passou por algum teste; não diz qual nem o resultado.',
          'Hipoalergênico: formulado para reduzir o risco de alergia, não para eliminá-lo.',
          'FPS: proteção contra UVB. Para UVA, procure “amplo espectro” ou “proteção UVA”.',
        ],
      },
    ],
    sources: [SOURCES.anvisaInci, SOURCES.aadOily, SOURCES.aadSunscreen],
  },
  {
    slug: 'ingredientes',
    title: 'Ingredientes comuns e seus cuidados',
    summary: 'Ácido salicílico, peróxido de benzoíla, retinoides, niacinamida: o que cada um faz e onde mora o risco.',
    category: 'Produtos',
    minutes: 5,
    sections: [
      {
        note: 'Visão geral, não indicação de uso. Concentração, fórmula e a sua pele mudam tudo.',
      },
      {
        heading: 'Ácido salicílico',
        paragraphs: ['Age dentro do poro ajudando a soltar células mortas. Aparece na diretriz de 2024 da AAD com recomendação condicional. Pode ressecar e irritar, principalmente somado a outros esfoliantes.'],
      },
      {
        heading: 'Peróxido de benzoíla',
        paragraphs: ['Reduz bactérias associadas à acne; tem recomendação forte na diretriz da AAD. Pode ressecar, irritar e descolorir toalhas, fronhas e roupas.'],
      },
      {
        heading: 'Retinoides tópicos',
        paragraphs: ['Atuam na renovação celular e têm recomendação forte na diretriz da AAD. No Brasil, retinoides como o adapaleno são medicamentos vendidos sob prescrição. Costumam irritar no início e aumentam a sensibilidade ao sol; exigem orientação médica, especialmente para quem está grávida ou planeja engravidar.'],
      },
      {
        heading: 'Ácido azelaico',
        paragraphs: ['Atua em obstrução, bactérias e inflamação. Recomendação condicional na diretriz da AAD. Pode arder levemente no início.'],
      },
      {
        heading: 'Niacinamida',
        paragraphs: ['Muito presente em produtos para pele oleosa e geralmente bem tolerada, mas com evidência específica para acne mais limitada que a dos ativos acima.'],
      },
      {
        heading: 'Glicerina, ácido hialurônico e ceramidas',
        paragraphs: ['Hidratam e apoiam a barreira da pele, ajudando a tolerar ativos que ressecam.'],
      },
      {
        heading: 'Nunca no rosto',
        bullets: ['Limão, pasta de dente, bicarbonato, álcool puro, óleos essenciais sem diluição e esfoliantes caseiros abrasivos. Podem irritar, manchar e queimar, sem evidência de benefício.'],
      },
    ],
    sources: [SOURCES.guideline2024, SOURCES.aadTypes, SOURCES.aadOily, SOURCES.sbdTreat],
  },
  {
    slug: 'alimentacao',
    title: 'Alimentação e acne: o que se sabe',
    summary: 'Há associação com dieta de alta carga glicêmica e leite, mas a evidência é limitada. Nenhum alimento cura acne.',
    category: 'Estilo de vida',
    minutes: 4,
    sections: [
      {
        heading: 'O que a pesquisa sugere',
        bullets: [
          'Uma revisão sistemática de 2022 associou dietas de alta carga glicêmica a mais acne, com efeito descrito como modesto.',
          'Um ensaio clínico de 2007 com 43 rapazes encontrou mais redução de lesões com dieta de baixa carga glicêmica — mas esse grupo também perdeu mais peso, o que confunde o resultado.',
          'Uma meta-análise de 2018 com estudos observacionais associou laticínios, especialmente leite, a acne. Associação não é causa, e os autores apontam risco de viés.',
        ],
      },
      {
        heading: 'O que ainda é incerto',
        bullets: [
          'Se mudar a alimentação, sozinha, melhora a acne de forma relevante para a maioria.',
          'O papel de chocolate, gorduras e suplementos como whey.',
          'A diretriz de 2024 da AAD considerou as evidências sobre dieta insuficientes para recomendações formais.',
        ],
      },
      {
        heading: 'Na prática',
        bullets: [
          'Prefira um padrão alimentar variado a restrições. O Guia Alimentar do Ministério da Saúde é uma boa referência.',
          'Não corte grupos de alimentos por conta própria por causa da acne.',
          'Desconfie de chás, detox e suplementos vendidos como cura.',
          'Se a comida estiver gerando ansiedade ou culpa, converse com um profissional de saúde.',
        ],
      },
    ],
    sources: [SOURCES.aadDiet, SOURCES.dietReview, SOURCES.dairyMeta, SOURCES.lowGlycemic, SOURCES.guideline2024, SOURCES.msGuia],
  },
  {
    slug: 'mitos-e-erros',
    title: 'Mitos e erros comuns',
    summary: 'Espremer, esfregar, trocar de produto toda semana e outras armadilhas.',
    category: 'Estilo de vida',
    minutes: 3,
    sections: [
      {
        heading: 'Erros que atrapalham',
        bullets: [
          'Espremer ou cutucar: aumenta inflamação e risco de cicatriz.',
          'Esfregar a pele ou usar esfoliantes ásperos.',
          'Trocar de produto toda semana, sem dar tempo para avaliar.',
          'Usar vários ativos ao mesmo tempo.',
          'Pular o protetor solar ou se bronzear para “secar” espinhas.',
          'Aplicar o tratamento só na espinha, quando a orientação é cobrir a área com tendência.',
        ],
      },
      {
        heading: 'Mitos',
        bullets: [
          '“Acne é falta de higiene.” Não é: começa dentro do poro.',
          '“Pele oleosa não precisa de hidratante.” Precisa, em versão leve.',
          '“Quanto mais arde, mais funciona.” Ardência forte é irritação.',
          '“Natural não faz mal.” Óleos essenciais e extratos também irritam.',
          '“Acne é coisa de adolescente.” Muitos adultos têm acne.',
        ],
      },
    ],
    sources: [SOURCES.aadHabits, SOURCES.aadScars, SOURCES.aadTips],
  },
  {
    slug: 'quando-procurar-dermatologista',
    title: 'Quando procurar um dermatologista',
    summary: 'Acne profunda, dolorosa, persistente ou que deixa marcas merece avaliação profissional.',
    category: 'Saúde',
    minutes: 3,
    sections: [
      {
        heading: 'Procure avaliação se',
        bullets: [
          'Há espinhas profundas, grandes e doloridas (nódulos ou cistos).',
          'A acne está deixando cicatrizes ou manchas.',
          'Você manteve uma rotina por 6 a 8 semanas sem melhora.',
          'A acne piorou de repente ou depois de começar um medicamento.',
          'Há outros sinais, como menstruação muito irregular ou crescimento de pelos fora do comum.',
          'Um produto causou reação forte.',
          'A acne está afetando sua autoestima ou seu humor.',
        ],
      },
      {
        heading: 'Procure atendimento rápido se',
        bullets: ['Houver inchaço importante, febre com lesões, reação alérgica forte ou dificuldade para respirar (neste caso, emergência).'],
      },
      {
        heading: 'Onde',
        bullets: [
          'SUS: comece pela Unidade Básica de Saúde (UBS), que pode encaminhar ao dermatologista.',
          'Rede privada: confirme o registro e a especialidade (RQE) do médico no site do CFM ou do CRM do seu estado.',
        ],
      },
    ],
    sources: [SOURCES.aadTips, SOURCES.aadTreat, SOURCES.sbdTreat, SOURCES.aadScars],
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  { q: 'Quanto tempo leva para ver resultado?', a: 'Para tratamentos de acne, a AAD indica de 6 a 8 semanas de uso consistente antes de avaliar. Pele leva tempo — desconfie de prazos curtos.' },
  { q: 'Preciso de muitos produtos?', a: 'Não. Limpador suave, hidratante e protetor solar formam a base. Tratamentos devem entrar um de cada vez, de preferência com orientação.' },
  { q: 'Homem também precisa de rotina?', a: 'A pele não tem gênero: os princípios valem para qualquer pessoa. Para quem faz barba, lâmina limpa e produto suave ajudam a reduzir irritação.' },
  { q: 'Posso usar maquiagem tendo acne?', a: 'Pode. Prefira produtos não comedogênicos, não compartilhe pincéis e esponjas e remova tudo antes de dormir.' },
  { q: 'Tenho que cortar leite e chocolate?', a: 'Não há recomendação geral nesse sentido. Existe alguma associação entre leite, dieta de alta carga glicêmica e acne, mas a evidência é limitada.' },
  { q: 'Tomar sol seca espinha?', a: 'Não é recomendado. O efeito é passageiro, o sol pode escurecer manchas e alguns tratamentos aumentam a sensibilidade solar.' },
  { q: 'O app faz diagnóstico?', a: 'Não. O app é educativo e de organização: não diagnostica, não classifica a gravidade da acne e não indica tratamento.' },
  { q: 'Onde ficam meus dados?', a: 'Nesta versão, apenas no navegador deste aparelho. Não há conta nem sincronização. Você pode exportar ou apagar tudo em Perfil.' },
];

export function findArticle(slug: string | undefined): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
