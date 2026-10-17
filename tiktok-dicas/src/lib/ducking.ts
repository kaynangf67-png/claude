import { interpolate } from "remotion";
import type { Palavra } from "../tipos";

const db = (valor: number) => Math.pow(10, valor / 20);

/** Trilha a -22dB enquanto há voz; sobe para -12dB nas pausas longas. */
const SOB_VOZ = db(-22);
const SEM_VOZ = db(-12);
/** Pausas menores que isso contam como fala contínua (não faz "bomba" entre palavras). */
const PONTE_S = 0.45;
/** Tempo que a trilha leva para subir/descer. */
const RAMPA_S = 0.35;

type Trecho = [number, number];

/** Junta as palavras em trechos de fala contínua. */
export const trechosDeFala = (palavras: Palavra[]): Trecho[] => {
  const trechos: Trecho[] = [];
  palavras.forEach((p) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && p.inicio - ultimo[1] <= PONTE_S) ultimo[1] = p.fim;
    else trechos.push([p.inicio, p.fim]);
  });
  return trechos;
};

/** Volume da trilha num instante (segundos), com ducking automático e fade-in/out. */
export const volumeTrilha = (t: number, trechos: Trecho[], duracao: number): number => {
  // distância (em s) até o trecho de fala mais próximo; 0 = alguém está falando
  let distancia = Infinity;
  for (const [ini, fim] of trechos) {
    if (t >= ini - RAMPA_S && t <= fim) {
      distancia = Math.max(0, ini - t);
      break;
    }
    distancia = Math.min(distancia, t < ini ? ini - t : t - fim);
  }
  const voz = interpolate(distancia, [0, RAMPA_S], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const base = SOB_VOZ * voz + SEM_VOZ * (1 - voz);
  const fade = interpolate(t, [0, 0.6, duracao - 1.2, duracao], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return base * fade;
};
