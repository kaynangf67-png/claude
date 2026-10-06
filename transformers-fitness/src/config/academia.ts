/**
 * ============================================================
 *  ACADEMIA TRANSFORMERS FITNESS — dados do site (único arquivo a editar)
 * ============================================================
 *
 * Regra do projeto: nada aqui foi inventado. Cada dado tem a fonte
 * pública indicada no comentário. O que não foi confirmado fica vazio,
 * null ou entre colchetes ("[a confirmar]").
 */

/**
 * WhatsApp no formato internacional, só dígitos: 55 + DDD + número.
 * Fonte: celular de contato publicado no Gympass/Wellhub e no Solutudo.
 * Confirmar com a academia que este número atende no WhatsApp.
 * Vazio = os botões ligam para o telefone.
 */
export const WHATSAPP_NUMBER = '5527996070045';

export const academia = {
  name: 'Transformers Fitness',
  /** Razão social / nome nas plataformas. */
  alternateName: 'Academia Transformers Fitness',
  shortName: 'Transformers',

  /** Fonte: Gympass/Wellhub, Solutudo. */
  phone: { display: '(27) 99607-0045', e164: '+5527996070045' },

  /** Fonte: Gympass/Wellhub, TotalPass, cadastro do CNPJ. */
  address: {
    street: 'Av. Minas Gerais, 15',
    streetLong: 'Avenida Minas Gerais, 15',
    neighborhood: 'Residencial Jacaraípe',
    /** Nome curto do bairro para chamadas ("Estamos em Jacaraípe"). */
    district: 'Jacaraípe',
    city: 'Serra',
    state: 'ES',
    postalCode: '29175-456',
  },

  /** Coordenadas do pin no Google Maps. Não confirmadas. */
  geo: null as { lat: number; lng: number } | null,

  /** Link do perfil no Google Maps, enviado pelo cliente. */
  mapsUrl: 'https://maps.app.goo.gl/ADe9xmcY5JcFUsdC7',
  mapsEmbedQuery: 'Academia Transformers Fitness, Av. Minas Gerais, 15 - Jacaraípe, Serra - ES, 29175-456',

  /**
   * Nota no Google. null = não exibida. Copie do perfil do Maps (ex.: 4.8).
   * Não foi possível confirmar a nota atual do Google.
   */
  googleRating: null as number | null,

  /** Fonte: busca pública (perfis com o nome da academia). */
  instagram: 'academiatransformersfitness',
  facebookUrl: 'https://www.facebook.com/academiatransformersfitness/',

  /** Fonte: Gympass/Wellhub e TotalPass. */
  partners: ['Wellhub (Gympass)', 'TotalPass'],

  /** Foto de fundo da primeira dobra (`npm run fotos`). Vazio = composição gráfica. */
  heroImage: '',

  copyrightYear: 2026,
};

/**
 * Horário de funcionamento. Fonte: listagem da academia no Gympass/Wellhub.
 * Confirmar com o proprietário. Formato 'HH:MM–HH:MM', turnos separados por ' / '.
 */
export const openingHours: { day: string; schemaDay: string; hours: string }[] = [
  { day: 'Segunda', schemaDay: 'Monday', hours: '05:00–11:00 / 13:00–22:00' },
  { day: 'Terça', schemaDay: 'Tuesday', hours: '05:00–11:00 / 13:00–22:00' },
  { day: 'Quarta', schemaDay: 'Wednesday', hours: '05:00–11:00 / 13:00–22:00' },
  { day: 'Quinta', schemaDay: 'Thursday', hours: '05:00–11:00 / 13:00–22:00' },
  { day: 'Sexta', schemaDay: 'Friday', hours: '05:00–11:00 / 13:00–22:00' },
  { day: 'Sábado', schemaDay: 'Saturday', hours: '07:00–11:00' },
  { day: 'Domingo', schemaDay: 'Sunday', hours: 'Fechado' },
];

export type ActivityIcon = 'dumbbell' | 'zap' | 'flame' | 'heart' | 'drum' | 'music' | 'party' | 'circuit';

/** Modalidades. Fonte: descrição da academia no Gympass/Wellhub. */
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
  { name: 'Jump', slug: 'jump', icon: 'zap', description: 'Aula dinâmica e energética no mini trampolim.' },
  {
    name: 'Ritbox',
    slug: 'ritbox',
    icon: 'flame',
    description: 'Movimentos inspirados em lutas no ritmo da música. Intenso e motivante.',
  },
  { name: 'Aeróbica', slug: 'aerobica', icon: 'heart', description: 'Condicionamento cardiorrespiratório em aula coletiva.' },
  { name: 'Ritmos', slug: 'ritmos', icon: 'drum', description: 'Coreografias com músicas variadas para treinar dançando.' },
  { name: 'Zumba', slug: 'zumba', icon: 'music', description: 'Dança e exercício juntos, em uma aula leve e divertida.' },
  { name: 'Fitdance', slug: 'fitdance', icon: 'party', description: 'Coreografias de hits para suar se divertindo.' },
  {
    name: 'Circuito',
    slug: 'circuito',
    icon: 'circuit',
    description: 'Estações em sequência que trabalham o corpo todo em um só treino.',
  },
];

export type AmenityIcon = 'dumbbell' | 'users' | 'heart' | 'lock';

/**
 * Diferenciais. Fonte: descrição publicada pela própria academia no Gympass/Wellhub
 * ("equipamentos modernos, ambiente agradável e familiar, profissionais atenciosos
 * e atendimento personalizado") e comodidade "armários".
 */
export const amenities: { name: string; icon: AmenityIcon; description: string }[] = [
  { name: 'Equipamentos modernos', icon: 'dumbbell', description: 'Estrutura atualizada para treinar com qualidade.' },
  { name: 'Ambiente familiar', icon: 'users', description: 'Um lugar agradável, onde você se sente em casa.' },
  { name: 'Atendimento personalizado', icon: 'heart', description: 'Profissionais atenciosos e acompanhamento próximo.' },
  { name: 'Armários', icon: 'lock', description: 'Para guardar seus pertences enquanto treina.' },
];

/** Galeria. Fotos reais em photos-originais/ → `npm run fotos` → liste aqui (nome sem extensão). */
export const gallery: { file: string; alt: string }[] = [];

export const gallerySlots = [
  'Área de musculação',
  'Aula coletiva em andamento',
  'Fachada na Av. Minas Gerais',
  'Equipamentos',
  'Alunos treinando',
  'Recepção',
];

/** Avaliações reais do Google, copiadas com autorização. NUNCA invente depoimentos. */
export const reviews: { author: string; text: string; rating: number; when?: string }[] = [];

export const messages = {
  default: 'Olá! Conheci a Transformers Fitness pelo site e gostaria de saber mais informações.',
  plans: 'Olá! Conheci a Transformers Fitness pelo site e gostaria de saber mais sobre planos e atividades.',
  visit: 'Olá! Conheci a Transformers Fitness pelo site e gostaria de conhecer a academia.',
  hours: 'Olá! Vi o site da Transformers Fitness e gostaria de confirmar os horários.',
  activity: (name: string) => `Olá! Vi no site da Transformers Fitness a modalidade ${name} e gostaria de saber mais.`,
  faq: 'Olá! Vi o site da Transformers Fitness e fiquei com uma dúvida.',
};

export const seo = {
  title: 'Transformers Fitness | Academia em Jacaraípe, Serra - ES',
  description:
    'Academia Transformers Fitness em Jacaraípe, Serra/ES. Musculação, Jump, Ritbox, Zumba, Fitdance e mais. Aberta a partir das 5h. Fale com a gente pelo WhatsApp.',
};
