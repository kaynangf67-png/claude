/** Tipos de domínio do VagaAqui. Compartilhados entre UI, simulação e futuros backends. */

export type Vec2 = { x: number; z: number };

export type ZoneId = 'centro' | 'comercial' | 'orla' | 'residencial';

/** Estado estimado de uma vaga. Nunca representa certeza. */
export type SpotStatus = 'likely_available' | 'uncertain' | 'likely_occupied' | 'stale';

export type ReliabilityLevel = 'alta' | 'media' | 'baixa';

/** Origem de uma observação. Cada fonte tem limitações diferentes (ver services/dataSources). */
export type ObservationSource =
  | 'crowd' // confirmação manual de um usuário
  | 'self' // confirmação do próprio usuário deste dispositivo
  | 'lot_api' // contagem informada por um estacionamento
  | 'sensor' // sensor de solo/IoT (não existe nos dados mock)
  | 'camera'; // visão computacional (não existe nos dados mock)

export type ReportKind = 'available' | 'occupied' | 'parked' | 'left';

export interface SpotReport {
  id: string;
  kind: ReportKind;
  source: ObservationSource;
  /** epoch ms */
  timestamp: number;
  /** 0..1 — quanto confiamos em quem reportou (histórico de precisão). */
  trust: number;
}

export interface ParkingSpot {
  id: string;
  latitude: number;
  longitude: number;
  /** posição no mundo 3D em metros (x leste, z sul) */
  position: Vec2;
  /** rotação em radianos (eixo Y) alinhada à rua */
  heading: number;
  edgeId: string;
  /** 0..1 ao longo da aresta da rua */
  t: number;
  streetName: string;
  zone: ZoneId;
  type: 'curb' | 'lot';
  lotId?: string;
  /** quantas vagas existem no mesmo trecho de rua (oferta local) */
  segmentCapacity: number;
  reports: SpotReport[];
}

export interface ParkingLot {
  id: string;
  name: string;
  position: Vec2;
  size: { w: number; d: number };
  capacity: number;
  /** vagas livres informadas pela API do estacionamento (null = sem integração) */
  reportedFree: number | null;
  reportedAt: number | null;
  pricePerHour: number;
  entrySpotId: string;
}

export interface ConfidenceFactor {
  key: string;
  label: string;
  detail: string;
  /** contribuição em log-odds (positivo aumenta chance de vaga livre) */
  impact: number;
}

export interface SpotAssessment {
  spotId: string;
  /** 0.03..0.95 — nunca 0 ou 1 */
  probability: number;
  /** 0..1 — o "Índice de Confiança da Vaga" */
  reliability: number;
  reliabilityLevel: ReliabilityLevel;
  status: SpotStatus;
  lastConfirmedAt: number | null;
  lastConfirmedKind: ReportKind | null;
  recentConfirmations: number;
  nearbyUsers: number;
  prior: number;
  factors: ConfidenceFactor[];
}

export interface PointOfInterest {
  id: string;
  name: string;
  category: 'shopping' | 'hospital' | 'praia' | 'universidade' | 'restaurante' | 'escritorio' | 'parque';
  position: Vec2;
}

export interface Destination {
  id: string;
  label: string;
  position: Vec2;
}

export interface RouteInstruction {
  /** distância (m) a partir do início da rota em que a manobra acontece */
  at: number;
  type: 'start' | 'left' | 'right' | 'straight' | 'arrive';
  text: string;
  street: string;
}

export interface RouteData {
  points: Vec2[];
  /** distância acumulada para cada ponto */
  cumulative: number[];
  length: number;
  instructions: RouteInstruction[];
}

export interface Recommendation {
  spotId: string;
  probability: number;
  reliabilityLevel: ReliabilityLevel;
  driveDistance: number;
  etaSeconds: number;
  walkDistance: number;
  expectedSeconds: number;
  reasons: string[];
}

export type LevelName = 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Diamante';

export interface UserProfile {
  name: string;
  points: number;
  confirmations: number;
  accurateConfirmations: number;
  parkedCount: number;
  history: RewardEvent[];
}

export type RewardAction = 'confirm_available' | 'confirm_occupied' | 'parked';

export interface RewardEvent {
  id: string;
  action: RewardAction;
  points: number;
  label: string;
  timestamp: number;
  spotId: string;
}
