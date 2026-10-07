import type { ObservationSource, ReportKind } from '../../types';

/**
 * Contrato comum para qualquer fonte de dados que alimente o Índice de Confiança.
 *
 * Regra do produto: nenhuma fonte "garante" uma vaga. Cada fonte declara o que
 * consegue observar de verdade (`capabilities`) e o Índice combina tudo como evidência.
 */
export interface Observation {
  /** vaga específica, quando a fonte consegue identificá-la */
  spotId?: string;
  /** região/trecho, quando a fonte só enxerga o agregado */
  zoneId?: string;
  kind: ReportKind | 'lot_count' | 'traffic_flow';
  source: ObservationSource | 'traffic' | 'gps';
  value?: number;
  /** 0..1 — confiabilidade intrínseca desta observação */
  confidence: number;
  timestamp: number;
}

export interface SourceCapabilities {
  /** identifica uma vaga individual livre/ocupada? */
  perSpotOccupancy: boolean;
  /** informa contagem agregada (ex.: estacionamento com cancela) */
  aggregateCount: boolean;
  /** informa fluxo/velocidade de veículos */
  trafficFlow: boolean;
  /** latência típica até o dado chegar (s) */
  typicalLatencyS: number;
}

export interface ParkingDataSource {
  id: string;
  name: string;
  /** o que esta fonte realmente consegue — e o que não consegue */
  capabilities: SourceCapabilities;
  limitations: string;
  enabled: boolean;
  start(emit: (o: Observation) => void): void;
  stop(): void;
}
