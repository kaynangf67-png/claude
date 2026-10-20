/**
 * Fotos do site.
 *
 * Nenhuma foto da Dra. Sâmia ou do consultório foi fornecida ainda.
 * Enquanto um espaço estiver `null`, o site exibe um painel ilustrado
 * da marca (arco bordô com monograma), e não uma foto de banco de imagens:
 * uma foto genérica de "dentista" no topo do site seria lida pelos
 * visitantes como sendo a própria Dra. Sâmia.
 *
 * Para usar uma foto real:
 * 1. Salve o arquivo em src/assets/ (de preferência .webp, ~1600 px no lado maior).
 * 2. Importe aqui e preencha o espaço:
 *      import retrato from '../assets/dra-samia-retrato.webp';
 *      hero: { src: retrato, width: 1200, height: 1500, alt: 'Dra. Sâmia Lima no consultório' },
 */

export interface PhotoAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Para imagens de banco: crédito/licença. Fica visível como "Imagem ilustrativa". */
  stockCredit?: string;
}

export const photos = {
  /** Retrato ou foto do consultório no topo da página (vertical, ~4:5). */
  hero: null as PhotoAsset | null,
  /** Retrato da Dra. Sâmia na seção "Conheça" (vertical, ~4:5). */
  about: null as PhotoAsset | null,
  /** Fachada ou sala de atendimento na seção de contato (horizontal, ~3:2). */
  office: null as PhotoAsset | null,
};

export type PhotoKey = keyof typeof photos;
