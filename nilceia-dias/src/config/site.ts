/**
 * ============================================================
 *  CONFIGURAÇÃO CENTRAL — NILCÉIA DIAS HAIR & COMPANY
 * ============================================================
 *
 *  Todos os dados da marca ficam aqui. Para atualizar o site,
 *  edite este arquivo (e src/config/pages.ts para as páginas
 *  de campanha).
 *
 *  Regra: nada aqui deve ser inventado. Os itens marcados
 *  com "CONFIRMAR" foram informados no briefing, mas ainda
 *  precisam do OK da Nilcéia antes de o site ir ao ar.
 */

export const WHATSAPP_NUMBER = '5527998147768';

export const brand = {
  name: 'Nilcéia Dias Hair & Company',
  shortName: 'Nilcéia Dias',
  descriptor: 'Hair & Company',
  cityLabel: 'Serra — ES',

  /** URL final, sem barra no fim. Vem de VITE_SITE_URL (veja .env.example). */
  siteUrl: (import.meta.env?.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? '',

  phoneDisplay: '(27) 99814-7768',
  phoneHref: 'tel:+5527998147768',

  instagramHandle: 'nilceiadiassalaodebeleza',
  instagramUrl: 'https://instagram.com/nilceiadiassalaodebeleza',

  address: {
    street: 'R. Roberto Maltus, 14',
    neighborhood: 'Parque Residencial Laranjeiras',
    city: 'Serra',
    state: 'ES',
    postalCode: '29165-592',
  },

  maps: {
    embed:
      'https://www.google.com/maps?q=R.+Roberto+Maltus%2C+14%2C+Parque+Residencial+Laranjeiras%2C+Serra+-+ES%2C+29165-592&output=embed',
    directions:
      'https://www.google.com/maps/dir/?api=1&destination=R.+Roberto+Maltus%2C+14%2C+Parque+Residencial+Laranjeiras%2C+Serra+-+ES%2C+29165-592',
    open: 'https://www.google.com/maps/search/?api=1&query=R.+Roberto+Maltus%2C+14%2C+Parque+Residencial+Laranjeiras%2C+Serra+-+ES%2C+29165-592',
  },

  /** Horários: NÃO informados. Deixe vazio até a Nilcéia confirmar. */
  openingHours: [] as string[],

  casamentos: {
    url: 'https://www.casamentos.com.br/beleza-noivas/nilceia-dias-hair-e-company--e235339',
    /** CONFIRMAR: nota informada no briefing; não foi possível abrir a página para conferir. */
    rating: '5,0',
  },
};

/**
 * Provas de autoridade. CONFIRMAR com a Nilcéia antes de publicar.
 * Para esconder um número do site inteiro, troque `show` para false.
 */
export const facts = {
  years: { show: true, value: '33', label: 'anos de experiência' },
  brides: { show: true, value: '+10 mil', label: 'noivas atendidas' },
};

export const yearsText = facts.years.show ? `${facts.years.value} anos` : '';

/**
 * Depoimentos. Cole somente textos ORIGINAIS de avaliações reais
 * (ex.: Casamentos.com.br, Google), com o nome exatamente como
 * aparece na fonte. Lista vazia = a seção mostra só a nota e o link.
 */
export const reviews: { text: string; author: string; source: string; date?: string }[] = [];

/**
 * Portfólio REAL (fotos de trabalhos feitos no salão, com autorização
 * de uso de imagem das clientes). Coloque os arquivos em public/portfolio/
 * e liste aqui. Lista vazia = a galeria convida a ver os trabalhos no Instagram.
 *
 *   { src: '/portfolio/noiva-01.webp', width: 1080, height: 1350, alt: 'Penteado preso com ondas soltas para noiva' }
 */
export const portfolio: { src: string; width: number; height: number; alt: string; category?: string }[] = [];

/** Foto real da Nilcéia (em public/). Vazio = a seção "Sobre" usa composição tipográfica. */
export const nilceiaPhoto: { src: string; width: number; height: number } | null = null;

/* ------------------------------------------------------------------ */
/*  Mensagens de WhatsApp                                              */
/* ------------------------------------------------------------------ */

export type Intent = 'general' | 'brides' | 'hair' | 'treatments' | 'makeup' | 'schedule';

export const whatsappMessages: Record<Intent, string> = {
  schedule: 'Olá, gostaria de agendar um horário na Nilcéia Dias.',
  general: 'Olá, Nilcéia! Conheci seu salão pelo site e gostaria de saber mais sobre os atendimentos.',
  brides:
    'Olá, Nilcéia! Conheci seu trabalho pelo site e tenho interesse na produção para meu casamento. Gostaria de saber como funciona o atendimento e consultar a disponibilidade da minha data.',
  treatments:
    'Olá! Conheci seu trabalho pelo site e gostaria de conversar sobre os cuidados e tratamentos capilares. Quero entender quais opções podem fazer sentido para o meu cabelo.',
  hair: 'Olá! Conheci o salão pelo site e gostaria de conhecer os serviços de cabelo e consultar valores e horários.',
  makeup: 'Olá! Gostaria de conhecer os serviços de maquiagem e unhas e consultar a disponibilidade.',
};

/**
 * Acrescenta ao fim da mensagem uma referência curta da campanha
 * (ex.: "Ref.: instagram / noivas-nov") quando o visitante chega
 * por um link com UTM. Ajuda a saber qual anúncio gerou a conversa.
 */
export const appendCampaignRef = true;

/* ------------------------------------------------------------------ */
/*  Serviços                                                           */
/* ------------------------------------------------------------------ */

export interface ServiceCategory {
  id: 'noivas' | 'cabelos' | 'tratamentos' | 'make';
  number: string;
  name: string;
  headline: string;
  description: string;
  benefit: string;
  /** Serviços específicos. CONFIRMAR antes de preencher; vazio = não exibe lista. */
  items: string[];
  cta: string;
  intent: Intent;
  /** false esconde a categoria inteira (ex.: se unhas não forem oferecidas). */
  enabled: boolean;
}

export const services: ServiceCategory[] = [
  {
    id: 'noivas',
    number: '01',
    name: 'Noivas e produções',
    headline: 'Para momentos que merecem ser inesquecíveis.',
    description:
      'Uma produção pensada para valorizar sua beleza e acompanhar a importância de um dos dias mais especiais da sua história.',
    benefit: 'Tranquilidade para viver o dia sem se preocupar com a produção.',
    items: [],
    cta: 'Conhecer atendimento para noivas',
    intent: 'brides',
    enabled: true,
  },
  {
    id: 'cabelos',
    number: '02',
    name: 'Cabelos e corte',
    headline: 'Seu cabelo, sua identidade.',
    description: 'Cuidados e serviços para valorizar o movimento, o acabamento e a beleza dos seus cabelos.',
    benefit: 'Um visual que conversa com o seu estilo e a sua rotina.',
    // CONFIRMAR: briefing cita "corte, escova e cachoterapia" como exemplos.
    items: [],
    cta: 'Consultar serviços de cabelo',
    intent: 'hair',
    enabled: true,
  },
  {
    id: 'tratamentos',
    number: '03',
    name: 'Diagnóstico e tratamentos capilares',
    headline: 'Cuidado começa com atenção.',
    description:
      'Cada cabelo possui necessidades diferentes. Converse com a profissional sobre o que seus fios precisam e conheça as possibilidades de tratamento.',
    benefit: 'Uma conversa honesta sobre o que faz sentido para os seus fios.',
    items: [],
    cta: 'Quero conversar sobre meu cabelo',
    intent: 'treatments',
    enabled: true,
  },
  {
    id: 'make',
    number: '04',
    name: 'Make e unhas',
    headline: 'Os detalhes fazem a diferença.',
    description: 'Produções que complementam seu visual com cuidado e atenção ao acabamento.',
    benefit: 'Acabamento cuidadoso para fechar o visual.',
    // CONFIRMAR: quais serviços de maquiagem e unhas são oferecidos.
    items: [],
    cta: 'Consultar maquiagem e unhas',
    intent: 'makeup',
    enabled: true,
  },
];

/* ------------------------------------------------------------------ */
/*  FAQ — só informações confirmadas; o resto direciona ao WhatsApp    */
/* ------------------------------------------------------------------ */

export const faq: { question: string; answer: string; intent: Intent }[] = [
  {
    question: 'Como faço para agendar?',
    answer:
      'Pelo WhatsApp. Toque em qualquer botão “Agendar” desta página: a conversa abre com uma mensagem pronta, e você só precisa contar o que procura. A partir daí verificamos a disponibilidade com você.',
    intent: 'schedule',
  },
  {
    question: 'Como funciona o atendimento para noivas?',
    answer:
      'Começa com uma conversa para entender a data, o estilo que você imagina e as suas preferências. Os detalhes do atendimento e a disponibilidade da sua data são combinados diretamente com a Nilcéia pelo WhatsApp.',
    intent: 'brides',
  },
  {
    question: 'Quais serviços são oferecidos?',
    answer: `As frentes de atendimento são: ${services
      .filter((s) => s.enabled)
      .map((s) => s.name.toLowerCase())
      .join('; ')}. Para saber se um serviço específico está disponível, pergunte pelo WhatsApp.`,
    intent: 'general',
  },
  {
    question: 'Como saber qual tratamento é indicado para o meu cabelo?',
    answer:
      'Isso depende do histórico e das necessidades dos seus fios. O melhor caminho é conversar com a profissional, contar o que você sente no seu cabelo e entender as possibilidades antes de decidir.',
    intent: 'treatments',
  },
  {
    question: 'Onde fica o salão?',
    answer:
      'R. Roberto Maltus, 14, Parque Residencial Laranjeiras, Serra — ES, CEP 29165-592. Na seção “Localização” há o mapa e o botão de rota.',
    intent: 'general',
  },
  {
    question: 'Como consultar valores e disponibilidade?',
    answer:
      'Valores e horários variam conforme o serviço, por isso são informados diretamente pelo WhatsApp. Conte o que você procura e retornamos com as informações.',
    intent: 'schedule',
  },
];
