// Sincronização agendada (cron): para cada termo em SYNC_TERMS, grava a série
// do Google Trends e atualiza os principais anúncios do Mercado Livre/Shopee
// no catálogo compartilhado (owner_id = null), acrescentando histórico de preço.
import { productToRow } from '../shared/dbmap';
import type { Product, TrendSeries } from '../shared/types';
import { adminClient } from './db';
import { serverEnv } from './env';
import { ApiError } from './http';
import { fetchTrends, isTrendsConfigured } from './integrations/googleTrends';
import { isMercadoLivreConfigured, searchMercadoLivre } from './integrations/mercadoLivre';
import { isShopeeConfigured, searchShopee } from './integrations/shopee';

export async function runSync() {
  const db = adminClient();
  if (!db) throw new ApiError(503, 'not_configured', 'Banco não configurado para sincronização (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).', 'database');
  const terms = serverEnv.syncTerms;
  const report = { terms: terms.length, trendPoints: 0, products: 0, prices: 0, errors: [] as string[] };

  for (const term of terms) {
    let series: TrendSeries | null = null;
    if (isTrendsConfigured()) {
      try {
        series = (await fetchTrends({ terms: [term], period: '90d' })).series[0] ?? null;
        if (series?.points.length) {
          const rows = series.points.map((p) => ({ term: term.toLowerCase(), geo: 'BR', day: p.date.slice(0, 10), value: p.value, source_id: 'google_trends', owner_id: null }));
          // O índice único é parcial (owner_id null), que o upsert do PostgREST não usa:
          // substituímos a janela do termo.
          const { error: delError } = await db
            .from('trend_history')
            .delete()
            .is('owner_id', null)
            .eq('term', term.toLowerCase())
            .eq('geo', 'BR')
            .eq('source_id', 'google_trends')
            .gte('day', rows[0].day);
          const { error } = delError ? { error: delError } : await db.from('trend_history').insert(rows);
          if (error) report.errors.push(`trends ${term}: ${error.message}`);
          else report.trendPoints += rows.length;
        }
      } catch (e) {
        report.errors.push(`trends ${term}: ${(e as Error).message}`);
      }
    }

    const found: Product[] = [];
    if (isMercadoLivreConfigured()) {
      try {
        found.push(...(await searchMercadoLivre(term)).products.slice(0, 5));
      } catch (e) {
        report.errors.push(`mercadolivre ${term}: ${(e as Error).message}`);
      }
    }
    if (isShopeeConfigured()) {
      try {
        found.push(...(await searchShopee(term, 'vendas')).products.slice(0, 5));
      } catch (e) {
        report.errors.push(`shopee ${term}: ${(e as Error).message}`);
      }
    }

    for (const p of found) {
      const product: Product = { ...p, trendTerm: term, trend: series?.points ?? [], growthPct: series?.growthPct ?? null };
      const row = productToRow(product, null);
      const { data: existing } = await db
        .from('products')
        .select('id')
        .is('owner_id', null)
        .eq('marketplace', p.marketplace)
        .eq('external_id', p.externalId!)
        .maybeSingle();
      const { data: saved, error } = existing
        ? await db.from('products').update(row).eq('id', existing.id).select('id').single()
        : await db.from('products').insert(row).select('id').single();
      if (error || !saved) {
        report.errors.push(`produto ${p.externalId}: ${error?.message}`);
        continue;
      }
      report.products++;
      if (p.price) {
        const { error: e2 } = await db.from('price_history').insert({ product_id: saved.id, price: p.price, source_id: p.marketplace });
        if (!e2) report.prices++;
      }
    }
  }
  return report;
}
