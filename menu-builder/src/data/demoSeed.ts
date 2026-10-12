/**
 * Projeto FICTÍCIO do modo demonstração. Nome, itens e preços são inventados
 * só para mostrar as telas; não representam nenhum restaurante real.
 */
import type { Category, Product, Project } from '@/domain/types';

export const DEMO_OWNER_ID = '00000000-0000-0000-0000-00000000de00';
const PROJECT_ID = '00000000-0000-0000-0000-00000000de01';
const T = '2026-01-01T12:00:00.000Z';

export function demoSeed(): { projects: Project[]; categories: Category[]; products: Product[] } {
  const project: Project = {
    id: PROJECT_ID,
    ownerId: DEMO_OWNER_ID,
    restaurantName: 'Cantina Exemplo (fictícia)',
    slug: 'cantina-exemplo',
    description: 'Projeto de demonstração com dados fictícios. Use-o para conhecer o editor e a página pública.',
    businessType: 'Restaurante',
    phone: '',
    whatsappNumber: '',
    showWhatsapp: false,
    address: '',
    openingHours: '',
    instagramUrl: '',
    googleMapsUrl: '',
    websiteUrl: '',
    logoUrl: null,
    coverUrl: null,
    primaryColor: '#1e3a5f',
    secondaryColor: '#c2410c',
    theme: 'claro',
    status: 'published',
    isDemo: true,
    publishedAt: T,
    createdAt: T,
    updatedAt: T,
  };
  const cat = (id: string, name: string, sortOrder: number): Category => ({ id, projectId: PROJECT_ID, name, sortOrder });
  const categories = [
    cat('00000000-0000-0000-0000-00000000dc01', 'Pratos do dia', 0),
    cat('00000000-0000-0000-0000-00000000dc02', 'Bebidas', 1),
  ];
  const product = (n: number, categoryId: string, over: Partial<Product>): Product => ({
    id: `00000000-0000-0000-0000-0000000d${String(n).padStart(4, '0')}`,
    projectId: PROJECT_ID,
    categoryId,
    name: '',
    description: '',
    price: null,
    variations: [],
    imageUrl: null,
    available: true,
    sortOrder: n,
    sourceReference: 'demonstração (fictício)',
    confidence: null,
    reviewRequired: false,
    reviewNotes: [],
    createdAt: T,
    updatedAt: T,
    ...over,
  });
  const products = [
    product(1, categories[0].id, { name: 'Frango grelhado', description: 'Com arroz, feijão e salada.', price: 29.9 }),
    product(2, categories[0].id, {
      name: 'Marmita',
      description: 'Arroz, feijão, uma proteína e duas guarnições.',
      variations: [
        { label: 'Pequena', price: 19.9 },
        { label: 'Grande', price: 24.9 },
      ],
    }),
    product(3, categories[0].id, {
      name: 'Peixe do dia',
      sourceReference: 'demonstração (fictício) — simula item lido pela IA',
      confidence: 0.6,
      reviewRequired: true,
      reviewNotes: ['Exemplo: preço ilegível na foto. Este item não aparece no cardápio público até ser revisado.'],
    }),
    product(4, categories[1].id, { name: 'Suco natural', description: '300 ml.', price: 9 }),
    product(5, categories[1].id, { name: 'Refrigerante lata', price: 6.5, available: false }),
  ];
  return { projects: [project], categories, products };
}
