/**
 * ============================================================
 *  BARRETOS — Churrascaria & Petiscaria (CLIENT=barretos)
 * ============================================================
 *
 *  FONTE ÚNICA: foto do cardápio impresso publicada por um cliente
 *  em avaliação do Google Maps há cerca de 4 anos. NÃO veio do
 *  restaurante. Por isso:
 *  - todos os produtos estão `verified: false`;
 *  - stage 'preview' (faixa de aviso, fora do Google);
 *  - nada aqui vai para 'live' sem o dono confirmar item por item.
 *
 *  Não encontrado em busca na web: cidade/UF, DDD, Instagram,
 *  Facebook, horário. Nenhum deles foi preenchido por suposição.
 */
import type { MenuConfig } from '../types/menu.ts';

const SOURCE = 'Foto do cardápio em avaliação do Google Maps (~4 anos)';

export const menu: MenuConfig = {
  stage: 'preview',

  restaurant: {
    name: 'Barretos',
    type: 'Churrascaria & Petiscaria',
    publicUrl: '',
    // DDD não aparece no cardápio: sem phoneDigits o número não vira link.
    phoneDisplay: '99845-2149 / 99801-3617',
    address: {
      line1: 'Rua Monte Líbano, 61',
      neighborhood: 'Colina de Laranjeiras',
    },
    menuNotes: ['Preços em reais (R$).'],
  },

  // Cores tiradas da foto do cardápio: fundo escuro, títulos laranja, preços amarelos.
  theme: {
    primary: '#f0a12b',
    accent: '#e5552a',
    background: '#121110',
    surface: '#1d1b19',
    text: '#f4efe8',
    font: 'moderno',
  },

  categories: [
    { id: 'churrascaria', name: 'Churrascaria', description: 'Acompanham farofa e vinagrete.' },
    { id: 'queijos-e-pao-de-alho', name: 'Queijos e pão de alho' },
    { id: 'marmitas', name: 'Marmitas' },
    { id: 'guarnicoes', name: 'Guarnições' },
    { id: 'caldos', name: 'Caldos' },
  ],

  products: [
    // Churrascaria
    { id: 'picanha-recheada-queijo', name: 'Picanha recheada com queijo', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 100.9 }], verified: false, source: SOURCE },
    { id: 'picanha-com-bacon', name: 'Picanha com bacon', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 98.1 }], verified: false, source: SOURCE, note: 'Leitura "98,10" incerta na foto (pode ser 98,90).' },
    { id: 'picanha-maturada', name: 'Picanha maturada', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 98.1 }], verified: false, source: SOURCE, note: 'Leitura "98,10" incerta na foto (pode ser 98,90).' },
    { id: 'picanha-nobre', name: 'Picanha nobre', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 96.9 }], verified: false, source: SOURCE },
    { id: 'picanha-ao-alho', name: 'Picanha ao alho', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 97.9 }], verified: false, source: SOURCE },
    { id: 'picanha', name: 'Picanha', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 95.9 }], verified: false, source: SOURCE },
    { id: 'picanha-de-carneiro', name: 'Picanha de carneiro', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 97.9 }], verified: false, source: SOURCE },
    { id: 'picanha-suina', name: 'Picanha suína', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 67.9 }], verified: false, source: SOURCE },
    { id: 'alcatra', name: 'Alcatra', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 80.9 }], verified: false, source: SOURCE },
    { id: 'maminha', name: 'Maminha', categoryId: 'churrascaria', description: '500 g', prices: [{ value: 80.9 }], verified: false, source: SOURCE },
    { id: 'linguica-de-pernil', name: 'Linguiça de pernil', categoryId: 'churrascaria', description: '4 unidades', prices: [{ value: 25.9 }], verified: false, source: SOURCE },
    { id: 'tulipinha-de-frango', name: 'Tulipinha de frango', categoryId: 'churrascaria', description: '12 unidades', prices: [{ value: 32.9 }], verified: false, source: SOURCE },
    { id: 'coracao-de-frango', name: 'Coração de frango', categoryId: 'churrascaria', description: '25 unidades', prices: [{ value: 25.9 }], verified: false, source: SOURCE },

    // Queijos e pão de alho
    { id: 'queijo-cabacinha', name: 'Queijo cabacinha', categoryId: 'queijos-e-pao-de-alho', prices: [{ value: 25.9 }], verified: false, source: SOURCE },
    { id: 'queijo-coalho', name: 'Queijo coalho', categoryId: 'queijos-e-pao-de-alho', prices: [{ value: 25.9 }], verified: false, source: SOURCE },
    { id: 'pao-de-alho', name: 'Pão de alho', categoryId: 'queijos-e-pao-de-alho', description: '1 unidade', prices: [{ value: 7 }], verified: false, source: SOURCE },

    // Marmitas
    {
      id: 'marmita',
      name: 'Marmita',
      categoryId: 'marmitas',
      description: 'Arroz branco, feijão tropeiro ou feijão em caldo, batata frita ou maionese, banana frita e churrasco misto.',
      prices: [
        { label: 'Pequena', value: 20 },
        { label: 'Grande', value: 25 },
      ],
      verified: false,
      source: SOURCE,
    },

    // Guarnições
    { id: 'arroz-branco', name: 'Arroz branco', categoryId: 'guarnicoes', prices: [{ value: 16.9 }], verified: false, source: SOURCE },
    { id: 'arroz-a-piamontese', name: 'Arroz à piamontese', categoryId: 'guarnicoes', prices: [{ value: 16.9 }], verified: false, source: SOURCE },
    { id: 'aipim-frito', name: 'Aipim frito', categoryId: 'guarnicoes', prices: [{ value: 16.9 }], verified: false, source: SOURCE },
    { id: 'feijao-tropeiro', name: 'Feijão tropeiro', categoryId: 'guarnicoes', prices: [{ value: 25.9 }], verified: false, source: SOURCE },
    { id: 'feijao-em-caldo', name: 'Feijão em caldo', categoryId: 'guarnicoes', prices: [{ value: 13.9 }], verified: false, source: SOURCE },
    { id: 'salpicao', name: 'Salpicão', categoryId: 'guarnicoes', prices: [{ value: 25.9 }], verified: false, source: SOURCE },
    { id: 'salada-de-maionese', name: 'Salada de maionese', categoryId: 'guarnicoes', prices: [{ value: 19.9 }], verified: false, source: SOURCE },
    { id: 'salada-simples', name: 'Salada simples', categoryId: 'guarnicoes', prices: [{ value: 13.9 }], verified: false, source: SOURCE },
    { id: 'batata-frita', name: 'Batata frita', categoryId: 'guarnicoes', prices: [{ value: 19.9 }], verified: false, source: SOURCE },
    { id: 'farofa-a-brasileira', name: 'Farofa à brasileira', categoryId: 'guarnicoes', prices: [{ value: 19.9 }], verified: false, source: SOURCE },
    { id: 'banana-frita', name: 'Banana frita', categoryId: 'guarnicoes', prices: [{ value: 15.9 }], verified: false, source: SOURCE },
    { id: 'cebola-assada', name: 'Cebola assada', categoryId: 'guarnicoes', prices: [{ value: 6 }], verified: false, source: SOURCE },
    { id: 'ovo-frito', name: 'Ovo frito', categoryId: 'guarnicoes', prices: [{ value: 3 }], verified: false, source: SOURCE },
    { id: 'reposicao-farofa-vinagrete', name: 'Reposição de farofa ou vinagrete', categoryId: 'guarnicoes', description: 'Preço por reposição.', prices: [{ value: 3 }], verified: false, source: SOURCE },

    // Caldos — na foto só "Camarão" tem preço na linha; não está claro se R$ 19,90 vale para todos.
    { id: 'caldo-verde', name: 'Caldo verde', categoryId: 'caldos', prices: [{ value: null }], verified: false, source: SOURCE, note: 'Sem preço na foto.' },
    { id: 'caldo-de-feijao', name: 'Caldo de feijão', categoryId: 'caldos', prices: [{ value: null }], verified: false, source: SOURCE, note: 'Sem preço na foto.' },
    { id: 'caldo-gaucho', name: 'Caldo gaúcho', categoryId: 'caldos', prices: [{ value: null }], verified: false, source: SOURCE, note: 'Sem preço na foto.' },
    { id: 'caldo-pela-egua', name: 'Caldo Pêla Égua', categoryId: 'caldos', prices: [{ value: null }], verified: false, source: SOURCE, note: 'Sem preço na foto. Grafia do nome a confirmar.' },
    { id: 'caldo-de-tilapia', name: 'Caldo de tilápia', categoryId: 'caldos', prices: [{ value: null }], verified: false, source: SOURCE, note: 'Sem preço na foto.' },
    { id: 'caldo-vaca-atolada', name: 'Caldo vaca atolada', categoryId: 'caldos', prices: [{ value: null }], verified: false, source: SOURCE, note: 'Sem preço na foto.' },
    { id: 'caldo-de-camarao', name: 'Caldo de camarão', categoryId: 'caldos', prices: [{ value: 19.9 }], verified: false, source: SOURCE, note: 'Confirmar se R$ 19,90 é só do camarão ou de todos os caldos.' },
  ],
};
