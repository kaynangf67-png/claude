/**
 * ============================================================
 *  CONFIGURAÇÃO CENTRAL DO SITE — UNNICA ODONTO
 * ============================================================
 *
 *  Todos os dados da clínica ficam aqui. Para atualizar o site,
 *  edite apenas este arquivo.
 *
 *  Regra: campo vazio ('') = informação ainda não confirmada.
 *  O site mostra um marcador "[a preencher]" no lugar e NÃO
 *  publica dados estruturados (Schema.org) incompletos.
 *
 *  Nada aqui foi inventado. O que foi observado nas fotos reais
 *  está indicado nos comentários e precisa ser CONFIRMADO com a
 *  clínica antes de ser preenchido.
 */

export type TreatmentIcon =
  | 'sparkles'
  | 'smile'
  | 'shield'
  | 'stethoscope'
  | 'heart'
  | 'scan';

export interface Treatment {
  /** slug usado como âncora: #tratamento-<id> */
  id: string;
  name: string;
  icon: TreatmentIcon;
  /** Uma frase curta exibida no card. */
  summary: string;
  /** Texto exibido no "Saiba mais". Parágrafos curtos. */
  details: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Número do WhatsApp no formato internacional, só dígitos:
 * 55 + DDD + número. Ex.: 5527999999999
 *
 * (27) 99278-3120 — confirmado como WhatsApp da clínica.
 * Na porta também aparece (27) 99279-6863.
 */
export const WHATSAPP_NUMBER = '5527992783120';

/**
 * Modo de revisão. false (apresentação/produção): campos ainda não
 * preenchidos ficam ocultos e o site parece completo, sem inventar dados.
 * true: mostra os marcadores "[a preencher]" para revisão interna.
 */
export const SHOW_PENDING = false;

export const clinic = {
  /**
   * Nome exibido no site. Nas fotos (parede da recepção e porta)
   * a marca aparece como "UNNICA ODONTO", com dois N.
   */
  name: 'Unnica Odonto',

  /** Frase curta usada no rodapé e em compartilhamentos. */
  tagline: 'Odontologia com cuidado, tecnologia e uma experiência pensada para você.',

  /** URL final do site, sem barra no fim. Ex.: https://www.unnicaodonto.com.br */
  siteUrl: '',

  /** Cidade/UF exibida no Hero. Ex.: 'Vila Velha · ES'. DDD 27 = Espírito Santo. */
  cityLabel: '',

  /** Telefone fixo ou celular para ligação, formatado para exibição. */
  phoneDisplay: '',

  /**
   * Instagram: só o @, sem URL. Na porta aparece "@unnicaodonto…"
   * (parcialmente coberto). Confirmar o @ exato.
   */
  instagram: '',

  address: {
    street: '', // Rua e número
    complement: '', // Sala, andar, edifício
    neighborhood: '',
    city: '',
    state: '', // Sigla: ES
    postalCode: '',
    /** Link "Compartilhar" do Google Maps da ficha da clínica. */
    mapsUrl: '',
  },

  /** Ex.: ['Segunda a sexta · 8h às 18h', 'Sábado · 8h às 12h'] */
  openingHours: [] as string[],

  /**
   * Responsável técnico(a). O Código de Ética Odontológica exige
   * nome e número de inscrição no CRO na divulgação de clínicas.
   * Na porta aparece "Responsável Técnica … Cirurgiã-Dentista CRO …",
   * mas o texto está parcialmente coberto: confirmar.
   */
  technicalLead: {
    name: '',
    cro: '', // Ex.: 'CRO-ES 0000'
  },

  /** Inscrição da clínica (pessoa jurídica) no CRO, se houver. Ex.: 'CRO-ES EPAO 0000' */
  clinicRegistration: '',

  /** Texto institucional oficial. Cada item vira um parágrafo. */
  history: [] as string[],
};

/**
 * Tratamentos. Substitua os placeholders pelos tratamentos que a
 * clínica CONFIRMAR. Pode adicionar ou remover itens livremente.
 * Ícones disponíveis: sparkles, smile, shield, stethoscope, heart, scan.
 */
export const treatments: Treatment[] = [
  {
    id: 'tratamento-01',
    name: '[Tratamento 01]',
    icon: 'stethoscope',
    summary: '[Descrição curta: o que é e para quem é indicado.]',
    details: [
      '[Explique o tratamento em linguagem simples, em 2 ou 3 frases.]',
      '[Como funciona a primeira consulta ou avaliação.]',
    ],
  },
  {
    id: 'tratamento-02',
    name: '[Tratamento 02]',
    icon: 'sparkles',
    summary: '[Descrição curta: o que é e para quem é indicado.]',
    details: ['[Explique o tratamento em linguagem simples, em 2 ou 3 frases.]'],
  },
  {
    id: 'tratamento-03',
    name: '[Tratamento 03]',
    icon: 'smile',
    summary: '[Descrição curta: o que é e para quem é indicado.]',
    details: ['[Explique o tratamento em linguagem simples, em 2 ou 3 frases.]'],
  },
  {
    id: 'tratamento-04',
    name: '[Tratamento 04]',
    icon: 'shield',
    summary: '[Descrição curta: o que é e para quem é indicado.]',
    details: ['[Explique o tratamento em linguagem simples, em 2 ou 3 frases.]'],
  },
  {
    id: 'tratamento-05',
    name: '[Tratamento 05]',
    icon: 'scan',
    summary: '[Descrição curta: o que é e para quem é indicado.]',
    details: ['[Explique o tratamento em linguagem simples, em 2 ou 3 frases.]'],
  },
  {
    id: 'tratamento-06',
    name: '[Tratamento 06]',
    icon: 'heart',
    summary: '[Descrição curta: o que é e para quem é indicado.]',
    details: ['[Explique o tratamento em linguagem simples, em 2 ou 3 frases.]'],
  },
];

const CONFIRM = 'Entre em contato pelo WhatsApp para confirmar essa informação com nossa equipe.';

export const faq: FaqItem[] = [
  {
    question: 'Como faço para agendar uma consulta?',
    answer:
      'Envie uma mensagem pelo WhatsApp contando o que você procura. Nossa equipe verifica a disponibilidade e orienta você sobre o melhor horário.',
  },
  {
    question: 'Como posso falar com a clínica?',
    answer: 'O caminho mais rápido é o WhatsApp, pelos botões deste site. ' + CONFIRM,
  },
  {
    question: 'Quais tratamentos a Unnica Odonto oferece?',
    answer:
      'Você encontra os tratamentos na seção “Tratamentos” desta página. Se não encontrou o que procura, ' +
      CONFIRM.charAt(0).toLowerCase() +
      CONFIRM.slice(1),
  },
  { question: 'A clínica atende crianças?', answer: CONFIRM },
  { question: 'Quais formas de pagamento estão disponíveis?', answer: CONFIRM },
  {
    question: 'Como chegar até a clínica?',
    answer: clinic.address.street
      ? 'O endereço e o link para o mapa estão no rodapé desta página. ' + CONFIRM
      : 'Peça a localização pelo WhatsApp: nossa equipe envia o endereço e o link do mapa.',
  },
  {
    question: 'Preciso fazer uma avaliação antes de iniciar um tratamento?',
    answer: CONFIRM,
  },
];

/** Mensagens pré-preenchidas do WhatsApp por contexto. */
export const whatsappMessages = {
  general: `Olá! Conheci a ${clinic.name} pelo site e gostaria de saber mais sobre o atendimento.`,
  treatment: (name: string) =>
    `Olá! Conheci a ${clinic.name} pelo site e gostaria de saber mais sobre ${name}.`,
  schedule: `Olá! Conheci a ${clinic.name} pelo site e gostaria de agendar um atendimento.`,
  question: (q: string) =>
    `Olá! Conheci a ${clinic.name} pelo site e tenho uma dúvida: ${q}`,
  location: `Olá! Conheci a ${clinic.name} pelo site e gostaria de saber como chegar à clínica.`,
};

/** SEO */
export const seo = {
  title: `${clinic.name} | Clínica Odontológica`,
  description: `Conheça a ${clinic.name}, nossa estrutura, tratamentos e formas de atendimento. Entre em contato pelo WhatsApp.`,
};
