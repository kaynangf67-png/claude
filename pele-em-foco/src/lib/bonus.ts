import { diffDays } from './dates';

export type BonusStatus =
  | { kind: 'nao-configurado' }
  | { kind: 'ativo'; endDate: string; daysLeft: number }
  | { kind: 'encerrado'; endDate: string };

/**
 * Situação do período gratuito para compradores.
 * Informativo: sem backend, o app NÃO bloqueia o acesso após a data (veja docs/ACESSO-E-ENTREGA.md).
 */
export function bonusStatus(endDate: string | null, today: string): BonusStatus {
  if (!endDate) return { kind: 'nao-configurado' };
  const daysLeft = diffDays(today, endDate);
  return daysLeft >= 0 ? { kind: 'ativo', endDate, daysLeft } : { kind: 'encerrado', endDate };
}
