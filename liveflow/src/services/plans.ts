import type { PlanTier } from '@/types/domain';

// Espelho da tabela plan_limits. O banco é quem de fato aplica os limites
// (trigger enforce_plan_limit); aqui servem só para a UI avisar antes.
export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  limits: {
    products: number | null;
    videos: number | null;
    livesPerMonth: number | null;
    aiGenerationsPerMonth: number | null;
    analyticsHistoryDays: number;
    storageMb: number;
  };
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    limits: { products: 10, videos: 10, livesPerMonth: 30, aiGenerationsPerMonth: 30, analyticsHistoryDays: 30, storageMb: 1024 },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 79,
    limits: { products: 100, videos: 200, livesPerMonth: 600, aiGenerationsPerMonth: 500, analyticsHistoryDays: 180, storageMb: 20480 },
  },
  premium: {
    tier: 'premium',
    name: 'Premium',
    priceMonthly: 199,
    limits: { products: null, videos: null, livesPerMonth: null, aiGenerationsPerMonth: 3000, analyticsHistoryDays: 730, storageMb: 102400 },
  },
};

export type LimitKey = keyof Omit<PlanDefinition['limits'], 'analyticsHistoryDays' | 'storageMb'>;

export function checkLimit(tier: PlanTier, key: LimitKey, currentCount: number): { allowed: boolean; limit: number | null } {
  const limit = PLANS[tier].limits[key];
  return { allowed: limit == null || currentCount < limit, limit };
}

export class PlanLimitError extends Error {
  constructor(public readonly key: LimitKey, public readonly limit: number) {
    super(
      limit > 0
        ? `Você atingiu o limite do seu plano (${limit}). Faça upgrade para continuar.`
        : 'Você atingiu o limite do seu plano. Faça upgrade para continuar.',
    );
    this.name = 'PlanLimitError';
  }
}

/**
 * Ponto de extensão para pagamentos. A implementação real (Stripe ou Mercado Pago)
 * deve rodar em Edge Function: cria checkout, recebe webhook e atualiza
 * profiles.plan + subscriptions com a service_role. Nada disso roda no browser.
 */
export interface BillingProvider {
  readonly id: 'stripe' | 'mercadopago';
  createCheckout(plan: Exclude<PlanTier, 'free'>): Promise<{ url: string }>;
  openCustomerPortal(): Promise<{ url: string }>;
}
