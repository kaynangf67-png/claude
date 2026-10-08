/**
 * INTERPRETATION TIMELINE ENGINE
 *
 * Converte representações em Libras em uma linha do tempo de sinais com
 * início/fim absolutos no tempo do VÍDEO:
 *
 *   23.80 → ALÔ          25.70 → #MARINA      26.95 → EU      27.35 → #DANIEL …
 *
 * Regras de agendamento:
 *  - pequena defasagem natural (LAG) — intérpretes humanos também sinalizam
 *    um pouco depois de ouvir;
 *  - nunca sobrepor a próxima unidade;
 *  - se não couber, acelera até um limite e registra o aviso de ritmo
 *    (o QUALITY ENGINE usa isso).
 *
 * A sincronização em si é feita por avaliação PURA: o avatar calcula a pose
 * como função de video.currentTime (ver animationEngine.evaluatePose). Assim,
 * pausar, avançar, voltar ou mudar a velocidade mantém o avatar alinhado sem
 * nenhum estado a corrigir.
 */
import type { ContextFrame, InterpretationUnit, QualityReport, ReviewRecord, SignRepresentation, SignToken } from '@/ai/types';
import type { InterpretationStatus, SignLanguageCode } from '@/types/content';
import { fingerspellEntry, lookupSign, type SignLexiconEntry } from './signEngine';

export interface TimelineSegment {
  id: string;
  unit: InterpretationUnit;
  context: ContextFrame;
  representation: SignRepresentation;
  quality: QualityReport;
  status: InterpretationStatus;
  review?: ReviewRecord;
  signStart: number;
  signEnd: number;
  speedFactor: number;
}

export interface ScheduledSign {
  index: number;
  segmentIndex: number;
  token: SignToken;
  entry: SignLexiconEntry | null;
  start: number;
  end: number;
  amplitude: number;
  signingSpace: number;
}

export interface InterpretationTimeline {
  contentId: string;
  language: SignLanguageCode;
  segments: TimelineSegment[];
  signs: ScheduledSign[];
}

export const LAG = 0.2;
const MAX_OVERFLOW = 1.3;
const GAP = 0.07;
const TOPIC_HOLD = 0.14;

export function entryFor(token: SignToken): SignLexiconEntry | null {
  if (token.kind === 'fingerspell') return fingerspellEntry(token.letters ?? token.gloss.replace('#', ''));
  return lookupSign(token.gloss) ?? null;
}

function naturalDuration(token: SignToken, entry: SignLexiconEntry | null): number {
  const base = entry?.duration ?? 0.5;
  return base + (token.markers.includes('topic') ? TOPIC_HOLD : 0);
}

export interface SegmentInput {
  unit: InterpretationUnit;
  context: ContextFrame;
  representation: SignRepresentation;
  makeQuality: (timing: { speedFactor: number; overflow: number }) => QualityReport;
  review?: ReviewRecord;
}

export function buildTimeline(contentId: string, language: SignLanguageCode, inputs: SegmentInput[]): InterpretationTimeline {
  const sorted = [...inputs].sort((a, b) => a.unit.start - b.unit.start);
  const segments: TimelineSegment[] = [];
  const signs: ScheduledSign[] = [];
  let prevEnd = -Infinity;

  sorted.forEach((inp, si) => {
    const rep = inp.representation;
    const entries = rep.tokens.map(entryFor);
    const natural = rep.tokens.reduce((acc, tk, i) => acc + naturalDuration(tk, entries[i]) / rep.speed, 0) + GAP * Math.max(0, rep.tokens.length - 1);
    const start = Math.max(inp.unit.start + LAG, prevEnd + 0.12);
    const next = sorted[si + 1];
    const hardEnd = next ? next.unit.start + LAG - 0.1 : Infinity;
    const softEnd = Math.max(inp.unit.end, inp.unit.start + 0.6) + MAX_OVERFLOW;
    let avail = Math.min(hardEnd, softEnd) - start;
    if (natural / Math.max(avail, 0.01) > 1.3 && hardEnd > softEnd) avail = hardEnd - start;
    avail = Math.max(avail, 0.3);
    const speedFactor = Math.max(1, natural / avail);

    let t = start;
    rep.tokens.forEach((tk, i) => {
      const dur = naturalDuration(tk, entries[i]) / rep.speed / speedFactor;
      signs.push({
        index: signs.length,
        segmentIndex: si,
        token: tk,
        entry: entries[i],
        start: t,
        end: t + dur - (tk.markers.includes('topic') ? TOPIC_HOLD / speedFactor : 0),
        amplitude: 0.85 + rep.intensity * 0.3,
        signingSpace: rep.signingSpace,
      });
      t += dur + GAP / speedFactor;
    });
    const signEnd = rep.tokens.length ? t - GAP / speedFactor : start;
    prevEnd = signEnd;
    const quality = inp.makeQuality({ speedFactor, overflow: signEnd - inp.unit.end });
    const status: InterpretationStatus = inp.review?.status ?? quality.suggestedStatus;
    segments.push({
      id: inp.unit.id,
      unit: inp.unit,
      context: inp.context,
      representation: rep,
      quality,
      status,
      review: inp.review,
      signStart: start,
      signEnd,
      speedFactor,
    });
  });
  return { contentId, language, segments, signs };
}

/** Índice do último sinal com start <= t (busca binária). */
export function signIndexAt(signs: ScheduledSign[], t: number): number {
  let lo = 0;
  let hi = signs.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (signs[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function segmentAt(timeline: InterpretationTimeline, t: number, pad = 0): TimelineSegment | undefined {
  return timeline.segments.find((s) => t >= s.signStart - pad && t <= s.signEnd + pad);
}

export function activeSignAt(timeline: InterpretationTimeline, t: number): ScheduledSign | undefined {
  const i = signIndexAt(timeline.signs, t);
  const s = timeline.signs[i];
  return s && t < s.end ? s : undefined;
}
