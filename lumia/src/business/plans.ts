/**
 * MODELO DE NEGÓCIO — arquitetura preparada, sem cobrança no MVP.
 *
 * TODO: FUTURE BILLING INTEGRATION
 *   Conectar um provedor de pagamentos (ex.: gateway nacional + internacional)
 *   em services/billingService.ts (ainda não existe). Hoje todo usuário é FREE
 *   e todo conteúdo de demonstração é FREE.
 */
export type PlanTier = 'FREE' | 'PREMIUM' | 'FAMILY' | 'PARTNER' | 'ENTERPRISE';

export interface Plan {
  tier: PlanTier;
  name: string;
  audience: string;
  highlights: string[];
  /** Direitos que o player/catálogo consultam. */
  entitlements: {
    premiumCatalog: boolean;
    maxProfiles: number;
    signLanguages: 'one' | 'all';
    liveInterpretation: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

export const PLANS: Plan[] = [
  {
    tier: 'FREE',
    name: 'Gratuito',
    audience: 'Para todos',
    highlights: ['Conteúdo gratuito e de domínio público', 'Intérprete IA em Libras', 'Legendas e sons importantes'],
    entitlements: { premiumCatalog: false, maxProfiles: 1, signLanguages: 'one', liveInterpretation: false, apiAccess: false, whiteLabel: false },
  },
  {
    tier: 'PREMIUM',
    name: 'Premium',
    audience: 'Assinatura individual',
    highlights: ['Catálogo licenciado completo', 'Interpretações verificadas por humanos', 'Modo Libras imersivo'],
    entitlements: { premiumCatalog: true, maxProfiles: 2, signLanguages: 'all', liveInterpretation: true, apiAccess: false, whiteLabel: false },
  },
  {
    tier: 'FAMILY',
    name: 'Família',
    audience: 'Até 5 perfis',
    highlights: ['Perfis com preferências próprias', 'Controle de classificação indicativa'],
    entitlements: { premiumCatalog: true, maxProfiles: 5, signLanguages: 'all', liveInterpretation: true, apiAccess: false, whiteLabel: false },
  },
  {
    tier: 'PARTNER',
    name: 'Parceiro',
    audience: 'Estúdios, distribuidoras e produtoras',
    highlights: ['Envio de conteúdo licenciado', 'Fila de validação com intérpretes', 'Relatórios de acessibilidade'],
    entitlements: { premiumCatalog: true, maxProfiles: 10, signLanguages: 'all', liveInterpretation: true, apiAccess: true, whiteLabel: false },
  },
  {
    tier: 'ENTERPRISE',
    name: 'Enterprise / B2B',
    audience: 'Plataformas, TVs, cinemas, educação',
    highlights: ['API de interpretação', 'Avatar white-label', 'SLA e validação dedicada'],
    entitlements: { premiumCatalog: true, maxProfiles: 100, signLanguages: 'all', liveInterpretation: true, apiAccess: true, whiteLabel: true },
  },
];

export function planFor(tier: PlanTier): Plan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

export function canWatch(userTier: PlanTier, contentTier: PlanTier): boolean {
  if (contentTier === 'FREE') return true;
  return planFor(userTier).entitlements.premiumCatalog;
}
