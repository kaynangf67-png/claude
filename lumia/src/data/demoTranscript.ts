/**
 * Transcrições sincronizadas dos filmes de demonstração.
 *
 * A fonte de verdade são os arquivos WebVTT em /public/media/<id>/ (padrão
 * W3C de texto sincronizado). Este módulo só aponta para eles e define quais
 * faixas o pipeline usa como "diálogo" e como "sons".
 */
export const DEMO_TRANSCRIPTS: Record<string, { dialogue: string; sounds: string; lang: string }> = {
  'a-ligacao': {
    dialogue: '/media/a-ligacao/captions.pt-BR.vtt',
    sounds: '/media/a-ligacao/sounds.pt-BR.vtt',
    lang: 'pt-BR',
  },
  manifesto: {
    dialogue: '/media/manifesto/captions.pt-BR.vtt',
    sounds: '/media/manifesto/sounds.pt-BR.vtt',
    lang: 'pt-BR',
  },
};
