import type { ZoneId } from '../types';

/**
 * Perfil histórico de ocupação (0..1) por zona, hora e tipo de dia.
 * No MVP é uma tabela estimada; em produção vem do agregado de confirmações passadas
 * e de dados abertos de mobilidade da prefeitura, quando existirem.
 */
const WEEKDAY: Record<ZoneId, number[]> = {
  //          0     1     2     3     4     5     6     7     8     9    10    11    12    13    14    15    16    17    18    19    20    21    22    23
  centro:    [0.35, 0.3, 0.28, 0.27, 0.27, 0.3, 0.45, 0.7, 0.88, 0.93, 0.94, 0.93, 0.9, 0.92, 0.94, 0.93, 0.9, 0.86, 0.78, 0.65, 0.55, 0.48, 0.42, 0.38],
  comercial: [0.25, 0.2, 0.2, 0.2, 0.2, 0.22, 0.3, 0.45, 0.65, 0.78, 0.85, 0.88, 0.9, 0.88, 0.86, 0.87, 0.88, 0.9, 0.9, 0.86, 0.78, 0.62, 0.45, 0.32],
  orla:      [0.45, 0.4, 0.38, 0.36, 0.36, 0.4, 0.5, 0.58, 0.6, 0.62, 0.66, 0.7, 0.74, 0.72, 0.7, 0.72, 0.76, 0.8, 0.82, 0.84, 0.8, 0.72, 0.6, 0.5],
  residencial: [0.85, 0.87, 0.88, 0.88, 0.88, 0.86, 0.78, 0.62, 0.5, 0.45, 0.44, 0.46, 0.5, 0.48, 0.46, 0.48, 0.52, 0.6, 0.72, 0.8, 0.84, 0.86, 0.86, 0.86],
};

const WEEKEND: Record<ZoneId, number[]> = {
  centro:    [0.3, 0.26, 0.24, 0.22, 0.22, 0.22, 0.25, 0.3, 0.38, 0.48, 0.55, 0.6, 0.62, 0.6, 0.55, 0.52, 0.5, 0.48, 0.5, 0.52, 0.5, 0.45, 0.38, 0.32],
  comercial: [0.3, 0.25, 0.22, 0.2, 0.2, 0.2, 0.22, 0.28, 0.4, 0.6, 0.78, 0.88, 0.92, 0.93, 0.93, 0.92, 0.9, 0.88, 0.86, 0.84, 0.78, 0.65, 0.5, 0.38],
  orla:      [0.55, 0.5, 0.45, 0.42, 0.42, 0.45, 0.55, 0.7, 0.85, 0.92, 0.95, 0.95, 0.94, 0.93, 0.92, 0.9, 0.9, 0.9, 0.88, 0.85, 0.8, 0.75, 0.68, 0.6],
  residencial: [0.86, 0.88, 0.88, 0.88, 0.88, 0.88, 0.86, 0.82, 0.76, 0.7, 0.66, 0.64, 0.64, 0.66, 0.68, 0.7, 0.72, 0.76, 0.8, 0.84, 0.86, 0.86, 0.86, 0.86],
};

/** Quanto confiamos no histórico daquela zona (volume de dados acumulado). */
export const HISTORY_QUALITY: Record<ZoneId, number> = {
  centro: 0.8,
  comercial: 0.7,
  orla: 0.6,
  residencial: 0.45,
};

export function historicalOccupancy(zone: ZoneId, date: Date): number {
  const day = date.getDay();
  const table = day === 0 || day === 6 ? WEEKEND : WEEKDAY;
  const h = date.getHours() + date.getMinutes() / 60;
  const h0 = Math.floor(h) % 24;
  const h1 = (h0 + 1) % 24;
  const t = h - Math.floor(h);
  return table[zone][h0] * (1 - t) + table[zone][h1] * t;
}

export const ZONE_LABELS: Record<ZoneId, string> = {
  centro: 'Centro',
  comercial: 'Zona comercial',
  orla: 'Orla',
  residencial: 'Bairro residencial',
};

/** Permanência média (min) de um carro estacionado por zona. */
export const AVERAGE_STAY_MIN: Record<ZoneId, number> = {
  centro: 40,
  comercial: 60,
  orla: 90,
  residencial: 240,
};

/**
 * Modelo de Markov de dois estados (livre ⇄ ocupada) coerente com o histórico:
 *   λ_libera = 1 / permanência,  λ_ocupa = λ_libera · ocupação / (1 − ocupação)
 * A ocupação estacionária fica igual à do histórico e a "memória" de uma
 * observação decai com τ = 1 / (λ_ocupa + λ_libera).
 */
export function turnover(zone: ZoneId, date: Date) {
  const occupancy = Math.min(0.96, Math.max(0.04, historicalOccupancy(zone, date)));
  const leaveRate = 1 / (AVERAGE_STAY_MIN[zone] * 60);
  const occupyRate = (leaveRate * occupancy) / (1 - occupancy);
  return { occupancy, leaveRate, occupyRate, tau: 1 / (leaveRate + occupyRate) };
}
