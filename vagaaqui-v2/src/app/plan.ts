export interface Plan {
  /** epoch ms até quando o Pro vale (0 = grátis) */
  proUntil: number;
  /** relatos feitos (cada 3 = 1 dia de Pro) */
  reports: number;
  waitlisted: boolean;
}

export const REPORTS_PER_PRO_DAY = 3;
export const FREE_FAVORITES = 2;

export const isPro = (p: Plan, now = Date.now()) => p.proUntil > now;

/** Registra um relato e dá 1 dia de Pro a cada 3 — incentivo para alimentar o app. */
export function creditReport(p: Plan, now = Date.now()): { plan: Plan; earnedDay: boolean } {
  const reports = p.reports + 1;
  const earnedDay = reports % REPORTS_PER_PRO_DAY === 0;
  const proUntil = earnedDay ? Math.max(p.proUntil, now) + 86400000 : p.proUntil;
  return { plan: { ...p, reports, proUntil }, earnedDay };
}

export function proDaysLeft(p: Plan, now = Date.now()) {
  return Math.max(0, Math.ceil((p.proUntil - now) / 86400000));
}
