import type { PostFormat } from '@/types/domain';

export type ScriptObjective = 'vender' | 'engajar' | 'lancamento' | 'promocao';

export interface ScriptInput {
  productName: string;
  price: number | null;
  benefits: string;
  audience: string;
  objective: ScriptObjective;
  /** Formato sem rosto. Ausente = roteiro genérico. */
  format?: PostFormat;
}

export interface Script {
  hook: string;
  script: string;
  benefits: string[];
  proof: string;
  cta: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Resumo dos dados do usuário enviado ao copiloto (nunca dados de outros usuários). */
export interface CopilotContext {
  today: string;
  products: {
    id: string;
    name: string;
    price: number;
    promoPrice: number | null;
    commissionRate: number;
    category: string;
    status: string;
    last30d: { views: number; clicks: number; orders: number; revenue: number; commission: number; ctr: number; conversionRate: number };
  }[];
  videos: { id: string; name: string; productName: string | null; durationSeconds: number; usageCount: number; revenue30d: number; ctr30d: number }[];
  upcomingLives: { title: string; productName: string | null; startsAt: string; status: string }[];
  totals30d: { views: number; clicks: number; orders: number; revenue: number; commission: number };
}

export interface AIProvider {
  readonly id: 'local' | 'remote';
  generateScript(input: ScriptInput, variant?: number): Promise<Script>;
  generateVariations(input: ScriptInput, count: number): Promise<Script[]>;
  chat(messages: ChatMessage[], context: CopilotContext): Promise<string>;
}

export const OBJECTIVE_LABELS: Record<ScriptObjective, string> = {
  vender: 'Vender agora',
  engajar: 'Gerar engajamento',
  lancamento: 'Lançamento',
  promocao: 'Promoção relâmpago',
};
