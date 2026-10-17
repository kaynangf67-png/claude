import { loadFont } from "@remotion/fonts";
import sora400 from "@fontsource/sora/files/sora-latin-400-normal.woff2";
import sora600 from "@fontsource/sora/files/sora-latin-600-normal.woff2";
import sora800 from "@fontsource/sora/files/sora-latin-800-normal.woff2";

// Fonte empacotada no projeto (não depende de internet na hora de renderizar).
[
  [sora400, "400"],
  [sora600, "600"],
  [sora800, "800"],
].forEach(([url, weight]) => loadFont({ family: "Sora", url, weight }));

export const FONTE = "Sora, sans-serif";

export const LARGURA = 1080;
export const ALTURA = 1920;
export const FPS = 30;

/** Área segura do TikTok: nada importante fora dela. */
export const SEGURA = {
  topo: 120,
  base: 150,
  direita: 150,
  esquerda: 70,
} as const;

/** Faixa reservada para as legendas (dentro da área segura). Conteúdo das cenas fica acima dela. */
export const LEGENDA = { topo: 1400, base: ALTURA - SEGURA.base - 50 } as const;

/**
 * Caixa do conteúdo das cenas. Tem folga extra porque o zoom lento da câmera (até 7%)
 * empurra as bordas para fora; assim nada invade a área de risco.
 */
export const CONTEUDO = {
  topo: SEGURA.topo + 70,
  base: LEGENDA.topo - 50,
  esquerda: SEGURA.esquerda + 20,
  direita: SEGURA.direita + 30,
} as const;

const DESTAQUES: Record<string, string> = {
  limao: "#C8FF3D",
  dourado: "#E9B949",
};

export const corDestaque = (cor?: string) => (cor && (DESTAQUES[cor] ?? cor)) || DESTAQUES.limao;

export const CORES = {
  fundo: "#09090A",
  texto: "#F4F4F2",
  suave: "#9A9A96",
  linha: "rgba(255,255,255,0.10)",
  erro: "#FF3B3B",
} as const;
