/**
 * ============================================================
 *  CLIENTE DE DEMONSTRAÇÃO (CLIENT=demo) — modelo para novos clientes
 * ============================================================
 *
 *  ATENÇÃO: os dados abaixo são FICTÍCIOS, só para demonstrar o
 *  template. `stage: 'demo'` exibe uma faixa de aviso no site e faz
 *  `npm run check:publish` falhar até ser trocado por dados reais.
 *
 *  Regras:
 *  - Nunca invente preço, ingrediente, horário ou endereço.
 *  - Preço desconhecido: `value: null` (PRECISA CONFIRMAR).
 *  - Produto só vai ao ar com `verified: true` e todos os preços preenchidos.
 *  - Campo opcional sem informação: apague a linha. A seção some do site.
 *  - Imagens ficam em public/images/; aqui vai o caminho sem barra inicial.
 */
import type { MenuConfig } from '../types/menu.ts';

export const menu: MenuConfig = {
  stage: 'demo',

  restaurant: {
    name: 'Cantina Modelo',
    type: 'Restaurante e marmitaria',
    tagline: 'Comida caseira feita no dia, do almoço ao jantar.',
    description: [
      'Este é um cardápio de demonstração do template da Web Company.',
      'Substitua este texto pela descrição aprovada pelo restaurante.',
    ],
    // logo: 'images/brand/logo.svg',
    // heroImage: 'images/brand/hero.webp',
    // heroImageAlt: 'Salão do restaurante',
    publicUrl: '',
    phoneDisplay: '(11) 0000-0000',
    phoneDigits: '551100000000',
    address: {
      line1: 'Rua Exemplo, 123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
    },
    openingHours: [
      { days: 'Segunda a sexta', hours: '11h às 15h' },
      { days: 'Sábado', hours: '11h às 16h' },
      { days: 'Domingo', hours: 'Fechado' },
    ],
    social: {
      instagram: 'https://www.instagram.com/',
    },
    menuNotes: [
      'Preços em reais (R$). Imagens meramente ilustrativas quando indicado.',
      'Em caso de alergia ou restrição alimentar, consulte a equipe antes de pedir.',
    ],
  },

  theme: {
    primary: '#9a3412',
    accent: '#ca8a04',
    background: '#faf6f0',
    surface: '#ffffff',
    text: '#1c1917',
    font: 'rustico',
  },

  categories: [
    { id: 'pratos-executivos', name: 'Pratos executivos', description: 'Acompanham arroz, feijão e salada.' },
    { id: 'marmitas', name: 'Marmitas' },
    { id: 'porcoes', name: 'Porções' },
    { id: 'bebidas', name: 'Bebidas' },
    { id: 'sobremesas', name: 'Sobremesas' },
  ],

  products: [
    {
      id: 'exec-frango-grelhado',
      name: 'Frango grelhado',
      categoryId: 'pratos-executivos',
      description: 'Filé de frango grelhado com arroz, feijão, salada e batata frita.',
      prices: [{ value: 29.9 }],
      badge: 'Mais pedido',
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'exec-bife-acebolado',
      name: 'Bife acebolado',
      categoryId: 'pratos-executivos',
      description: 'Bife bovino com cebola na chapa, arroz, feijão e salada.',
      prices: [{ value: 34.9 }],
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'exec-parmegiana',
      name: 'Parmegiana de frango',
      categoryId: 'pratos-executivos',
      description: 'Filé empanado com molho de tomate e queijo gratinado, arroz e fritas.',
      prices: [{ value: 38.9 }],
      available: false,
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'exec-peixe-do-dia',
      name: 'Peixe do dia',
      categoryId: 'pratos-executivos',
      prices: [{ value: null }],
      verified: false,
      source: 'Demonstração',
      note: 'Exemplo de item pendente: sem preço confirmado, não aparece no build de produção.',
    },
    {
      id: 'marmita-tradicional',
      name: 'Marmita tradicional',
      categoryId: 'marmitas',
      description: 'Arroz, feijão, uma proteína e duas guarnições do dia.',
      prices: [
        { label: 'Pequena', value: 19.9 },
        { label: 'Grande', value: 24.9 },
      ],
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'porcao-batata-frita',
      name: 'Batata frita',
      categoryId: 'porcoes',
      prices: [
        { label: 'Meia', value: 22 },
        { label: 'Inteira', value: 36 },
      ],
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'bebida-refrigerante-lata',
      name: 'Refrigerante lata',
      categoryId: 'bebidas',
      description: '350 ml.',
      prices: [{ value: 6.5 }],
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'bebida-suco-natural',
      name: 'Suco natural',
      categoryId: 'bebidas',
      description: 'Sabores do dia, consulte a equipe.',
      prices: [{ value: 9 }],
      verified: true,
      source: 'Demonstração',
    },
    {
      id: 'sobremesa-pudim',
      name: 'Pudim de leite',
      categoryId: 'sobremesas',
      prices: [{ value: 12 }],
      verified: true,
      source: 'Demonstração',
    },
  ],
};
