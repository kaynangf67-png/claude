import type { FeeProfile, ProfitInput, ProfitResult } from '@shared/analysis';
import type { Marketplace, Product } from '@shared/types';

export type AlertType = 'interest_increase' | 'margin_reached' | 'price_change' | 'new_opportunity';

export const ALERT_LABEL: Record<AlertType, string> = {
  interest_increase: 'Aumento de interesse',
  margin_reached: 'Margem atingida',
  price_change: 'Mudança de preço',
  new_opportunity: 'Nova oportunidade na categoria',
};

export interface Alert {
  id: string;
  type: AlertType;
  productId: string | null;
  category: string | null;
  /** interest_increase: % de crescimento; margin_reached: % de margem; price_change: % de variação; new_opportunity: indicador mínimo. */
  threshold: number;
  active: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  productId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Simulation {
  id: string;
  name: string;
  marketplace: Marketplace;
  productId: string | null;
  inputs: ProfitInput;
  results: ProfitResult;
  createdAt: string;
}

export interface UserSettings {
  dropsellerSearchUrl: string | null;
  targetMarginPct: number;
}

export type FeeMap = Partial<Record<Marketplace, FeeProfile & { notes?: string }>>;

export interface SupplierInfo {
  url: string | null;
  cost: number | null;
}

export interface Repository {
  readonly kind: 'local' | 'demo' | 'supabase';
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  /** Salva (monitora) um produto. Se já existir (mesma origem/ID externo), atualiza e acrescenta histórico de preço. */
  saveProduct(p: Product): Promise<Product>;
  createManualProduct(p: Omit<Product, 'id' | 'priceHistory' | 'updatedAt'>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  setSupplier(productId: string, info: SupplierInfo): Promise<void>;

  listFavorites(): Promise<string[]>;
  setFavorite(productId: string, on: boolean): Promise<void>;

  listAlerts(): Promise<Alert[]>;
  saveAlert(a: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'> & { id?: string }): Promise<void>;
  deleteAlert(id: string): Promise<void>;
  markAlertTriggered(id: string, at: string): Promise<void>;
  listAlertEvents(): Promise<AlertEvent[]>;
  addAlertEvent(e: Omit<AlertEvent, 'id' | 'createdAt' | 'read'>): Promise<void>;
  markEventsRead(): Promise<void>;

  listSimulations(): Promise<Simulation[]>;
  saveSimulation(s: Omit<Simulation, 'id' | 'createdAt'>): Promise<void>;
  deleteSimulation(id: string): Promise<void>;

  getFees(): Promise<FeeMap>;
  saveFees(m: Marketplace, fee: FeeProfile & { notes?: string }): Promise<void>;
  getSettings(): Promise<UserSettings>;
  saveSettings(s: UserSettings): Promise<void>;
}
