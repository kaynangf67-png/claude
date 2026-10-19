// Repositório Supabase. Toda a proteção de dados é feita por RLS no banco;
// aqui só montamos as consultas com o usuário logado.
import type { SupabaseClient } from '@supabase/supabase-js';
import { productToRow, rowToProduct, type ProductRow } from '@shared/dbmap';
import type { Marketplace, Product } from '@shared/types';
import type { Alert, AlertEvent, FeeMap, Repository, Simulation, SupplierInfo, UserSettings } from './types';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;
  constructor(private db: SupabaseClient, private userId: string) {}

  private async hydrate(rows: ProductRow[]): Promise<Product[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [history, links] = await Promise.all([
      this.db.from('price_history').select('product_id, price, captured_at').in('product_id', ids).order('captured_at').limit(5000),
      this.db.from('supplier_links').select('product_id, url, supplier_cost').in('product_id', ids),
    ]);
    const byProduct = new Map<string, Product['priceHistory']>();
    for (const h of check(history) ?? []) {
      const list = byProduct.get(h.product_id) ?? [];
      list.push({ date: h.captured_at, price: Number(h.price) });
      byProduct.set(h.product_id, list);
    }
    const linkMap = new Map((check(links) ?? []).map((l) => [l.product_id, l]));
    return rows.map((r) => {
      const p = rowToProduct(r, byProduct.get(r.id) ?? []);
      const l = linkMap.get(r.id);
      p.supplierUrl = l?.url ?? null;
      p.supplierCost = l?.supplier_cost == null ? null : Number(l.supplier_cost);
      return p;
    });
  }

  async listProducts() {
    const rows = check(await this.db.from('products').select('*').order('updated_at', { ascending: false }).limit(500)) as ProductRow[];
    // Se o usuário tem cópia privada de um item do catálogo compartilhado, mostra só a cópia.
    const own = new Set(rows.filter((r) => r.owner_id && r.external_id).map((r) => `${r.marketplace}:${r.external_id}`));
    return this.hydrate(rows.filter((r) => r.owner_id || !r.external_id || !own.has(`${r.marketplace}:${r.external_id}`)));
  }

  async getProduct(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const row = check(await this.db.from('products').select('*').eq('id', id).maybeSingle()) as ProductRow | null;
    return row ? (await this.hydrate([row]))[0] : null;
  }

  async saveProduct(p: Product) {
    if (p.quality === 'demo') throw new Error('Dados de demonstração não são gravados no banco.');
    // Já visível (próprio ou compartilhado)?
    let existing: ProductRow | null = null;
    if (/^[0-9a-f-]{36}$/i.test(p.id)) {
      existing = check(await this.db.from('products').select('*').eq('id', p.id).maybeSingle()) as ProductRow | null;
    }
    if (!existing && p.externalId) {
      const rows = check(
        await this.db.from('products').select('*').eq('marketplace', p.marketplace).eq('external_id', p.externalId).limit(2),
      ) as ProductRow[];
      existing = rows.find((r) => r.owner_id === this.userId) ?? rows[0] ?? null;
    }
    if (existing && existing.owner_id === null) {
      // Catálogo compartilhado não é alterado pelo usuário. Se ele personalizar a
      // tendência, criamos uma cópia privada e movemos seus vínculos para ela.
      if ((p.trendTerm ?? null) === existing.trend_term) return (await this.hydrate([existing]))[0];
      const copy = productToRow({ ...rowToProduct(existing), trendTerm: p.trendTerm, trend: p.trend, growthPct: p.growthPct ?? null }, this.userId);
      const { id: copyId } = check(await this.db.from('products').insert(copy).select('id').single()) as { id: string };
      for (const table of ['favorites', 'supplier_links', 'alerts', 'profit_simulations']) {
        check(await this.db.from(table).update({ product_id: copyId }).eq('product_id', existing.id).eq('user_id', this.userId));
      }
      return (await this.getProduct(copyId))!;
    }
    const row = productToRow(p, this.userId);
    let id: string;
    if (existing) {
      const merged = {
        ...row,
        trend: p.trend.length ? row.trend : existing.trend,
        trend_term: row.trend_term ?? existing.trend_term,
        growth_pct: row.growth_pct ?? existing.growth_pct,
        competition: row.competition ?? existing.competition,
      };
      check(await this.db.from('products').update(merged).eq('id', existing.id));
      id = existing.id;
    } else {
      id = (check(await this.db.from('products').insert(row).select('id').single()) as { id: string }).id;
    }
    if (p.price != null) {
      const last = check(
        await this.db.from('price_history').select('price').eq('product_id', id).order('captured_at', { ascending: false }).limit(1),
      ) as { price: number }[];
      if (Number(last[0]?.price) !== p.price) {
        check(await this.db.from('price_history').insert({ product_id: id, price: p.price, source_id: p.marketplace === 'tiktok' ? 'tiktok' : p.marketplace }));
      }
    }
    return (await this.getProduct(id))!;
  }

  async createManualProduct(p: Omit<Product, 'id' | 'priceHistory' | 'updatedAt'>) {
    return this.saveProduct({ ...p, id: '', priceHistory: [], updatedAt: new Date().toISOString() });
  }

  async deleteProduct(id: string) {
    check(await this.db.from('products').delete().eq('id', id).eq('owner_id', this.userId));
  }

  async setSupplier(productId: string, info: SupplierInfo) {
    check(
      await this.db
        .from('supplier_links')
        .upsert({ user_id: this.userId, product_id: productId, supplier: 'dropseller', url: info.url, supplier_cost: info.cost }, { onConflict: 'user_id,product_id,supplier' }),
    );
  }

  async listFavorites() {
    const rows = check(await this.db.from('favorites').select('product_id').order('created_at', { ascending: false })) as { product_id: string }[];
    return rows.map((r) => r.product_id);
  }
  async setFavorite(productId: string, on: boolean) {
    if (on) check(await this.db.from('favorites').upsert({ user_id: this.userId, product_id: productId }));
    else check(await this.db.from('favorites').delete().eq('product_id', productId));
  }

  async listAlerts(): Promise<Alert[]> {
    const rows = check(await this.db.from('alerts').select('*').order('created_at', { ascending: false })) as Record<string, never>[];
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      productId: r.product_id,
      category: r.category,
      threshold: Number(r.threshold),
      active: r.active,
      lastTriggeredAt: r.last_triggered_at,
      createdAt: r.created_at,
    }));
  }
  async saveAlert(a: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'> & { id?: string }) {
    const row = { user_id: this.userId, type: a.type, product_id: a.productId, category: a.category, threshold: a.threshold, active: a.active };
    if (a.id) check(await this.db.from('alerts').update(row).eq('id', a.id));
    else check(await this.db.from('alerts').insert(row));
  }
  async deleteAlert(id: string) {
    check(await this.db.from('alerts').delete().eq('id', id));
  }
  async markAlertTriggered(id: string, at: string) {
    check(await this.db.from('alerts').update({ last_triggered_at: at }).eq('id', id));
  }
  async listAlertEvents(): Promise<AlertEvent[]> {
    const rows = check(await this.db.from('alert_events').select('*').order('created_at', { ascending: false }).limit(200)) as Record<string, never>[];
    return rows.map((r) => ({ id: r.id, alertId: r.alert_id, productId: r.product_id, message: r.message, read: r.read, createdAt: r.created_at }));
  }
  async addAlertEvent(e: Omit<AlertEvent, 'id' | 'createdAt' | 'read'>) {
    check(await this.db.from('alert_events').insert({ user_id: this.userId, alert_id: e.alertId, product_id: e.productId, message: e.message.slice(0, 500) }));
  }
  async markEventsRead() {
    check(await this.db.from('alert_events').update({ read: true }).eq('read', false));
  }

  async listSimulations(): Promise<Simulation[]> {
    const rows = check(await this.db.from('profit_simulations').select('*').order('created_at', { ascending: false })) as Record<string, never>[];
    return rows.map((r) => ({ id: r.id, name: r.name, marketplace: r.marketplace, productId: r.product_id, inputs: r.inputs, results: r.results, createdAt: r.created_at }));
  }
  async saveSimulation(s: Omit<Simulation, 'id' | 'createdAt'>) {
    const productId = s.productId && /^[0-9a-f-]{36}$/i.test(s.productId) ? s.productId : null;
    check(await this.db.from('profit_simulations').insert({ user_id: this.userId, name: s.name, marketplace: s.marketplace, product_id: productId, inputs: s.inputs, results: s.results }));
  }
  async deleteSimulation(id: string) {
    check(await this.db.from('profit_simulations').delete().eq('id', id));
  }

  async getFees(): Promise<FeeMap> {
    const rows = check(await this.db.from('marketplace_fees').select('*')) as Record<string, never>[];
    const map: FeeMap = {};
    for (const r of rows) {
      map[r.marketplace as Marketplace] = {
        commissionPct: Number(r.commission_pct),
        fixedFee: Number(r.fixed_fee),
        extraFeesPct: Number(r.extra_fees_pct),
        shipping: Number(r.shipping),
        otherCosts: Number(r.other_costs),
        taxPct: Number(r.tax_pct),
        notes: r.notes,
      };
    }
    return map;
  }
  async saveFees(m: Marketplace, f: NonNullable<FeeMap[Marketplace]>) {
    check(
      await this.db.from('marketplace_fees').upsert(
        {
          user_id: this.userId,
          marketplace: m,
          commission_pct: f.commissionPct,
          fixed_fee: f.fixedFee,
          extra_fees_pct: f.extraFeesPct,
          shipping: f.shipping,
          other_costs: f.otherCosts,
          tax_pct: f.taxPct,
          notes: f.notes ?? '',
        },
        { onConflict: 'user_id,marketplace' },
      ),
    );
  }

  async getSettings(): Promise<UserSettings> {
    const r = check(await this.db.from('user_settings').select('*').maybeSingle()) as Record<string, never> | null;
    return { dropsellerSearchUrl: r?.dropseller_search_url ?? null, targetMarginPct: r ? Number(r.target_margin_pct) : 25 };
  }
  async saveSettings(s: UserSettings) {
    check(
      await this.db.from('user_settings').upsert({ user_id: this.userId, dropseller_search_url: s.dropsellerSearchUrl, target_margin_pct: s.targetMarginPct }),
    );
  }
}
