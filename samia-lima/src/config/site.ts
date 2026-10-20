/**
 * ============================================================
 *  CONFIGURAÇÃO CENTRAL DO SITE — DRA. SÂMIA LIMA
 * ============================================================
 *
 *  Todo o conteúdo editável do site fica neste arquivo.
 *
 *  Regras:
 *  - Campo vazio ('' ou []) = informação ainda não confirmada.
 *    No site publicado ela simplesmente não aparece.
 *  - Itens com `published: false` só aparecem no MODO PRÉVIA
 *    (npm run dev, ou o site aberto com ?previa no endereço),
 *    marcados como "aguardando confirmação".
 *  - Nada aqui foi inventado. Os dados verificados estão marcados
 *    como tal; o restante precisa da aprovação da Dra. Sâmia.
 */

import type { PhotoKey } from '../lib/photos';

/* ------------------------------------------------------------ */
/*  Dados profissionais (verificados)                            */
/* ------------------------------------------------------------ */

/** WhatsApp no formato internacional, só dígitos. Verificado. */
export const WHATSAPP_NUMBER = '5527997557628';

export const professional = {
  fullName: 'Dra. Sâmia Maria de Souza Lima',
  brandName: 'Dra. Sâmia Lima',
  shortName: 'Dra. Sâmia',
  profession: 'Cirurgiã-dentista',
  cro: 'CRO-ES 6995',
  phoneDisplay: '(27) 99755-7628',
  email: 'samiamariaod@gmail.com',
  instagramUrl: 'https://www.instagram.com/drasamialima/',
  instagramHandle: '@drasamialima',

  address: {
    street: 'Avenida Minas Gerais, 102',
    neighborhood: 'Residencial Jacaraípe',
    city: 'Serra',
    state: 'ES',
    /** CEP: preencher quando confirmado. Melhora os dados estruturados. */
    postalCode: '',
    /** Link oficial da ficha no Google Maps. Verificado. */
    mapsUrl: 'https://maps.app.goo.gl/REywbFQKYECVEQbi6',
    /**
     * Mapa incorporado. Hoje é gerado a partir do endereço. Para o pino exato,
     * troque pelo `src` do código em Google Maps → Compartilhar → Incorporar um mapa.
     */
    mapEmbedUrl:
      'https://www.google.com/maps?q=' +
      encodeURIComponent('Avenida Minas Gerais, 102, Residencial Jacaraípe, Serra - ES') +
      '&output=embed',
  },

  /**
   * Horários de atendimento. NÃO CONFIRMADOS — vazio = não aparece no site.
   * Ex.: ['Segunda a sexta · 8h às 18h', 'Sábado · 8h às 12h']
   */
  openingHours: [] as string[],

  /** URL final do site, sem barra no fim. Ex.: https://www.drasamialima.com.br */
  siteUrl: '',

  /** Página de política de privacidade. Só aparece no rodapé quando existir. */
  privacyPolicyUrl: '',
};

export const locationLabel = `${professional.address.neighborhood} · ${professional.address.city}/${professional.address.state}`;
export const fullAddress = `${professional.address.street}, ${professional.address.neighborhood}, ${professional.address.city} - ${professional.address.state}`;

/* ------------------------------------------------------------ */
/*  Sobre a Dra. Sâmia                                           */
/* ------------------------------------------------------------ */

export const about = {
  /**
   * TEXTO PROPOSTO — aguarda aprovação da Dra. Sâmia antes da publicação.
   * Não afirma formação, tempo de experiência ou especialidade.
   */
  intro:
    'Cada paciente tem uma história, uma necessidade e uma expectativa. Por isso, entender suas dúvidas e explicar as possibilidades de tratamento faz parte de uma experiência de cuidado mais tranquila e consciente.',

  /** TEXTO PROPOSTO — aguarda aprovação. */
  bio: [
    'A Dra. Sâmia Lima é cirurgiã-dentista e atende em Residencial Jacaraípe, na Serra. No consultório, a consulta começa por ouvir: o que incomoda, o que você espera e quais dúvidas você traz.',
  ],

  /**
   * Formação, cursos e trajetória. NÃO PREENCHER sem confirmação.
   * Vazio = não aparece no site publicado.
   * Ex.: [{ title: 'Graduação em Odontologia', detail: 'Instituição · Ano' }]
   */
  credentials: [] as { title: string; detail?: string }[],
};

/* ------------------------------------------------------------ */
/*  Tratamentos                                                  */
/* ------------------------------------------------------------ */

export type ServiceIcon =
  | 'stethoscope'
  | 'shield'
  | 'layers'
  | 'sparkles'
  | 'heart'
  | 'activity'
  | 'crown'
  | 'scissors'
  | 'anchor'
  | 'align';

export interface Service {
  /** Identificador único (também usado no link de WhatsApp para medir conversões). */
  id: string;
  name: string;
  /** Nome usado na mensagem do WhatsApp ("...sobre o tratamento de ___"). */
  whatsappName: string;
  /** Mensagem própria, quando o modelo "tratamento de ___" não soar natural. */
  whatsappMessage?: string;
  /** Uma ou duas frases simples, sem promessa de resultado. */
  summary: string;
  icon: ServiceIcon;
  /**
   * true = confirmado pela Dra. Sâmia e visível no site publicado.
   * false = sugestão; só aparece no modo prévia.
   */
  published: boolean;
  /** Foto opcional (importe em src/lib/photos.ts). Sem foto, o card usa um painel ilustrado. */
  photo?: PhotoKey;
}

/**
 * Ordem do array = ordem no site. Para publicar um tratamento,
 * confirme com a Dra. Sâmia e mude `published` para true.
 */
export const services: Service[] = [
  {
    id: 'avaliacao',
    name: 'Consulta e avaliação odontológica',
    whatsappName: 'consulta e avaliação odontológica',
    summary:
      'O primeiro passo: uma conversa sobre o que você sente e espera, com o exame clínico necessário para orientar os próximos passos.',
    icon: 'stethoscope',
    whatsappMessage: `Olá! Encontrei o site da Dra. Sâmia Lima e gostaria de agendar uma consulta de avaliação odontológica.`,
    // A avaliação é o objetivo central do site e foi informada no briefing.
    published: true,
  },
  {
    id: 'limpeza-prevencao',
    name: 'Limpeza e prevenção',
    whatsappName: 'limpeza e prevenção',
    summary: 'Cuidados periódicos para manter dentes e gengivas saudáveis e acompanhar sua saúde bucal.',
    icon: 'shield',
    published: false,
  },
  {
    id: 'restauracoes',
    name: 'Restaurações',
    whatsappName: 'restaurações',
    summary: 'Recuperação de dentes afetados por cáries ou pequenas fraturas, após avaliação clínica.',
    icon: 'layers',
    published: false,
  },
  {
    id: 'clareamento',
    name: 'Clareamento dental',
    whatsappName: 'clareamento dental',
    summary: 'Indicado após avaliação, para quem deseja dentes mais claros com acompanhamento profissional.',
    icon: 'sparkles',
    published: false,
  },
  {
    id: 'gengiva',
    name: 'Tratamentos gengivais',
    whatsappName: 'tratamentos gengivais',
    summary: 'Cuidado com sangramento, inflamação e outras alterações da gengiva.',
    icon: 'heart',
    published: false,
  },
  {
    id: 'canal',
    name: 'Tratamento de canal',
    whatsappName: 'tratamento de canal',
    summary: 'Tratamento da parte interna do dente, quando indicado após avaliação e exames.',
    icon: 'activity',
    published: false,
  },
  {
    id: 'protese',
    name: 'Prótese dentária',
    whatsappName: 'prótese dentária',
    summary: 'Reposição de dentes perdidos para devolver função e conforto ao sorriso.',
    icon: 'crown',
    published: false,
  },
  {
    id: 'extracoes',
    name: 'Extrações',
    whatsappName: 'extrações',
    summary: 'Remoção de dentes quando necessária, com orientação antes e depois do procedimento.',
    icon: 'scissors',
    published: false,
  },
  {
    id: 'implantes',
    name: 'Implantes',
    whatsappName: 'implantes',
    summary: 'Alternativa para repor dentes perdidos, avaliada caso a caso.',
    icon: 'anchor',
    published: false,
  },
  {
    id: 'ortodontia',
    name: 'Ortodontia',
    whatsappName: 'ortodontia',
    summary: 'Correção da posição dos dentes e da mordida, com planejamento individual.',
    icon: 'align',
    published: false,
  },
];

/* ------------------------------------------------------------ */
/*  Avaliações de pacientes                                      */
/* ------------------------------------------------------------ */

export interface Review {
  /** Texto fiel ao original. Não editar o conteúdo. */
  text: string;
  /** Nome como aparece no Google (ou apenas iniciais, se a pessoa preferir). */
  author: string;
  /** Ex.: 'Google · março de 2026' */
  source: string;
}

/**
 * Somente avaliações REAIS, copiadas do Perfil da Empresa no Google
 * ou enviadas e autorizadas pela Dra. Sâmia. Vazio = o site mostra um
 * convite para ler as avaliações direto no Google.
 */
export const reviews: Review[] = [];

/**
 * Nota e total de avaliações do Google. Preencha só com dados atuais
 * e atualize periodicamente. null = não aparece.
 * Ex.: { rating: 5.0, count: 32, checkedAt: 'outubro de 2026' }
 */
export const googleRating: { rating: number; count: number; checkedAt: string } | null = null;

/* ------------------------------------------------------------ */
/*  WhatsApp                                                     */
/* ------------------------------------------------------------ */

export const whatsappMessages = {
  general: `Olá! Encontrei o site da ${professional.brandName} e gostaria de informações sobre uma avaliação odontológica.`,
  service: (name: string) =>
    `Olá! Encontrei o site da ${professional.brandName} e gostaria de saber mais sobre o tratamento de ${name}.`,
  insurance: 'Olá! Gostaria de confirmar se vocês atendem pelo meu plano odontológico.',
  private: 'Olá! Gostaria de informações sobre atendimento particular e condições de pagamento.',
  otherService: `Olá! Encontrei o site da ${professional.brandName} e gostaria de saber se vocês realizam um tratamento que procuro.`,
};

/* ------------------------------------------------------------ */
/*  Perguntas frequentes                                         */
/* ------------------------------------------------------------ */

export interface FaqItem {
  question: string;
  answer: string;
  /** Mensagem do botão de WhatsApp exibido na resposta. */
  whatsapp?: string;
}

export const faq: FaqItem[] = [
  {
    question: 'Como faço para agendar uma consulta?',
    answer:
      'Envie uma mensagem pelo WhatsApp contando o que você procura. Você recebe os horários disponíveis e escolhe o melhor para você.',
    whatsapp: whatsappMessages.general,
  },
  {
    question: 'Quais tratamentos estão disponíveis?',
    answer:
      'Os tratamentos confirmados estão na seção “Tratamentos”. Se você procura algo que não está na lista, pergunte pelo WhatsApp: a resposta vem direto do consultório.',
    whatsapp: whatsappMessages.otherService,
  },
  {
    question: 'O consultório aceita meu plano odontológico?',
    answer:
      'Os convênios aceitos podem mudar, por isso a confirmação é feita pelo WhatsApp. Informe o nome do seu plano na mensagem.',
    whatsapp: whatsappMessages.insurance,
  },
  {
    question: 'Como saber o valor de um tratamento?',
    answer:
      'O valor depende do que for indicado para o seu caso, e isso só é definido depois da avaliação clínica. Para saber sobre a consulta e o atendimento particular, fale pelo WhatsApp.',
    whatsapp: whatsappMessages.private,
  },
  {
    question: 'Onde fica o consultório?',
    answer: `Na ${professional.address.street}, ${professional.address.neighborhood}, ${professional.address.city}/${professional.address.state}. O link com a rota no Google Maps está na seção “Contato”.`,
  },
  {
    question: 'Como posso esclarecer dúvidas antes da consulta?',
    answer:
      'Pelo WhatsApp. Dúvidas sobre agendamento, convênio e funcionamento são respondidas por mensagem; questões sobre o seu caso são avaliadas na consulta.',
    whatsapp: whatsappMessages.general,
  },
];

/* ------------------------------------------------------------ */
/*  SEO                                                          */
/* ------------------------------------------------------------ */

export const seo = {
  title: 'Dra. Sâmia Lima | Dentista em Jacaraípe, Serra/ES',
  description:
    'Consultório odontológico da Dra. Sâmia Lima, cirurgiã-dentista (CRO-ES 6995) em Residencial Jacaraípe, Serra/ES. Agende sua avaliação odontológica pelo WhatsApp.',
};
