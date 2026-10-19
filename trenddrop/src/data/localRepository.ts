// Repositório no localStorage. Usado no "modo local" (sem Supabase) e no
// "modo demonstração" (namespace separado, semeado com dados fictícios).
import type { Product } from '@shared/types';
import type { Alert, AlertEvent, FeeMap, Repository, Simulation, SupplierInfo, UserSettings } from './types';

interface State {
  products: Product[];
  favorites: string[];
  alerts: Alert[];
  events: AlertEvent[];
  simulations: Simulation[];
  fees: FeeMap;
  settings: UserSettings;
}

const empty = (): State => ({
  products: [],
  favorites: [],
  alerts: [],
  events: [],
  simulations: [],
  fees: {},
  settings: { dropsellerSearchUrl: null, targetMarginPct: 25 },
});

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export class LocalRepository implements Repository {
  private key: string;
  constructor(public readonly kind: 'local' | 'demo', seed?: () => Partial<State>) {
    this.key = `trenddrop:${kind}:v1`;
    if (seed && !this.raw()) this.write({ ...empty(), ...seed() });
  }

  private raw() {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }
  private read(): State {
    const r = this.raw();
    if (!r) return empty();
    try {
      return { ...empty(), ...(JSON.parse(r) as State) };
    } catch {
      return empty();
    }
  }
  private write(s: State) {
    try {
      localStorage.setItem(this.key, JSON.stringify(s));
    } catch {
      throw new Error('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).');
    }
  }
  private update(fn: (s: State) => void) {
    const s = this.read();
    fn(s);
    this.write(s);
  }

  reset() {
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* ignora */
    }
  }

  async listProducts() {
    return this.read().products;
  }
  async getProduct(id: string) {
    return this.read().products.find((p) => p.id === id) ?? null;
  }

  async saveProduct(p: Product) {
    let saved!: Product;
    this.update((s) => {
      const existing = s.products.find(
        (x) => x.id === p.id || (p.externalId && x.marketplace === p.marketplace && x.externalId === p.externalId),
      );
      if (existing) {
        const history = [...existing.priceHistory];
        if (p.price != null && history.at(-1)?.price !== p.price) history.push({ date: p.updatedAt, price: p.price });
        Object.assign(existing, {
          ...p,
          id: existing.id,
          priceHistory: history,
          supplierCost: existing.supplierCost,
          supplierUrl: existing.supplierUrl,
          trend: p.trend.length ? p.trend : existing.trend,
          trendTerm: p.trendTerm ?? existing.trendTerm,
          growthPct: p.growthPct ?? existing.growthPct,
          competition: p.competition ?? existing.competition,
          transient: false,
        });
        saved = existing;
      } else {
        saved = { ...p, id: uid(), transient: false };
        s.products.push(saved);
      }
    });
    return saved;
  }

  async createManualProduct(p: Omit<Product, 'id' | 'priceHistory' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const product: Product = { ...p, id: uid(), updatedAt: now, priceHistory: p.price != null ? [{ date: now, price: p.price }] : [] };
    this.update((s) => s.products.push(product));
    return product;
  }

  async deleteProduct(id: string) {
    this.update((s) => {
      s.products = s.products.filter((p) => p.id !== id);
      s.favorites = s.favorites.filter((f) => f !== id);
      s.alerts = s.alerts.filter((a) => a.productId !== id);
    });
  }

  async setSupplier(productId: string, info: SupplierInfo) {
    this.update((s) => {
      const p = s.products.find((x) => x.id === productId);
      if (!p) throw new Error('Produto não encontrado.');
      p.supplierUrl = info.url;
      p.supplierCost = info.cost;
    });
  }

  async listFavorites() {
    return this.read().favorites;
  }
  async setFavorite(productId: string, on: boolean) {
    this.update((s) => {
      s.favorites = s.favorites.filter((f) => f !== productId);
      if (on) s.favorites.unshift(productId);
    });
  }

  async listAlerts() {
    return this.read().alerts;
  }
  async saveAlert(a: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'> & { id?: string }) {
    this.update((s) => {
      const existing = a.id ? s.alerts.find((x) => x.id === a.id) : null;
      if (existing) Object.assign(existing, a);
      else s.alerts.unshift({ ...a, id: uid(), createdAt: new Date().toISOString(), lastTriggeredAt: null });
    });
  }
  async deleteAlert(id: string) {
    this.update((s) => {
      s.alerts = s.alerts.filter((a) => a.id !== id);
      s.events = s.events.filter((e) => e.alertId !== id);
    });
  }
  async markAlertTriggered(id: string, at: string) {
    this.update((s) => {
      const a = s.alerts.find((x) => x.id === id);
      if (a) a.lastTriggeredAt = at;
    });
  }
  async listAlertEvents() {
    return this.read().events;
  }
  async addAlertEvent(e: Omit<AlertEvent, 'id' | 'createdAt' | 'read'>) {
    this.update((s) => {
      s.events.unshift({ ...e, id: uid(), createdAt: new Date().toISOString(), read: false });
      s.events = s.events.slice(0, 200);
    });
  }
  async markEventsRead() {
    this.update((s) => s.events.forEach((e) => (e.read = true)));
  }

  async listSimulations() {
    return this.read().simulations;
  }
  async saveSimulation(sim: Omit<Simulation, 'id' | 'createdAt'>) {
    this.update((s) => s.simulations.unshift({ ...sim, id: uid(), createdAt: new Date().toISOString() }));
  }
  async deleteSimulation(id: string) {
    this.update((s) => (s.simulations = s.simulations.filter((x) => x.id !== id)));
  }

  async getFees() {
    return this.read().fees;
  }
  async saveFees(m: keyof FeeMap, fee: NonNullable<FeeMap[keyof FeeMap]>) {
    this.update((s) => (s.fees[m] = fee));
  }
  async getSettings() {
    return this.read().settings;
  }
  async saveSettings(settings: UserSettings) {
    this.update((s) => (s.settings = settings));
  }
}
