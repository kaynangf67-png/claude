/**
 * Catálogo de DEMONSTRAÇÃO.
 *
 * - "A Ligação" e "Manifesto LUMIA" são produções originais geradas por
 *   computador para este protótipo (scripts/generate_media.py). Podem ser
 *   assistidas e interpretadas.
 * - Todos os outros títulos são FICTÍCIOS: nomes, sinopses, elencos e pôsteres
 *   foram inventados para mostrar como o catálogo global vai se comportar.
 *   Eles não têm vídeo e aparecem como "em licenciamento".
 *
 * Nenhum filme comercial é distribuído aqui.
 */
import type { CatalogItem, ContentKind, SignLanguageAvailability } from '@/types/content';

const FICTIONAL_LICENSE = {
  type: 'FICTIONAL_DEMO' as const,
  holder: 'Título fictício (demonstração)',
  territories: [],
  allowsSignLanguageOverlay: true,
  notes: 'Título inventado para demonstrar o catálogo. Não existe obra real associada.',
};

const LIBRAS_PLANNED: SignLanguageAvailability[] = [{ language: 'pt-BR-LIBRAS', status: 'PLANNED', source: 'none' }];

type Fictional = Pick<CatalogItem, 'slug' | 'kind' | 'title' | 'tagline' | 'synopsis' | 'year' | 'durationMin' | 'maturity' | 'genres' | 'country' | 'originalLanguage' | 'cast' | 'director' | 'accent' | 'tags'> &
  Partial<CatalogItem>;

function fictional(f: Fictional): CatalogItem {
  return {
    id: f.slug,
    audioLanguages: [f.originalLanguage],
    subtitleLanguages: ['pt-BR', 'en'],
    poster: `/posters/${f.slug}.webp`,
    backdrop: `/posters/${f.slug}-backdrop.webp`,
    textTracks: [],
    audioTracks: [{ id: 'orig', lang: f.originalLanguage, label: 'Original', kind: 'original', available: false }],
    signLanguages: LIBRAS_PLANNED,
    availability: 'LICENSING',
    regions: [],
    license: FICTIONAL_LICENSE,
    access: 'PREMIUM',
    fictional: true,
    accessibility: { captions: true, soundDescriptions: true, emotionalContext: true, audioDescription: 'planned' },
    ...f,
  };
}

function episodes(n: number, titles: string[], dur: number) {
  return [{ number: 1, episodes: titles.slice(0, n).map((title, i) => ({ number: i + 1, title, durationMin: dur, synopsis: 'Episódio fictício para demonstração do catálogo.' })) }];
}

export const DEMO_FLAGSHIP_ID = 'a-ligacao';

export const MOVIES: CatalogItem[] = [
  {
    id: 'a-ligacao',
    slug: 'a-ligacao',
    kind: 'short',
    title: 'A Ligação',
    tagline: 'Uma chamada desconhecida. Uma porta que não deveria bater.',
    synopsis:
      'Marina chega em casa numa noite de chuva. A porta bate atrás dela, o telefone toca com um número desconhecido — e a voz do outro lado muda tudo. Curta original da LUMIA criado para demonstrar como a IA interpreta imagem, diálogo, sons e emoção em Libras.',
    year: 2026,
    durationMin: 1,
    maturity: '12',
    genres: ['Suspense', 'Drama'],
    country: 'BR',
    originalLanguage: 'pt-BR',
    audioLanguages: ['pt-BR'],
    subtitleLanguages: ['pt-BR', 'en'],
    cast: ['Marina (personagem animada)', 'Daniel (voz ao telefone)'],
    director: 'Estúdio LUMIA (gerado por computador)',
    poster: '/media/a-ligacao/poster.webp',
    backdrop: '/media/a-ligacao/backdrop.webp',
    accent: '#7aa2ff',
    trailer: '#t=4,19', // prévia = trecho do próprio filme (Media Fragments)
    video: {
      durationSec: 53,
      renditions: [
        { id: '720p', label: '720p HD', height: 720, src: '/media/a-ligacao/a-ligacao-720p.mp4', webm: '/media/a-ligacao/a-ligacao-720p.webm', bitrateKbps: 1400 },
        { id: '360p', label: '360p', height: 360, src: '/media/a-ligacao/a-ligacao-360p.mp4', webm: '/media/a-ligacao/a-ligacao-360p.webm', bitrateKbps: 450 },
      ],
    },
    textTracks: [
      { id: 'cc-pt', kind: 'captions', lang: 'pt-BR', label: 'Português (CC)', src: '/media/a-ligacao/captions.pt-BR.vtt', format: 'webvtt' },
      { id: 'sub-en', kind: 'subtitles', lang: 'en', label: 'English', src: '/media/a-ligacao/captions.en.vtt', format: 'webvtt' },
      { id: 'snd-pt', kind: 'sounds', lang: 'pt-BR', label: 'Sons importantes', src: '/media/a-ligacao/sounds.pt-BR.vtt', format: 'webvtt' },
    ],
    audioTracks: [
      { id: 'orig', lang: 'pt-BR', label: 'Original — trilha, efeitos e vozes', kind: 'original', available: true },
      { id: 'ad', lang: 'pt-BR', label: 'Audiodescrição', kind: 'audio-description', available: false },
    ],
    signLanguages: [
      { language: 'pt-BR-LIBRAS', status: 'REVIEW_REQUIRED', source: 'pre-processed', interpretationId: 'a-ligacao.pt-BR-LIBRAS.v1' },
      { language: 'en-US-ASL', status: 'PLANNED', source: 'none' },
      { language: 'en-GB-BSL', status: 'NOT_AVAILABLE', source: 'none' },
    ],
    availability: 'AVAILABLE',
    regions: ['WORLD'],
    license: {
      type: 'LUMIA_ORIGINAL',
      holder: 'LUMIA (produção própria)',
      territories: ['WORLD'],
      allowsSignLanguageOverlay: true,
      notes: 'Imagem e som gerados por computador para o protótipo. Sem atores reais.',
    },
    access: 'FREE',
    tags: ['new', 'original', 'demo-flagship', 'recommended', 'popular'],
    fictional: false,
    accessibility: { captions: true, soundDescriptions: true, emotionalContext: true, audioDescription: 'planned' },
  },
  {
    id: 'manifesto',
    slug: 'manifesto',
    kind: 'short',
    title: 'Manifesto LUMIA',
    tagline: 'Cinema para todos.',
    synopsis: 'Um filme curto sobre o porquê da LUMIA existir: não basta traduzir o que é dito — é preciso ajudar todos a viver a história.',
    year: 2026,
    durationMin: 1,
    maturity: 'L',
    genres: ['Institucional'],
    country: 'BR',
    originalLanguage: 'pt-BR',
    audioLanguages: ['pt-BR'],
    subtitleLanguages: ['pt-BR', 'en'],
    cast: ['Narração'],
    director: 'Estúdio LUMIA',
    poster: '/media/manifesto/poster.webp',
    backdrop: '/media/manifesto/backdrop.webp',
    accent: '#ffb86b',
    video: {
      durationSec: 18,
      renditions: [
        { id: '720p', label: '720p HD', height: 720, src: '/media/manifesto/manifesto-720p.mp4', webm: '/media/manifesto/manifesto-720p.webm', bitrateKbps: 900 },
        { id: '360p', label: '360p', height: 360, src: '/media/manifesto/manifesto-360p.mp4', webm: '/media/manifesto/manifesto-360p.webm', bitrateKbps: 300 },
      ],
    },
    textTracks: [
      { id: 'cc-pt', kind: 'captions', lang: 'pt-BR', label: 'Português (CC)', src: '/media/manifesto/captions.pt-BR.vtt', format: 'webvtt' },
      { id: 'sub-en', kind: 'subtitles', lang: 'en', label: 'English', src: '/media/manifesto/captions.en.vtt', format: 'webvtt' },
      { id: 'snd-pt', kind: 'sounds', lang: 'pt-BR', label: 'Sons importantes', src: '/media/manifesto/sounds.pt-BR.vtt', format: 'webvtt' },
    ],
    audioTracks: [{ id: 'orig', lang: 'pt-BR', label: 'Original', kind: 'original', available: true }],
    signLanguages: [{ language: 'pt-BR-LIBRAS', status: 'REVIEW_REQUIRED', source: 'pre-processed', interpretationId: 'manifesto.pt-BR-LIBRAS.v1' }],
    availability: 'AVAILABLE',
    regions: ['WORLD'],
    license: { type: 'LUMIA_ORIGINAL', holder: 'LUMIA (produção própria)', territories: ['WORLD'], allowsSignLanguageOverlay: true },
    access: 'FREE',
    tags: ['original', 'new'],
    fictional: false,
    accessibility: { captions: true, soundDescriptions: true, emotionalContext: true, audioDescription: 'none' },
  },
  fictional({
    slug: 'mare-baixa', kind: 'movie', title: 'Maré Baixa', tagline: 'Quando o mar recua, os segredos aparecem.',
    synopsis: 'Numa vila de pescadores do litoral nordestino, uma surda volta para casa depois de dez anos e encontra a família dividida pela venda da praia.',
    year: 2025, durationMin: 112, maturity: '14', genres: ['Drama'], country: 'BR', originalLanguage: 'pt-BR',
    cast: ['Ana Ribeiro*', 'João Matos*', 'Clara Nunes Lima*'], director: 'Helena Prado*', accent: '#e7a46b', tags: ['popular', 'recommended'],
  }),
  fictional({
    slug: 'chuva-em-shinjuku', kind: 'movie', title: 'Chuva em Shinjuku', originalTitle: '新宿の雨', tagline: 'Uma cidade inteira. Uma única testemunha.',
    synopsis: 'Uma tradutora de língua de sinais japonesa é a única a entender o que uma testemunha surda viu na noite de um crime.',
    year: 2024, durationMin: 118, maturity: '16', genres: ['Suspense', 'Policial'], country: 'JP', originalLanguage: 'ja',
    cast: ['Aiko Tanabe*', 'Ren Oshiro*'], director: 'Kenji Morita*', accent: '#ff4f8b', tags: ['popular'],
  }),
  fictional({
    slug: 'o-ultimo-farol', kind: 'movie', title: 'O Último Farol', tagline: 'Alguém precisa manter a luz acesa.',
    synopsis: 'O último faroleiro de uma ilha portuguesa recebe uma visitante que não deveria estar ali.',
    year: 2023, durationMin: 98, maturity: '12', genres: ['Aventura', 'Drama'], country: 'PT', originalLanguage: 'pt-PT',
    cast: ['Rui Alvarenga*', 'Inês Moura*'], director: 'Tomás Valente*', accent: '#ffd27a', tags: ['recommended'],
  }),
  fictional({
    slug: 'horizonte-de-vidro', kind: 'movie', title: 'Horizonte de Vidro', originalTitle: 'Glass Horizon', tagline: 'O futuro tem um limite. Ela quer atravessá-lo.',
    synopsis: 'Em 2091, uma engenheira descobre que a cúpula que protege a cidade esconde um céu completamente diferente.',
    year: 2026, durationMin: 131, maturity: '12', genres: ['Ficção científica'], country: 'US', originalLanguage: 'en',
    cast: ['Maya Collins*', 'Theo Grant*'], director: 'Sam Okafor*', accent: '#6fe3ff', tags: ['new', 'popular'],
  }),
  fictional({
    slug: 'sal-e-silencio', kind: 'movie', title: 'Sal e Silêncio', originalTitle: 'Sal y Silencio', tagline: 'Algumas histórias não precisam de som.',
    synopsis: 'Duas irmãs — uma ouvinte, outra surda — atravessam o deserto de Almería para cumprir o último pedido da mãe.',
    year: 2025, durationMin: 104, maturity: '12', genres: ['Drama', 'Road movie'], country: 'ES', originalLanguage: 'es',
    cast: ['Lucía Ferrer*', 'Paula Ortiz*'], director: 'Marta Solano*', accent: '#f2d1a8', tags: ['recommended'],
  }),
  fictional({
    slug: 'linha-de-fuga', kind: 'movie', title: 'Linha de Fuga', originalTitle: 'Ligne de Fuite', tagline: 'Paris tem 37 pontes. Ela precisa de uma.',
    synopsis: 'Uma ex-agente tem uma noite para atravessar Paris com um segredo que ninguém pode ouvir.',
    year: 2026, durationMin: 109, maturity: '16', genres: ['Ação', 'Suspense'], country: 'FR', originalLanguage: 'fr',
    cast: ['Camille Durand*', 'Hugo Lefèvre*'], director: 'Antoine Mercier*', accent: '#ff6a3d', tags: ['new'],
  }),
  fictional({
    slug: 'a-menina-que-desenhava-sons', kind: 'movie', title: 'A Menina que Desenhava Sons', tagline: 'Ela não ouvia a música. Ela a via.',
    synopsis: 'Uma menina surda transforma as vibrações da cidade em desenhos que começam, misteriosamente, a ganhar vida.',
    year: 2024, durationMin: 88, maturity: 'L', genres: ['Família', 'Animação'], country: 'BR', originalLanguage: 'pt-BR',
    cast: ['Vozes do elenco*'], director: 'Lia Okamoto*', accent: '#ffcf5c', tags: ['recommended', 'popular'],
  }),
  fictional({
    slug: 'noite-de-estreia', kind: 'movie', title: 'Noite de Estreia', originalTitle: 'Opening Night', tagline: 'A cortina sobe às oito. O plano, às sete.',
    synopsis: 'Uma comédia de golpe nos bastidores de um teatro de Londres, onde a única que percebe tudo é a intérprete de BSL do espetáculo.',
    year: 2025, durationMin: 101, maturity: '12', genres: ['Comédia', 'Policial'], country: 'GB', originalLanguage: 'en',
    cast: ['Olivia Hart*', 'James Whitmore*'], director: 'Priya Shah*', accent: '#ff7aa8', tags: ['new'],
  }),
  fictional({
    slug: 'rua-das-maos', kind: 'series', title: 'Rua das Mãos', tagline: 'Uma rua. Uma comunidade. Mil conversas.',
    synopsis: 'Série sobre os moradores de uma rua de São Paulo onde metade dos vizinhos é surda — e todo mundo sabe da vida de todo mundo.',
    year: 2026, durationMin: 42, maturity: '12', genres: ['Comédia', 'Drama'], country: 'BR', originalLanguage: 'pt-BR',
    cast: ['Bruno Sato*', 'Jéssica Andrade*', 'Seu Tonho*'], director: 'Rafaela Cruz*', accent: '#ff9f5a', tags: ['new', 'popular', 'recommended'],
    seasons: episodes(6, ['A mudança', 'O síndico', 'Festa junina', 'O apagão', 'Vizinho novo', 'Final de ano'], 42),
  }),
  fictional({
    slug: 'distrito-azul', kind: 'series', title: 'Distrito Azul', originalTitle: '푸른 구역', tagline: 'Seul nunca dorme. Nem os segredos dela.',
    synopsis: 'Uma detetive coreana e um hacker surdo investigam desaparecimentos num bairro que não aparece nos mapas.',
    year: 2025, durationMin: 58, maturity: '16', genres: ['Policial', 'Suspense'], country: 'KR', originalLanguage: 'ko',
    cast: ['Kim Seo-yeon*', 'Park Ji-ho*'], director: 'Lee Min-jae*', accent: '#4fa8ff', tags: ['popular'],
    seasons: episodes(8, ['Sinal', 'Ruído', 'Eco', 'Estática', 'Frequência', 'Interferência', 'Silêncio', 'Retorno'], 58),
  }),
  fictional({
    slug: 'frequencia', kind: 'series', title: 'Frequência', originalTitle: 'Frequency', tagline: 'Ouvir não é o mesmo que entender.',
    synopsis: 'No interior da Escócia, uma estação de rádio começa a captar mensagens de 1987 — e só uma pessoa surda percebe o padrão.',
    year: 2024, durationMin: 50, maturity: '14', genres: ['Ficção científica', 'Mistério'], country: 'GB', originalLanguage: 'en',
    cast: ['Fiona McLeod*', 'Arthur Bell*'], director: 'Callum Reid*', accent: '#b18cff', tags: ['recommended'],
    seasons: episodes(6, ['Ondas', 'Portadora', 'Harmônica', 'Fase', 'Ressonância', 'Zero'], 50),
  }),
  fictional({
    slug: 'vale-do-vento', kind: 'series', title: 'Vale do Vento', tagline: 'A terra fala com quem sabe ver.',
    synopsis: 'Uma família de agricultores do sul do Brasil enfrenta a seca e uma herança inesperada.',
    year: 2023, durationMin: 46, maturity: '12', genres: ['Drama'], country: 'BR', originalLanguage: 'pt-BR',
    cast: ['Helena Weiss*', 'Otávio Klein*'], director: 'Marcos Bauer*', accent: '#9be38a', tags: [],
    seasons: episodes(5, ['A seca', 'O testamento', 'A colheita', 'O temporal', 'O vale'], 46),
  }),
  fictional({
    slug: 'maos-que-contam-historias', kind: 'documentary', title: 'Mãos que Contam Histórias', tagline: 'A história da Libras contada por quem a vive.',
    synopsis: 'Documentário fictício de demonstração sobre artistas, professores e contadores de histórias surdos no Brasil.',
    year: 2026, durationMin: 76, maturity: 'L', genres: ['Documentário', 'Cultura surda'], country: 'BR', originalLanguage: 'pt-BR',
    cast: ['Depoimentos*'], director: 'Coletivo Sinal*', accent: '#ffc38a', tags: ['new', 'recommended'],
  }),
  fictional({
    slug: 'oceano-interior', kind: 'documentary', title: 'Oceano Interior', originalTitle: 'Océan Intérieur', tagline: 'O som que os peixes não ouvem.',
    synopsis: 'Uma jornada pelos mares do Atlântico Norte mostrando como os animais se comunicam por vibração e luz.',
    year: 2024, durationMin: 89, maturity: 'L', genres: ['Documentário', 'Natureza'], country: 'FR', originalLanguage: 'fr',
    cast: ['Narração*'], director: 'Élise Marchand*', accent: '#5fe0c8', tags: ['popular'],
  }),
  fictional({
    slug: 'cidades-que-escutam', kind: 'documentary', title: 'Cidades que Escutam', originalTitle: 'Cities That Listen', tagline: 'Como seria uma cidade feita para todos?',
    synopsis: 'De Tóquio a Bogotá, arquitetos e comunidades surdas redesenham o espaço urbano.',
    year: 2025, durationMin: 82, maturity: 'L', genres: ['Documentário', 'Sociedade'], country: 'US', originalLanguage: 'en',
    cast: ['Depoimentos*'], director: 'Nora Feld*', accent: '#ffd166', tags: ['recommended'],
  }),
  fictional({
    slug: 'a-luz-do-sertao', kind: 'documentary', title: 'A Luz do Sertão', tagline: 'Onde o sol é personagem.',
    synopsis: 'Cinema itinerante leva sessões acessíveis a cidades do sertão que nunca tiveram uma sala de cinema.',
    year: 2023, durationMin: 71, maturity: 'L', genres: ['Documentário', 'Cultura'], country: 'BR', originalLanguage: 'pt-BR',
    cast: ['Depoimentos*'], director: 'Iara Cordeiro*', accent: '#ffb347', tags: ['popular'],
  }),
];

export const KIND_ROUTES: Record<ContentKind, string> = {
  movie: '/filmes',
  series: '/series',
  documentary: '/documentarios',
  short: '/filmes',
};
