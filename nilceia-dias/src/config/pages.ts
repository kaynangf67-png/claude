/**
 * Páginas do site. A home e as páginas de campanha reutilizam os mesmos
 * componentes; muda só o que precisa mudar para cada público
 * (título, imagem principal, mensagem do WhatsApp e ordem das seções).
 *
 * Para criar uma nova página de campanha:
 *   1. adicione uma entrada aqui;
 *   2. adicione o caminho em `pageEntries` no vite.config.ts.
 */
import type { Intent } from './site';
import type { PhotoKey } from '../lib/photos';

export type SectionKey =
  | 'authority'
  | 'identification'
  | 'services'
  | 'brides'
  | 'gallery'
  | 'proof'
  | 'about'
  | 'steps'
  | 'location'
  | 'faq'
  | 'final';

export interface PageConfig {
  key: string;
  path: string;
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    headline: string;
    /** Parte do título em itálico dourado (opcional, deve estar contida em headline). */
    accent?: string;
    sub: string;
    cta: string;
    intent: Intent;
    secondary: { label: string; href: string };
    photo: PhotoKey;
  };
  /** Ordem das seções após o hero. */
  sections: SectionKey[];
  /** Intenção da barra fixa/CTA flutuante e do CTA final. */
  primaryIntent: Intent;
}

const base: SectionKey[] = [
  'authority',
  'identification',
  'services',
  'brides',
  'gallery',
  'proof',
  'about',
  'steps',
  'location',
  'faq',
  'final',
];

export const pages: Record<string, PageConfig> = {
  home: {
    key: 'home',
    path: '/',
    title: 'Nilcéia Dias Hair & Company | Salão de beleza e noivas em Serra — ES',
    description:
      'Cabelos, tratamentos capilares, maquiagem e produção de noivas em Parque Residencial Laranjeiras, Serra — ES. Agende pelo WhatsApp.',
    hero: {
      eyebrow: 'Nilcéia Dias · Hair & Company',
      headline: 'Beleza que revela o melhor de você.',
      accent: 'o melhor de você.',
      sub: 'Experiência, cuidado e atenção aos detalhes para transformar sua relação com a beleza, dos cuidados com os cabelos à produção de noivas.',
      cta: 'Quero agendar meu atendimento',
      intent: 'schedule',
      secondary: { label: 'Conhecer os serviços', href: '#servicos' },
      photo: 'noiva',
    },
    sections: base,
    primaryIntent: 'schedule',
  },
  noivas: {
    key: 'noivas',
    path: '/noivas/',
    title: 'Noivas | Nilcéia Dias Hair & Company — Serra, ES',
    description:
      'Produção de noivas com a experiência de Nilcéia Dias, em Serra — ES. Converse pelo WhatsApp e consulte a disponibilidade da sua data.',
    hero: {
      eyebrow: 'Noivas · Serra — ES',
      headline: 'Seu grande dia merece uma profissional em quem você confia.',
      accent: 'em quem você confia.',
      sub: 'Uma conversa inicial para entender seu estilo, sua data e o que você imagina para a produção. Sem compromisso.',
      cta: 'Quero conversar sobre minha data',
      intent: 'brides',
      secondary: { label: 'Como funciona', href: '#como-funciona' },
      photo: 'noiva',
    },
    sections: ['authority', 'brides', 'proof', 'gallery', 'about', 'steps', 'faq', 'location', 'final'],
    primaryIntent: 'brides',
  },
  tratamentos: {
    key: 'tratamentos',
    path: '/tratamentos-capilares/',
    title: 'Tratamentos capilares | Nilcéia Dias Hair & Company — Serra, ES',
    description:
      'Converse com a profissional sobre o que os seus fios precisam e conheça as possibilidades de tratamento. Serra — ES.',
    hero: {
      eyebrow: 'Tratamentos capilares · Serra — ES',
      headline: 'Cuidado começa com atenção.',
      accent: 'com atenção.',
      sub: 'Cada cabelo tem uma história. Conte o que você sente nos seus fios e entenda quais cuidados podem fazer sentido para você.',
      cta: 'Quero conversar sobre meu cabelo',
      intent: 'treatments',
      secondary: { label: 'Como funciona', href: '#como-funciona' },
      photo: 'fios',
    },
    sections: ['authority', 'identification', 'steps', 'services', 'about', 'proof', 'faq', 'location', 'final'],
    primaryIntent: 'treatments',
  },
  cabelos: {
    key: 'cabelos',
    path: '/cabelos/',
    title: 'Cabelos e corte | Nilcéia Dias Hair & Company — Serra, ES',
    description:
      'Serviços de cabelo para valorizar movimento, acabamento e estilo, em Serra — ES. Consulte valores e horários pelo WhatsApp.',
    hero: {
      eyebrow: 'Cabelos · Serra — ES',
      headline: 'Seu cabelo, sua identidade.',
      accent: 'sua identidade.',
      sub: 'Cuidados e serviços para valorizar o movimento, o acabamento e a beleza dos seus cabelos, com atenção ao que você procura.',
      cta: 'Consultar serviços de cabelo',
      intent: 'hair',
      secondary: { label: 'Ver serviços', href: '#servicos' },
      photo: 'cabelos',
    },
    sections: ['authority', 'services', 'gallery', 'about', 'proof', 'steps', 'faq', 'location', 'final'],
    primaryIntent: 'hair',
  },
  privacidade: {
    key: 'privacidade',
    path: '/privacidade/',
    title: 'Política de privacidade | Nilcéia Dias Hair & Company',
    description: 'Como o site da Nilcéia Dias Hair & Company trata dados e cookies.',
    hero: {
      eyebrow: '',
      headline: '',
      sub: '',
      cta: '',
      intent: 'general',
      secondary: { label: '', href: '' },
      photo: 'noiva',
    },
    sections: [],
    primaryIntent: 'general',
  },
};
