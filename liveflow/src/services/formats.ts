import type { PostFormat } from '@/types/domain';

/** Formatos de vídeo curto em que você não precisa aparecer. */
export const POST_FORMATS: Record<PostFormat, { label: string; description: string; shots: string[] }> = {
  maos: {
    label: 'Mãos + demonstração',
    description: 'Câmera de cima ou de lado, só as mãos usando o produto.',
    shots: ['Plano de cima com o produto na mesa', 'Mãos ativando a função principal', 'Close no detalhe que resolve o problema'],
  },
  unboxing: {
    label: 'Unboxing',
    description: 'Abertura da embalagem em uma tomada, sem rosto.',
    shots: ['Caixa fechada em destaque', 'Abertura contínua, sem cortes', 'Produto montado e funcionando'],
  },
  antes_depois: {
    label: 'Antes e depois',
    description: 'Mostra o problema e o resultado com o produto.',
    shots: ['Cena "antes" mostrando o problema', 'Transição rápida (corte no movimento)', 'Mesmo enquadramento "depois"'],
  },
  comparativo: {
    label: 'Comparativo',
    description: 'Lado a lado com uma alternativa comum.',
    shots: ['Os dois itens lado a lado', 'Teste igual nos dois', 'Resultado do produto em destaque'],
  },
  pov_texto: {
    label: 'POV com texto na tela',
    description: 'Cenas do produto com a mensagem em legendas grandes.',
    shots: ['Cena do cotidiano com texto "POV: …"', 'Produto entrando em cena', 'Texto final com a oferta'],
  },
  narracao: {
    label: 'Narração em off',
    description: 'Sua voz explicando, imagem só do produto.',
    shots: ['Imagem do produto com narração do problema', 'Demonstração enquanto narra os benefícios', 'Fechamento com CTA narrado'],
  },
};

export const FORMAT_KEYS = Object.keys(POST_FORMATS) as PostFormat[];
