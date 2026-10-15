/**
 * ============================================================
 *  CONFIGURAÇÃO CENTRAL — AUTO ESCOLA SÃO FRANCISCO
 * ============================================================
 *
 *  Todos os dados do negócio ficam aqui. Para atualizar o site,
 *  edite apenas este arquivo (e troque as fotos em src/lib/photos.ts).
 *
 *  Regra: campo vazio ('' ou []) = informação ainda não confirmada.
 *  O site mostra um marcador "[a confirmar]" no lugar, e os botões
 *  de WhatsApp levam para a seção de contato até o número existir.
 *
 *  Nada aqui foi inventado. O que foi encontrado em diretórios
 *  públicos está anotado nos comentários e precisa ser CONFIRMADO
 *  com a autoescola antes de ser preenchido.
 */

/**
 * WhatsApp no formato internacional, só dígitos:
 * 55 + DDD + número. Ex.: 5527999999999
 *
 * Ainda não confirmado. O telefone fixo (27) 3328-1558 aparece em
 * diretórios (Solutudo, serra-es.com), mas fixo normalmente não é WhatsApp.
 */
export const WHATSAPP_NUMBER = '';

export const site = {
  name: 'Auto Escola São Francisco',
  /** Nome curto usado na marca tipográfica. */
  shortName: 'São Francisco',
  kind: 'Centro de Formação de Condutores',

  /** Frase institucional curta (rodapé e compartilhamentos). */
  tagline:
    'Centro de Formação de Condutores em Serra, ES. Orientação próxima do primeiro contato até a sua CNH.',

  /** URL final do site, sem barra no fim. Ex.: https://www.autoescolasaofrancisco.com.br */
  siteUrl: '',

  /**
   * Telefone para ligação, formatado para exibição.
   * Diretórios públicos listam (27) 3328-1558 (Solutudo e serra-es.com)
   * e outro diretório lista (27) 3328-2000. Confirmar antes de preencher.
   */
  phoneDisplay: '',

  /** Instagram: só o @, sem URL. Ex.: '@autoescolasaofrancisco' */
  instagram: '',

  /**
   * Endereço confirmado por mais de um diretório público
   * (Serra Guia Local, Solutudo). Conferir com a autoescola.
   */
  address: {
    street: 'Av. Eldes Scherrer Souza, 1345',
    neighborhood: 'Parque Residencial Laranjeiras',
    city: 'Serra',
    state: 'ES',
    postalCode: '29165-680',
    /**
     * Link "Compartilhar" da ficha no Google Maps, se houver.
     * Vazio = o site gera um link de busca pelo endereço acima.
     */
    mapsUrl: '',
  },

  /**
   * Horário de atendimento. Ex.: ['Segunda a sexta · 8h às 18h']
   * Diretórios divergem (8h–18h e 9h–18h, fechado no fim de semana). Confirmar.
   */
  openingHours: [] as string[],

  /** Link da política de privacidade, quando existir. */
  privacyPolicyUrl: '',

  /** Ano de fundação, se a autoescola quiser exibir. Ex.: 1998 */
  foundedYear: null as number | null,
};

/** Mensagens pré-preenchidas de cada botão de WhatsApp. */
export const messages = {
  general:
    'Olá! Conheci a Auto Escola São Francisco pelo site e gostaria de saber mais sobre como tirar minha CNH.',
  categoryA: 'Olá! Tenho interesse na Categoria A para motocicleta. Poderiam me passar mais informações?',
  categoryB: 'Olá! Tenho interesse na Categoria B para carro. Poderiam me passar mais informações?',
  categoryAB: 'Olá! Tenho interesse nas Categorias A + B e gostaria de conhecer as condições.',
  courses: 'Olá! Gostaria de saber quais cursos profissionalizantes estão disponíveis.',
  course: (name: string) =>
    `Olá! Tenho interesse no curso "${name}". Poderiam me passar informações sobre turmas e matrícula?`,
  documents: 'Olá! Quero começar minha CNH. Quais documentos preciso separar?',
  visit: 'Olá! Gostaria de passar na autoescola. Qual o melhor horário para ser atendido?',
};

export interface Category {
  id: 'a' | 'b' | 'ab';
  code: string;
  vehicle: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  message: string;
}

export const categories: Category[] = [
  {
    id: 'a',
    code: 'A',
    vehicle: 'Motocicleta',
    title: 'Duas rodas, com segurança desde o começo.',
    description:
      'Para quem quer pilotar moto com equilíbrio, atenção ao trânsito e responsabilidade, seja para o dia a dia ou para o trabalho.',
    points: ['Controle e equilíbrio', 'Leitura do trânsito', 'Pilotagem defensiva'],
    cta: 'Tenho interesse em moto',
    message: messages.categoryA,
  },
  {
    id: 'b',
    code: 'B',
    vehicle: 'Carro',
    title: 'Confiança no volante, no seu ritmo.',
    description:
      'Para quem quer dirigir carro com tranquilidade: das primeiras manobras à circulação no trânsito da cidade.',
    points: ['Manobras e baliza', 'Direção na cidade', 'Direção defensiva'],
    cta: 'Tenho interesse em carro',
    message: messages.categoryB,
  },
  {
    id: 'ab',
    code: 'A+B',
    vehicle: 'Moto e carro',
    title: 'As duas habilitações no mesmo processo.',
    description:
      'Para quem quer sair habilitado para moto e carro. Pergunte à equipe como funciona o processo combinado e quais são as condições.',
    points: ['Um só atendimento', 'Etapas organizadas', 'Condições sob consulta'],
    cta: 'Quero A + B',
    message: messages.categoryAB,
  },
];

export interface Course {
  /** Vazio = curso ainda não confirmado (exibido como "[a confirmar]"). */
  name: string;
  description: string;
}

/**
 * Cursos profissionalizantes / especializados.
 * NÃO confirmados: o site de referência não pôde ser lido e nenhuma
 * fonte pública lista os cursos da autoescola. Substitua pelos cursos
 * que a autoescola REALMENTE oferece (ou deixe a lista vazia para
 * mostrar só o convite para perguntar pelo WhatsApp).
 */
export const courses: Course[] = [
  { name: '', description: '' },
  { name: '', description: '' },
  { name: '', description: '' },
  { name: '', description: '' },
];

export interface FaqItem {
  question: string;
  answer: string[];
}

/**
 * Perguntas frequentes. Nenhuma resposta cita taxa, prazo, documento
 * exigido ou condição de pagamento: isso depende das regras vigentes
 * do Detran-ES e dos procedimentos da autoescola.
 */
export const faq: FaqItem[] = [
  {
    question: 'Como faço para começar minha CNH?',
    answer: [
      'O primeiro passo é conversar com a equipe. Pelo WhatsApp ou pessoalmente, você conta qual categoria quer tirar e recebe a orientação sobre as etapas, os exames e o que precisa providenciar.',
    ],
  },
  {
    question: 'Quais categorias estão disponíveis?',
    answer: [
      'A autoescola atende as categorias A (moto), B (carro) e o processo combinado A + B. Se você procura outra categoria ou quer adicionar uma categoria à CNH que já tem, pergunte à equipe.',
    ],
  },
  {
    question: 'Ainda preciso de autoescola para tirar a CNH?',
    answer: [
      'As regras mudaram: a Resolução Contran nº 1.020/2025 deixou de exigir que todo candidato faça as aulas em autoescola. Os exames continuam obrigatórios, incluindo a prova prática aplicada pelo Detran.',
      'Muita gente ainda escolhe a autoescola para chegar à prova preparada, com instrutor, veículo adequado e acompanhamento em cada etapa. A equipe explica o que vale hoje no Espírito Santo e qual caminho faz mais sentido para você.',
    ],
  },
  {
    question: 'Quais documentos são necessários?',
    answer: [
      'A lista pode mudar conforme as regras do Detran-ES e a sua situação (primeira habilitação, adição de categoria etc.). Para não perder tempo, peça a lista atualizada à equipe antes de começar.',
    ],
  },
  {
    question: 'Como funcionam as aulas práticas?',
    answer: [
      'As aulas práticas são feitas com instrutor, para você treinar manobras e circulação no trânsito antes da prova. Veículos, horários, quantidade de aulas e agendamento são combinados diretamente com a equipe.',
    ],
  },
  {
    question: 'Quanto tempo demora o processo?',
    answer: [
      'Depende da agenda de exames do Detran-ES, da disponibilidade de horários para as aulas e do seu próprio ritmo. Não existe prazo garantido; a equipe consegue dar uma estimativa mais realista no momento da matrícula.',
    ],
  },
  {
    question: 'Quais são as formas de pagamento?',
    answer: [
      'Valores e formas de pagamento são informados diretamente pela equipe, de acordo com a categoria escolhida.',
    ],
  },
  {
    question: 'Como faço para realizar minha matrícula?',
    answer: [
      'Fale com a equipe pelo WhatsApp ou vá até a autoescola. Eles confirmam os documentos necessários e explicam os próximos passos.',
    ],
  },
  {
    question: 'Como posso falar com a equipe?',
    answer: [
      'Pelo WhatsApp, pelos botões deste site, ou pessoalmente no endereço informado na seção de contato.',
    ],
  },
];

export const seo = {
  title: 'Auto Escola São Francisco · CNH categorias A e B em Serra, ES',
  description:
    'Centro de Formação de Condutores em Serra, ES. Categorias A, B e A + B com atendimento próximo e orientação em cada etapa da sua CNH. Fale pelo WhatsApp.',
};
