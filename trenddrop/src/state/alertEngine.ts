// Avaliação de alertas dentro do painel. Não há envio de e-mail/push: as
// ocorrências ficam registradas na página Alertas e no sino do topo.
import { priceChangePct } from '@shared/analysis';
import type { Alert } from '@/data/types';
import { money, pct } from '@/lib/format';
import type { EnrichedProduct } from './hooks';

export const ALERT_COOLDOWN_MS = 24 * 3600_000;

export interface AlertHit {
  alert: Alert;
  productId: string | null;
  message: string;
}

export function evaluateAlerts(alerts: Alert[], products: EnrichedProduct[], now = Date.now()): AlertHit[] {
  const hits: AlertHit[] = [];
  for (const a of alerts) {
    if (!a.active) continue;
    if (a.lastTriggeredAt && now - new Date(a.lastTriggeredAt).getTime() < ALERT_COOLDOWN_MS) continue;
    const p = a.productId ? products.find((x) => x.id === a.productId) : null;
    switch (a.type) {
      case 'interest_increase':
        if (p?.growthPct != null && p.growthPct >= a.threshold)
          hits.push({ alert: a, productId: p.id, message: `${p.name}: interesse cresceu ${pct(p.growthPct, true)} (limite ${pct(a.threshold)}).` });
        break;
      case 'margin_reached': {
        const m = p?.insight.profit?.marginPct;
        if (p && m != null && m >= a.threshold) hits.push({ alert: a, productId: p.id, message: `${p.name}: margem estimada de ${pct(m)} atingiu ${pct(a.threshold)}.` });
        break;
      }
      case 'price_change': {
        const h = p?.priceHistory ?? [];
        const change = priceChangePct(h.slice(-2));
        if (p && change != null && Math.abs(change) >= a.threshold)
          hits.push({ alert: a, productId: p.id, message: `${p.name}: preço mudou ${pct(change, true)} (agora ${money(p.price)}).` });
        break;
      }
      case 'new_opportunity': {
        const since = new Date(a.lastTriggeredAt ?? a.createdAt).getTime();
        const found = products.filter(
          (x) =>
            (!a.category || x.category === a.category) &&
            (x.insight.score.score ?? 0) >= a.threshold &&
            new Date(x.updatedAt).getTime() >= since,
        );
        if (found.length)
          hits.push({
            alert: a,
            productId: found[0].id,
            message: `${found.length} oportunidade(s) com indicador ≥ ${a.threshold}${a.category ? ` em ${a.category}` : ''}: ${found
              .slice(0, 3)
              .map((x) => x.name)
              .join(', ')}.`,
          });
        break;
      }
    }
  }
  return hits;
}
