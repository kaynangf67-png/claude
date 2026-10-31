import cabelos from '../assets/cabelos-ondas-462.webp';
import ondas from '../assets/detalhe-ondas-680.webp';
import fios480 from '../assets/fios-detalhe-480.webp';
import fios725 from '../assets/fios-detalhe-725.webp';
import noiva from '../assets/hero-noiva-399.webp';
import make from '../assets/make-468.webp';
import tranca480 from '../assets/penteado-tranca-480.webp';
import tranca725 from '../assets/penteado-tranca-725.webp';

export interface Photo {
  src: string;
  srcSet?: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * Imagens editoriais/ilustrativas fornecidas no briefing (geradas, NÃO são
 * fotos de clientes). Não as apresente como trabalhos reais.
 * Para trocar por fotos autênticas, substitua os arquivos em src/assets/
 * mantendo os nomes, ou ajuste os imports acima.
 */
export const photos = {
  noiva: {
    src: noiva,
    width: 399,
    height: 614,
    alt: 'Noiva sorrindo com penteado preso e mechas soltas emoldurando o rosto, véu e buquê de rosas brancas',
  },
  tranca: {
    src: tranca725,
    srcSet: `${tranca480} 480w, ${tranca725} 725w`,
    width: 725,
    height: 967,
    alt: 'Penteado semipreso com trança lateral e ondas longas em tom castanho iluminado, visto de costas',
  },
  fios: {
    src: fios725,
    srcSet: `${fios480} 480w, ${fios725} 725w`,
    width: 725,
    height: 543,
    alt: 'Detalhe de fios castanhos com reflexos dourados em movimento, sob luz natural',
  },
  cabelos: {
    src: cabelos,
    width: 462,
    height: 390,
    alt: 'Mulher de olhos fechados tocando os cabelos longos e ondulados em tons de mel',
  },
  make: {
    src: make,
    width: 468,
    height: 390,
    alt: 'Aplicação de blush com pincel em maquiagem de tons suaves',
  },
  ondas: {
    src: ondas,
    width: 680,
    height: 229,
    alt: '',
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof photos;
