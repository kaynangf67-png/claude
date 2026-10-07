import { PROBABILITY_MAX, PROBABILITY_MIN } from '../config/constants';
import type {
  ConfidenceFactor,
  ParkingSpot,
  ReliabilityLevel,
  ReportKind,
  SpotAssessment,
  SpotStatus,
} from '../types';
import { HISTORY_QUALITY, historicalOccupancy, turnover } from './historical';

/**
 * Índice de Confiança da Vaga.
 *
 * Combina evidências em log-odds (um modelo bayesiano simples e explicável):
 *   logit(P(livre)) = logit(prior histórico) + Σ evidências com decaimento temporal
 *
 * Duas saídas diferentes, de propósito:
 *  - probability: a chance estimada de a vaga estar livre ao chegar.
 *  - reliability: quanto aquela estimativa é sustentada por dados recentes.
 * Uma vaga pode ter 60% com alta confiabilidade (muitos dados) ou 60% com baixa (só histórico).
 */

export interface ConfidenceContext {
  now: number;
  date: Date;
  /** usuários VagaAqui a até 150 m (observadores potenciais) */
  nearbyUsers: number;
  /** usuários lentos por perto: provavelmente também procurando vaga (concorrência) */
  cruisingNearby: number;
  /** veículos por minuto passando na região */
  flowPerMin: number;
  /** velocidade média (m/s) dos usuários próximos; null se não houver */
  avgNearbySpeed: number | null;
  /** em quantos segundos o motorista chegaria (a estimativa é para a chegada) */
  horizonS?: number;
  /** dados da API do estacionamento, quando a vaga é de um estacionamento */
  lot?: { capacity: number; reportedFree: number | null; reportedAt: number | null };
}

/**
 * Quanto uma confirmação de confiança total acerta (0.5 + span). "Estacionei aqui" e
 * "saí da vaga" vêm de quem está na própria vaga, então são mais confiáveis.
 */
export const ACCURACY_SPAN: Record<ReportKind, number> = {
  available: 0.45,
  occupied: 0.45,
  parked: 0.495,
  left: 0.49,
};

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const decay = (ageS: number, halfLife: number) => Math.pow(0.5, Math.max(0, ageS) / halfLife);

export function clampProbability(p: number) {
  return clamp(p, PROBABILITY_MIN, PROBABILITY_MAX);
}

export function reliabilityLevel(r: number): ReliabilityLevel {
  if (r >= 0.68) return 'alta';
  if (r >= 0.4) return 'media';
  return 'baixa';
}

export function statusFor(probability: number, reliability: number): SpotStatus {
  if (reliability < 0.3) return 'stale';
  if (probability >= 0.65) return 'likely_available';
  if (probability >= 0.35) return 'uncertain';
  return 'likely_occupied';
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export function assessSpot(spot: ParkingSpot, ctx: ConfidenceContext): SpotAssessment {
  const factors: ConfidenceFactor[] = [];
  const occupancy = historicalOccupancy(spot.zone, ctx.date);
  const prior = clamp(1 - occupancy, 0.04, 0.9);
  let x = logit(prior);
  const day = ctx.date.getDay();
  factors.push({
    key: 'history',
    label: 'Histórico da região',
    detail: `${Math.round(occupancy * 100)}% de ocupação típica ${day === 0 || day === 6 ? 'no fim de semana' : 'em dia útil'} às ${ctx.date.getHours()}h`,
    impact: 0,
  });

  // 1) Confirmações dos usuários: filtro bayesiano sobre uma cadeia de Markov livre⇄ocupada.
  //    Cada confirmação atualiza a crença; entre confirmações a crença volta ao histórico
  //    com a constante de tempo τ da zona (centro gira rápido, bairro residencial devagar).
  const { tau: rawTau } = turnover(spot.zone, ctx.date);
  const tau = clamp(rawTau, 90, 1800);
  const relax = (b: number, dtS: number) => prior + (b - prior) * Math.exp(-Math.max(0, dtS) / tau);
  let belief = prior;
  let beliefAt: number | null = null;
  let volume = 0;
  let recentConfirmations = 0;
  let last: { t: number; kind: ReportKind } | null = null;
  const reports = spot.reports
    .filter((r) => r.timestamp <= ctx.now && ctx.now - r.timestamp <= 3_600_000)
    .sort((a, b) => a.timestamp - b.timestamp);
  for (const r of reports) {
    const ageS = (ctx.now - r.timestamp) / 1000;
    if (beliefAt != null) belief = relax(belief, (r.timestamp - beliefAt) / 1000);
    const accuracy = 0.5 + ACCURACY_SPAN[r.kind] * r.trust;
    const seesFree = r.kind === 'available' || r.kind === 'left';
    const lFree = seesFree ? accuracy : 1 - accuracy;
    const lOcc = seesFree ? 1 - accuracy : accuracy;
    if (r.kind === 'parked' || r.kind === 'left') {
      // transições presenciadas ("estacionei", "saí da vaga") reiniciam o estado
      belief = seesFree ? accuracy : 1 - accuracy;
    } else {
      belief = (belief * lFree) / (belief * lFree + (1 - belief) * lOcc);
    }
    beliefAt = r.timestamp;
    volume += Math.pow(0.5, ageS / 600) * r.trust;
    if (ageS <= 600) recentConfirmations += 1;
    last = { t: r.timestamp, kind: r.kind };
  }
  // projeta a crença para o momento estimado de chegada
  if (beliefAt != null) belief = relax(belief, (ctx.now - beliefAt) / 1000 + (ctx.horizonS ?? 60));
  belief = clamp(belief, 0.01, 0.99);
  const reportImpact = logit(belief) - logit(prior);
  x += reportImpact;
  if (reports.length) {
    factors.push({
      key: 'reports',
      label: 'Confirmações de usuários',
      detail: `${plural(recentConfirmations, 'confirmação', 'confirmações')} nos últimos 10 min · memória de ~${Math.round(tau / 60)} min na região`,
      impact: reportImpact,
    });
  }

  // 2) Dados de estacionamento (API do estabelecimento).
  let lotFreshness = 0;
  if (ctx.lot && ctx.lot.reportedFree != null && ctx.lot.reportedAt != null) {
    const ageS = (ctx.now - ctx.lot.reportedAt) / 1000;
    lotFreshness = decay(ageS, 300);
    // P(ao menos uma vaga ao chegar) cresce com as vagas livres informadas
    const pLot = clamp(1 - Math.exp(-ctx.lot.reportedFree / 3), 0.04, 0.97);
    const impact = (logit(pLot) - logit(prior)) * lotFreshness;
    x += impact;
    factors.push({
      key: 'lot',
      label: 'Dados do estacionamento',
      detail: `${ctx.lot.reportedFree} de ${ctx.lot.capacity} vagas livres informadas`,
      impact,
    });
  }

  // 3) Oferta: trechos com mais vagas compensam a perda desta vaga específica.
  const capacity = ctx.lot ? ctx.lot.capacity : spot.segmentCapacity;
  const supply = clamp(0.25 * Math.log(capacity / 10), -0.3, 0.6) * (ctx.lot ? 0.3 : 1);
  if (Math.abs(supply) > 0.01) {
    x += supply;
    factors.push({
      key: 'supply',
      label: 'Quantidade de vagas no trecho',
      detail: `${capacity} vagas ${ctx.lot ? 'no estacionamento' : 'neste lado da quadra'}`,
      impact: supply,
    });
  }

  // 4) Concorrência: usuários lentos por perto provavelmente também procuram vaga.
  const competition = -Math.min(1.2, ctx.cruisingNearby * 0.35);
  if (ctx.cruisingNearby > 0) {
    x += competition;
    factors.push({
      key: 'competition',
      label: 'Motoristas procurando vaga',
      detail: `${plural(ctx.cruisingNearby, 'veículo lento', 'veículos lentos')} na região${
        ctx.avgNearbySpeed != null ? ` (média ${Math.round(ctx.avgNearbySpeed * 3.6)} km/h)` : ''
      }`,
      impact: competition,
    });
  }

  // 5) Fluxo de veículos: muito trânsito aumenta a rotatividade e a disputa.
  const flowImpact = clamp(-(ctx.flowPerMin - 6) * 0.05, -0.4, 0.15);
  x += flowImpact;
  factors.push({
    key: 'flow',
    label: 'Fluxo de veículos',
    detail: `${Math.round(ctx.flowPerMin)} veículos/min`,
    impact: flowImpact,
  });

  const probability = clampProbability(sigmoid(x));

  // Índice de confiabilidade: frescor + volume + histórico + observadores por perto.
  const lastAgeS = last ? (ctx.now - last.t) / 1000 : Infinity;
  const freshness = Math.max(last ? decay(lastAgeS, 240) : 0, lotFreshness);
  const vol = Math.max(1 - Math.exp(-volume), lotFreshness * 0.8);
  const observers = Math.min(0.2, ctx.nearbyUsers * 0.07);
  const reliability = clamp(0.45 * freshness + 0.25 * vol + 0.15 * HISTORY_QUALITY[spot.zone] + observers, 0, 1);
  if (ctx.nearbyUsers > 0) {
    factors.push({
      key: 'observers',
      label: 'Usuários próximos',
      detail: `${plural(ctx.nearbyUsers, 'usuário', 'usuários')} a até 150 m podem confirmar`,
      impact: 0,
    });
  }

  return {
    spotId: spot.id,
    probability,
    reliability,
    reliabilityLevel: reliabilityLevel(reliability),
    status: statusFor(probability, reliability),
    lastConfirmedAt: last ? last.t : ctx.lot?.reportedAt ?? null,
    lastConfirmedKind: last ? last.kind : null,
    recentConfirmations,
    nearbyUsers: ctx.nearbyUsers,
    prior,
    factors,
  };
}

export const RELIABILITY_LABEL: Record<ReliabilityLevel, string> = {
  alta: 'Alta confiabilidade',
  media: 'Confiabilidade média',
  baixa: 'Baixa confiabilidade',
};
