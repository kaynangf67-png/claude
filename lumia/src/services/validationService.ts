/**
 * VALIDATION SERVICE — revisão humana das interpretações.
 *
 *   AI TRANSLATION → QUALITY CHECK → HUMAN VALIDATION → APPROVED SIGN SEQUENCE
 *
 * Neste protótipo, as revisões ficam salvas no navegador de quem revisou.
 * TODO: FUTURE BACKEND INTEGRATION — fila de revisão compartilhada com
 * papéis (intérprete de Libras, pessoa surda, especialista, revisor
 * linguístico), dupla checagem e trilha de auditoria no servidor.
 */
import type { ReviewRecord } from '@/ai/types';
import type { InterpretationStatus } from '@/types/content';
import { loadRaw, save } from './storage';

export type ReviewMap = Record<string, ReviewRecord>;

export interface AuditEntry {
  key: string;
  from: InterpretationStatus;
  to: InterpretationStatus;
  reviewer: string;
  role: NonNullable<ReviewRecord['role']>;
  at: string;
  note?: string;
}

export function loadReviews(): ReviewMap {
  return loadRaw<ReviewMap>('reviews', {});
}

export function saveReviews(r: ReviewMap) {
  save('reviews', r);
}

export function loadAudit(): AuditEntry[] {
  return loadRaw<AuditEntry[]>('reviews:audit', []);
}

export function appendAudit(e: AuditEntry) {
  save('reviews:audit', [e, ...loadAudit()].slice(0, 200));
}

/** Transições permitidas: publicação exige verificação humana antes. */
export function canTransition(from: InterpretationStatus, to: InterpretationStatus): boolean {
  if (to === 'PUBLISHED') return from === 'HUMAN_VERIFIED' || from === 'PUBLISHED';
  if (to === 'HUMAN_VERIFIED') return from !== 'PUBLISHED';
  return true;
}
