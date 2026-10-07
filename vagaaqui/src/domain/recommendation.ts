import { CITY_SPEED_MS, MISS_PENALTY_S, TURN_PENALTY_S, WALK_SPEED_MS } from '../config/constants';
import { dist } from '../lib/geo';
import type { ParkingSpot, Recommendation, SpotAssessment, Vec2 } from '../types';

/**
 * Escolhe a melhor vaga minimizando o TEMPO ESPERADO até estar estacionado e a pé no destino:
 *
 *   E[t] = tempo de direção + caminhada até o destino + (1 - P_ajustada) × custo de não achar
 *
 * P_ajustada desconta estimativas pouco confiáveis. Assim uma vaga a 400 m com 87% e
 * alta confiabilidade vence uma vaga a 80 m com 32% — o motorista não perde tempo à toa.
 */

export interface Candidate {
  spot: ParkingSpot;
  assessment: SpotAssessment;
  /** distância de direção pela malha viária (m) */
  driveDistance: number;
  /** conversões estimadas até a vaga */
  turns: number;
}

export interface RecommendOptions {
  destination?: Vec2 | null;
  /** vagas a ignorar (ex.: o usuário acabou de confirmar que estava ocupada) */
  exclude?: Set<string>;
  maxWalk?: number;
}

export function adjustedProbability(a: SpotAssessment) {
  // Com pouca confiabilidade, puxamos a estimativa em direção ao histórico.
  return a.probability * a.reliability + a.prior * (1 - a.reliability);
}

export function scoreCandidate(c: Candidate, destination?: Vec2 | null) {
  const etaSeconds = c.driveDistance / CITY_SPEED_MS + c.turns * TURN_PENALTY_S;
  const walkDistance = destination ? dist(c.spot.position, destination) : 0;
  const walkSeconds = walkDistance / WALK_SPEED_MS;
  const p = adjustedProbability(c.assessment);
  const expectedSeconds = etaSeconds + walkSeconds + (1 - p) * MISS_PENALTY_S;
  return { etaSeconds, walkDistance, expectedSeconds, adjusted: p };
}

export function recommend(candidates: Candidate[], options: RecommendOptions = {}): Recommendation[] {
  const maxWalk = options.maxWalk ?? 700;
  const pool = candidates.filter((c) => !options.exclude?.has(c.spot.id));
  const scored = pool
    .filter((c) => c.assessment.probability >= 0.15)
    .map((c) => ({ c, s: scoreCandidate(c, options.destination) }))
    .filter(({ s }) => s.walkDistance <= maxWalk)
    .sort((a, b) => a.s.expectedSeconds - b.s.expectedSeconds);

  if (!scored.length) return [];
  const nearestC = [...pool].sort((a, b) => a.driveDistance - b.driveDistance)[0];
  const nearest = { c: nearestC, s: scoreCandidate(nearestC, options.destination) };

  return scored.slice(0, 4).map(({ c, s }, index) => {
    const reasons: string[] = [];
    const pct = Math.round(c.assessment.probability * 100);
    if (c.assessment.probability >= 0.75) reasons.push(`${pct}% de chance — uma das maiores da região`);
    if (c.spot.type === 'lot') reasons.push('Vagas livres informadas ao vivo pelo estacionamento (pago)');
    else if (c.assessment.reliabilityLevel === 'alta') reasons.push('Confirmação recente de usuários');
    if (options.destination && s.walkDistance < 200) reasons.push(`${Math.round(s.walkDistance)} m a pé até o destino`);
    if (index === 0 && nearest.c.spot.id !== c.spot.id) {
      const np = Math.round(nearest.c.assessment.probability * 100);
      const saved = nearest.s.expectedSeconds - s.expectedSeconds;
      const savedText = saved < 60 ? `${Math.round(saved)} s` : `${(saved / 60).toFixed(1).replace('.', ',')} min`;
      reasons.push(
        `A vaga mais próxima (${Math.round(nearest.c.driveDistance)} m) tem só ${np}% de chance — esta economiza ~${savedText} em média`,
      );
    }
    if (!reasons.length) reasons.push('Melhor equilíbrio entre distância e chance');
    return {
      spotId: c.spot.id,
      probability: c.assessment.probability,
      reliabilityLevel: c.assessment.reliabilityLevel,
      driveDistance: c.driveDistance,
      etaSeconds: s.etaSeconds,
      walkDistance: s.walkDistance,
      expectedSeconds: s.expectedSeconds,
      reasons,
    };
  });
}
