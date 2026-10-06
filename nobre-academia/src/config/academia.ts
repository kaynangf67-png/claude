/**
 * ============================================================
 *  NOBRE ACADEMIA — dados do site (único arquivo a editar)
 * ============================================================
 *
 * Regra do projeto: nada aqui foi inventado. Cada dado tem a fonte
 * pública indicada no comentário. O que não foi confirmado fica vazio
 * ou entre colchetes ("[a confirmar]") e aparece no site com um
 * marcador visual até ser preenchido pela academia.
 */

/**
 * WhatsApp oficial no formato internacional, só dígitos: 55 + DDD + número.
 * Ex.: '5527999999999'.
 *
 * Nenhum WhatsApp foi encontrado publicamente. Enquanto estiver vazio,
 * todos os botões de contato do site ligam para o telefone fixo abaixo
 * e os textos "WhatsApp" viram "Ligar".
 */
export const WHATSAPP_NUMBER = '';

export const academia = {
  name: 'Nobre Academia',
  /** Como a academia aparece no Gympass, TotalPass e catálogos públicos. */
  alternateName: 'Academia Nobre',
  shortName: 'Nobre',

  /** Fonte: Google, Gympass, Instagram (bio). */
  phone: { display: '(27) 3243-4654', e164: '+552732434654' },

  /** Fonte: Google, Gympass, TotalPass. */
  address: {
    street: 'Av. Abido Saad, 269',
    streetLong: 'Avenida Abido Saad, 269',
    neighborhood: 'Jacaraípe',
    city: 'Serra',
    state: 'ES',
    postalCode: '29175-520',
  },

  /**
   * Coordenadas do pin no Google Maps. Não confirmadas — deixar null até
   * copiar do perfil oficial (clique com o botão direito no pin → coordenadas).
   */
  geo: null as { lat: number; lng: number } | null,

  /**
   * Link do perfil no Google Maps. Hoje é uma busca pelo endereço; trocar pelo
   * link de compartilhamento do perfil oficial (Maps → Compartilhar → Copiar link).
   */
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Academia Nobre, Av. Abido Saad, 269 - Jacaraípe, Serra - ES, 29175-520'),
  mapsEmbedQuery: 'Av. Abido Saad, 269 - Jacaraípe, Serra - ES, 29175-520',

  /** Fonte: perfil do Google (informado pelo cliente). Sem número de avaliações para não desatualizar. */
  googleRating: 4.5,

  /** Fonte: busca pública; o perfil exibe o mesmo telefone da academia. */
  instagram: 'academia_nobre_jacaraipe',
  /** Nenhuma página oficial no Facebook foi confirmada. */
  facebookUrl: '',

  /** Plataformas de benefício onde a academia aparece. Fonte: gympass.com e totalpass.com. */
  partners: ['Wellhub (Gympass)', 'TotalPass'],

  /**
   * Foto de fundo da primeira dobra (nome processado por `npm run fotos`, sem extensão).
   * Vazio = composição gráfica sem foto. Use uma foto REAL da academia.
   */
  heroImage: '',

  /** Ano exibido no rodapé. */
  copyrightYear: 2026,
};

/**
 * Horário de funcionamento.
 * Fontes externas publicam horários diferentes, então nada foi assumido.
 * Preencha com o horário confirmado pelo proprietário, no formato 'HH:MM–HH:MM'.
 * Vários turnos: separe com ' / ' (ex.: '06:00–11:00 / 16:00–21:00').
 * Fechado: 'Fechado'. Enquanto houver '[a confirmar]', o horário NÃO vai para o Google (Schema.org).
 */
export const openingHours: { day: string; schemaDay: string; hours: string }[] = [
  { day: 'Segunda', schemaDay: 'Monday', hours: '[a confirmar]' },
  { day: 'Terça', schemaDay: 'Tuesday', hours: '[a confirmar]' },
  { day: 'Quarta', schemaDay: 'Wednesday', hours: '[a confirmar]' },
  { day: 'Quinta', schemaDay: 'Thursday', hours: '[a confirmar]' },
  { day: 'Sexta', schemaDay: 'Friday', hours: '[a confirmar]' },
  { day: 'Sábado', schemaDay: 'Saturday', hours: '[a confirmar]' },
  { day: 'Domingo', schemaDay: 'Sunday', hours: '[a confirmar]' },
];

export type ActivityIcon = 'dumbbell' | 'activity' | 'flame' | 'zap' | 'music' | 'swords';

/**
 * Modalidades. Fonte: listagem da academia no Gympass/Wellhub
 * (Fitness, Funcional, GAP, Jump, MMA, Musculação, Zumba).
 * `image` é opcional: nome da foto (sem extensão) processada por `npm run fotos`.
 */
export const activities: {
  name: string;
  slug: string;
  icon: ActivityIcon;
  description: string;
  image?: string;
}[] = [
  {
    name: 'Musculação',
    slug: 'musculacao',
    icon: 'dumbbell',
    description: 'Treinamento de força para diferentes objetivos, do primeiro treino ao avançado.',
  },
  {
    name: 'Funcional',
    slug: 'funcional',
    icon: 'activity',
    description: 'Exercícios voltados ao condicionamento, à mobilidade e ao desenvolvimento físico.',
  },
  {
    name: 'GAP',
    slug: 'gap',
    icon: 'flame',
    description: 'Treinos com foco em glúteos, abdômen e pernas.',
  },
  {
    name: 'Jump',
    slug: 'jump',
    icon: 'zap',
    description: 'Aula dinâmica e energética no mini trampolim.',
  },
  {
    name: 'Zumba',
    slug: 'zumba',
    icon: 'music',
    description: 'Dança e exercício juntos, em uma aula leve e divertida.',
  },
  {
    name: 'MMA',
    slug: 'mma',
    icon: 'swords',
    description: 'Artes marciais mistas para quem quer técnica, condicionamento e disciplina.',
  },
];

export type AmenityIcon = 'snowflake' | 'shirt' | 'wifi' | 'accessibility';

/** Comodidades. Fonte: Google e Gympass/Wellhub. */
export const amenities: { name: string; icon: AmenityIcon; description: string }[] = [
  { name: 'Ar-condicionado', icon: 'snowflake', description: 'Ambiente climatizado para treinar com mais conforto.' },
  { name: 'Vestiário', icon: 'shirt', description: 'Para se trocar antes e depois do treino.' },
  { name: 'Wi-Fi', icon: 'wifi', description: 'Conexão disponível na academia.' },
  {
    name: 'Acessibilidade',
    icon: 'accessibility',
    description: 'Espaço adaptado para cadeira de rodas.',
  },
];

/**
 * Galeria. Coloque as fotos reais (JPG/PNG, idealmente 1600 px ou mais no lado maior)
 * em photos-originais/, rode `npm run fotos` e liste aqui o nome do arquivo SEM extensão
 * (ex.: { file: 'musculacao', alt: 'Área de musculação com ...' }).
 *
 * Enquanto a lista estiver vazia, a galeria mostra espaços reservados com a
 * sugestão de foto para cada posição.
 */
export const gallery: { file: string; alt: string }[] = [];

/** Sugestões de fotos exibidas nos espaços reservados da galeria (na ordem do grid). */
export const gallerySlots = [
  'Área de musculação',
  'Aula coletiva em andamento',
  'Fachada na Av. Abido Saad',
  'Equipamentos',
  'Alunos treinando',
  'Vestiário e recepção',
];

/**
 * Avaliações reais do Google. Copie o texto exatamente como publicado, com
 * autorização, e o primeiro nome + inicial do autor. NUNCA invente depoimentos.
 * Lista vazia = a seção mostra só a nota e o link para o Google.
 */
export const reviews: { author: string; text: string; rating: number; when?: string }[] = [];

/** Mensagens pré-preenchidas do WhatsApp. */
export const messages = {
  default: 'Olá! Conheci a Nobre Academia pelo site e gostaria de saber mais informações.',
  plans: 'Olá! Conheci a Nobre Academia pelo site e gostaria de saber mais sobre planos e atividades.',
  visit: 'Olá! Conheci a Nobre Academia pelo site e gostaria de conhecer a academia.',
  hours: 'Olá! Vi o site da Nobre Academia e gostaria de confirmar os horários de funcionamento.',
  activity: (name: string) => `Olá! Vi no site da Nobre Academia a modalidade ${name} e gostaria de saber mais.`,
  faq: 'Olá! Vi o site da Nobre Academia e fiquei com uma dúvida.',
};

export const seo = {
  title: 'Nobre Academia em Jacaraípe | Academia em Serra - ES',
  description:
    'Conheça a Nobre Academia em Jacaraípe, Serra/ES. Musculação, funcional e outras atividades para cuidar da saúde, condicionamento e qualidade de vida. Fale conosco.',
};
