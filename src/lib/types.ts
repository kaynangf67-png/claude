export type LeadStatus = 'novo' | 'interessado' | 'followup' | 'recuperado' | 'perdido';
export type Temperature = 'quente' | 'morno' | 'frio';
export type Sender = 'cliente' | 'empresa';

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface Business {
  name: string;
  whatsapp: string;
  segment: string;
  description: string;
  hours: string;
  products: Product[];
  faqs: Faq[];
}

export interface Message {
  id: string;
  from: Sender;
  text: string;
  at: string; // ISO
  isFollowup?: boolean;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  productName: string;
  value: number;
  status: LeadStatus;
  messages: Message[];
  followupsSent: number;
  lastFollowupAt?: string;
  recoveredAt?: string;
  createdAt: string;
}

export interface User {
  name: string;
  email: string;
}

export type Objection =
  | 'decisao_compartilhada'
  | 'vai_pensar'
  | 'preco'
  | 'desconto'
  | 'adiou'
  | 'sem_resposta'
  | 'pergunta_sem_resposta'
  | 'respondeu_followup'
  | 'nenhuma';

export type FollowupState = 'pendente' | 'aguardando' | 'respondido' | 'limite' | 'nao_necessario';

export interface Analysis {
  /** Venda potencialmente perdida: demonstrou interesse e parou de avançar. */
  isLostOpportunity: boolean;
  /** Perguntou preço, pagamento, entrega etc. */
  showedInterest: boolean;
  label: string;
  temperature: Temperature;
  score: number;
  objection: Objection;
  reasons: string[];
  /** O motivo principal, em uma linha. */
  keyReason?: string;
  recommendedAction: string;
  urgency: 'agora' | '24h' | '48h' | '7d' | 'nenhuma';
  needsHuman: boolean;
  humanReason?: string;
  canFollowUp: boolean;
  blockReason?: string;
  followupState: FollowupState;
  /** true quando a sugestão é uma resposta a uma pergunta pendente, não um follow-up. */
  isReply: boolean;
  daysSince: number;
  lastInteraction: string;
}
