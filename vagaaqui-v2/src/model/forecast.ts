import { distance, type LonLat } from '../lib/geo';
import { priorFree } from './prior';
import type { ChanceLevel, DestinationForecast, Report, ReportKind, Segment, SegmentForecast } from './types';

export const MODEL = {
  /** limites: nunca "garantido", nunca "impossível" */
  minP: 0.03,
  maxP: 0.95,
  /** o que cada relato diz sobre "ter ≥1 vaga livre" no momento do relato */
  observed: { free: 0.8, left: 0.9, full: 0.08, parked: 0.35 } as Record<ReportKind, number>,
  /** meia-vida do valor de um relato (min): vaga liberada some rápido; lotação dura mais */
  halfLifeMin: { free: 12, left: 6, full: 15, parked: 20 } as Record<ReportKind, number>,
  /** peso do histórico frente aos relatos (equivale a "1 relato fresco") */
  priorWeight: 1,
  /** minutos perdidos rodando quando o trecho não tem vaga */
  missPenaltyMin: 8,
  /** passos por minuto a pé (≈ 4,5 km/h) */
  walkMPerMin: 75,
  /** caminhada real ≈ 1,3 × linha reta em malha urbana */
  walkDetour: 1.3,
  /** relatos mais velhos que isto (em relação à chegada) são ignorados */
  maxAgeMin: 90,
};

const clamp = (p: number) => Math.min(MODEL.maxP, Math.max(MODEL.minP, p));

export function levelOf(p: number, confidence: number): ChanceLevel {
  if (confidence < 0.05 && p < 0.2) return 'unknown';
  if (p >= 0.6) return 'high';
  if (p >= 0.3) return 'medium';
  return 'low';
}

/**
 * Estimativa de um trecho no instante de chegada.
 * Média ponderada entre o histórico do horário e os relatos, cada relato com peso
 * trust × 0,5^(idade na chegada / meia-vida). Simples, explicável e testável.
 */
export function estimateSegment(segment: Segment, reports: Report[], arriveAt: number) {
  const prior = segment.noParking ? 0 : priorFree(segment, new Date(arriveAt));
  let wSum = MODEL.priorWeight;
  let acc = prior * MODEL.priorWeight;
  let used = 0;
  let newest: number | null = null;
  let simW = 0;
  for (const r of reports) {
    if (r.segmentId !== segment.id) continue;
    const ageMin = (arriveAt - r.at) / 60000;
    if (ageMin < -1 || ageMin > MODEL.maxAgeMin) continue;
    const w = r.trust * Math.pow(0.5, Math.max(0, ageMin) / MODEL.halfLifeMin[r.kind]);
    if (w < 0.01) continue;
    acc += w * MODEL.observed[r.kind];
    wSum += w;
    used++;
    if (r.simulated) simW += w;
    if (newest === null || r.at > newest) newest = r.at;
  }
  const raw = segment.noParking ? 0 : acc / wSum;
  const p = clamp(raw);
  const confidence = (wSum - MODEL.priorWeight) / wSum;
  // faixa: larga quando só há histórico, estreita com relatos frescos
  const half = 0.06 + (1 - confidence) * 0.22;
  return {
    p,
    low: clamp(p - half),
    high: clamp(p + half),
    confidence,
    reportsUsed: used,
    newestAt: newest,
    simulatedShare: wSum > MODEL.priorWeight ? simW / (wSum - MODEL.priorWeight) : 0,
  };
}

export interface ForecastInput {
  segments: Segment[];
  reports: Report[];
  destination: LonLat;
  now: number;
  etaMin: number;
  radiusM: number;
}

export function walkMinutes(m: number) {
  return (m * MODEL.walkDetour) / MODEL.walkMPerMin;
}

/**
 * Previsão para o destino: estima cada trecho no raio de caminhada e ordena pelo
 * menor tempo esperado = caminhar + (1 − p) × penalidade de rodar procurando.
 * (O tempo dirigindo até cada trecho é praticamente o mesmo dentro do raio.)
 */
export function forecastDestination(input: ForecastInput): DestinationForecast {
  const arriveAt = input.now + input.etaMin * 60000;
  const all: SegmentForecast[] = [];
  for (const s of input.segments) {
    if (s.noParking) continue;
    const walkM = distance(s.mid, input.destination);
    if (walkM > input.radiusM) continue;
    const e = estimateSegment(s, input.reports, arriveAt);
    const walkMin = walkMinutes(walkM);
    all.push({
      segment: s,
      p: e.p,
      low: e.low,
      high: e.high,
      confidence: e.confidence,
      level: levelOf(e.p, e.confidence),
      reportsUsed: e.reportsUsed,
      newestReportAgeMin: e.newestAt === null ? null : Math.max(0, Math.round((input.now - e.newestAt) / 60000)),
      simulatedShare: e.simulatedShare,
      walkM,
      walkMin,
      expectedMin: walkMin + (1 - e.p) * MODEL.missPenaltyMin,
    });
  }
  all.sort((a, b) => a.expectedMin - b.expectedMin);
  // 3 opções em ruas diferentes (dois quarteirões da mesma rua são quase a mesma dica)
  const best: SegmentForecast[] = [];
  for (const f of all) if (best.length < 3 && !best.some((b) => b.segment.name === f.segment.name)) best.push(f);
  for (const f of all) if (best.length < 3 && !best.includes(f)) best.push(f);

  // Chance de achar em algum dos 3 melhores. Trechos vizinhos enchem juntos,
  // então "encolhemos" a independência com o expoente 0,6.
  const combine = (ps: number[]) => clamp(1 - ps.reduce((m, p) => m * Math.pow(1 - p, 0.6), 1));
  const overall = best.length ? combine(best.map((f) => f.p)) : MODEL.minP;
  const overallLow = best.length ? combine(best.map((f) => f.low)) : MODEL.minP;
  const overallHigh = best.length ? combine(best.map((f) => f.high)) : MODEL.minP;
  const reports = all.reduce((n, f) => n + f.reportsUsed, 0);
  const conf = best.length ? best.reduce((m, f) => m + f.confidence, 0) / best.length : 0;
  const newest = all.reduce<number | null>((m, f) => (f.newestReportAgeMin === null ? m : m === null ? f.newestReportAgeMin : Math.min(m, f.newestReportAgeMin)), null);
  const sourcesText =
    reports > 0
      ? `${reports} relato${reports > 1 ? 's' : ''} recente${reports > 1 ? 's' : ''} (o mais novo há ${newest} min) + histórico do horário`
      : 'Só histórico do horário — ainda sem relatos recentes aqui';
  return {
    arriveAt,
    etaMin: input.etaMin,
    overall,
    overallLow,
    overallHigh,
    level: best.length ? levelOf(overall, conf) : 'unknown',
    best,
    all,
    sourcesText,
    dataIsEstimate: best.every((b) => b.reportsUsed === 0) || conf < 0.1,
  };
}
