import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { salesMetric } from '@shared/analysis';
import { METRIC_LABEL } from '@shared/types';
import { cn } from '@/lib/cn';
import { money, pct, relative } from '@/lib/format';
import type { EnrichedProduct } from '@/state/hooks';
import { CompetitionBadge, GrowthBadge, MarketplaceBadge, metricText, ProductCard, ProductImage, QualityBadge, ScoreRing } from './product';
import { Card, Segmented, Skeleton } from './ui';

export function ProductCollection({ items, loading, empty, days = 30, toolbar }: { items: EnrichedProduct[]; loading?: boolean; empty: ReactNode; days?: number; toolbar?: ReactNode }) {
  const [view, setView] = useState<'grid' | 'table'>(() => {
    try {
      return (localStorage.getItem('trenddrop:view') as 'grid' | 'table') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const change = (v: 'grid' | 'table') => {
    setView(v);
    try {
      localStorage.setItem('trenddrop:view', v);
    } catch {
      /* ignora */
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{loading ? 'Carregando…' : `${items.length} produto(s)`}</p>
        <div className="flex items-center gap-2">
          {toolbar}
          <Segmented
            value={view}
            onChange={change}
            options={[
              { value: 'grid', label: <LayoutGrid className="h-3.5 w-3.5" aria-label="Cartões" /> },
              { value: 'table', label: <Rows3 className="h-3.5 w-3.5" aria-label="Tabela" /> },
            ]}
          />
        </div>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : items.length === 0 ? (
        <Card>{empty}</Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} p={p} days={days} />)}
        </div>
      ) : (
        <ProductTable items={items} />
      )}
    </div>
  );
}

export function ProductTable({ items }: { items: EnrichedProduct[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[11px] tracking-wide text-ink-3 uppercase">
              <th className="px-4 py-2.5 font-medium">Produto</th>
              <th className="px-3 py-2.5 font-medium">Origem</th>
              <th className="px-3 py-2.5 text-right font-medium">Preço</th>
              <th className="px-3 py-2.5 text-right font-medium">Custo</th>
              <th className="px-3 py-2.5 text-right font-medium">Lucro est.</th>
              <th className="px-3 py-2.5 text-right font-medium">Margem</th>
              <th className="px-3 py-2.5 text-right font-medium">Tendência</th>
              <th className="px-3 py-2.5 font-medium">Indicador</th>
              <th className="px-3 py-2.5 font-medium">Concorrência</th>
              <th className="px-3 py-2.5 text-center font-medium">Oport.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => {
              const m = salesMetric(p) ?? p.metrics[0];
              return (
                <tr key={p.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link to={`/produto/${encodeURIComponent(p.id)}`} className="flex items-center gap-3">
                      <ProductImage p={p} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0">
                        <div className="max-w-[260px] truncate text-ink hover:text-brand-2">{p.name}</div>
                        <div className="text-[11px] text-ink-3">{p.category ?? '—'} · {relative(p.updatedAt)}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5"><div className="flex flex-col items-start gap-1"><MarketplaceBadge m={p.marketplace} /><QualityBadge q={p.quality} /></div></td>
                  <td className="px-3 py-2.5 text-right tabular">{money(p.price)}</td>
                  <td className="px-3 py-2.5 text-right text-ink-2 tabular">{money(p.supplierCost)}</td>
                  <td className={cn('px-3 py-2.5 text-right font-medium tabular', p.insight.profit ? (p.insight.profit.profit >= 0 ? 'text-up' : 'text-down') : 'text-ink-3')}>{p.insight.profit ? money(p.insight.profit.profit) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular">{pct(p.insight.profit?.marginPct)}</td>
                  <td className="px-3 py-2.5 text-right"><GrowthBadge value={p.growthPct} /></td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">{m ? <span title={m.detail}>{METRIC_LABEL[m.kind]}: <strong className="text-ink">{metricText(m)}</strong></span> : '—'}</td>
                  <td className="px-3 py-2.5"><CompetitionBadge level={p.competition?.level} title={p.competition?.method} /></td>
                  <td className="px-3 py-2.5"><div className="flex justify-center"><ScoreRing score={p.insight.score.score} size={34} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
