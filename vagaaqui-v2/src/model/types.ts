import type { LonLat } from '../lib/geo';

/** Perfil de uso da área — define a curva de ocupação típica por horário. */
export type AreaProfile = 'commercial' | 'residential' | 'mixed';

/** Trecho de rua entre dois cruzamentos: a unidade de previsão do app. */
export interface Segment {
  id: string;
  name: string;
  line: LonLat[];
  mid: LonLat;
  lengthM: number;
  /** vagas estimadas no trecho (comprimento / 6 m × lados permitidos) */
  capacity: number;
  profile: AreaProfile;
  /** estacionar proibido (tag OSM) */
  noParking: boolean;
  /** área de Zona Azul / rotativo */
  paid: boolean;
}

/** Estacionamento fechado (plano B). */
export interface ParkingLot {
  id: string;
  name: string;
  pos: LonLat;
  fee: 'yes' | 'no' | 'unknown';
  capacity?: number;
}

/**
 * free   = "achei vaga" (chegou e encontrou)
 * full   = "estava lotado"
 * left   = "estou saindo da vaga" (libera uma vaga agora)
 * parked = estacionou (detecção automática) — ocupa uma vaga
 */
export type ReportKind = 'free' | 'full' | 'left' | 'parked';

export interface Report {
  id: string;
  segmentId: string;
  kind: ReportKind;
  /** epoch ms */
  at: number;
  /** 0..1 — relato manual 1.0, detecção automática ~0.6 */
  trust: number;
  /** relato gerado pela demonstração (nunca enviado ao servidor) */
  simulated?: boolean;
}

export type ChanceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface SegmentForecast {
  segment: Segment;
  /** probabilidade de existir ≥1 vaga livre na chegada (0.03..0.95) */
  p: number;
  low: number;
  high: number;
  /** 0..1 — quanto da estimativa vem de dados recentes (vs. histórico) */
  confidence: number;
  level: ChanceLevel;
  reportsUsed: number;
  newestReportAgeMin: number | null;
  simulatedShare: number;
  walkM: number;
  walkMin: number;
  /** minutos esperados até estar parado e a pé no destino (ver rank) */
  expectedMin: number;
}

export interface DestinationForecast {
  arriveAt: number;
  etaMin: number;
  /** chance de achar vaga em algum dos melhores trechos */
  overall: number;
  overallLow: number;
  overallHigh: number;
  level: ChanceLevel;
  best: SegmentForecast[];
  all: SegmentForecast[];
  sourcesText: string;
  dataIsEstimate: boolean;
}
