import type { AreaProfile, Segment } from './types';

/**
 * ESTIMATIVA INICIAL de ocupação (0..1) por hora do dia, sem dados reais.
 * Valores de partida razoáveis para centros urbanos brasileiros; devem ser
 * recalibrados com os relatos do piloto (ver README → Calibração).
 */
const WEEKDAY: Record<AreaProfile, number[]> = {
  //            0     1     2     3     4     5     6     7     8     9    10    11    12    13    14    15    16    17    18    19    20    21    22    23
  commercial: [0.35, 0.3, 0.3, 0.3, 0.3, 0.35, 0.45, 0.65, 0.85, 0.93, 0.95, 0.95, 0.93, 0.93, 0.95, 0.95, 0.93, 0.88, 0.75, 0.6, 0.5, 0.45, 0.4, 0.38],
  residential: [0.9, 0.9, 0.9, 0.9, 0.9, 0.88, 0.8, 0.68, 0.6, 0.58, 0.58, 0.6, 0.62, 0.6, 0.6, 0.62, 0.66, 0.74, 0.82, 0.87, 0.9, 0.9, 0.9, 0.9],
  mixed: [0.65, 0.6, 0.6, 0.6, 0.6, 0.62, 0.65, 0.72, 0.8, 0.85, 0.87, 0.88, 0.88, 0.87, 0.87, 0.87, 0.86, 0.85, 0.82, 0.8, 0.78, 0.74, 0.7, 0.68],
};
const WEEKEND: Record<AreaProfile, number[]> = {
  commercial: [0.4, 0.35, 0.3, 0.3, 0.3, 0.3, 0.32, 0.38, 0.5, 0.65, 0.78, 0.85, 0.88, 0.85, 0.8, 0.78, 0.75, 0.72, 0.7, 0.72, 0.75, 0.7, 0.6, 0.5],
  residential: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.88, 0.85, 0.8, 0.76, 0.74, 0.74, 0.74, 0.74, 0.75, 0.78, 0.8, 0.84, 0.86, 0.88, 0.9, 0.9, 0.9],
  mixed: [0.68, 0.64, 0.6, 0.6, 0.6, 0.6, 0.62, 0.66, 0.7, 0.75, 0.8, 0.83, 0.85, 0.84, 0.82, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.76, 0.72, 0.7],
};

/** Ocupação típica interpolada entre as horas cheias. */
export function typicalOccupancy(profile: AreaProfile, when: Date): number {
  const weekend = when.getDay() === 0 || when.getDay() === 6;
  const curve = (weekend ? WEEKEND : WEEKDAY)[profile];
  const h = when.getHours() + when.getMinutes() / 60;
  const i = Math.floor(h) % 24;
  const t = h - Math.floor(h);
  return curve[i] * (1 - t) + curve[(i + 1) % 24] * t;
}

/**
 * Chance de existir pelo menos 1 vaga livre no trecho só pelo histórico.
 * As vagas de um mesmo trecho não são independentes (todas enchem juntas no
 * horário de pico), por isso usamos capacidade^0,4 como nº "efetivo" de vagas
 * (32 vagas → 4). Conservador de propósito: sem dados, é melhor errar para menos.
 */
export function priorFree(segment: Segment, when: Date): number {
  const occ = typicalOccupancy(segment.profile, when);
  const nEff = Math.max(1, Math.pow(segment.capacity, 0.4));
  return 1 - Math.pow(occ, nEff);
}
