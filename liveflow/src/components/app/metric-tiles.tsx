import { formatCompact, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { Totals } from '@/services/analytics';

/** Grade compacta de métricas (usada em páginas de produto/vídeo/live). */
export function MetricTiles({ totals, className }: { totals: Totals; className?: string }) {
  const items = [
    { label: 'Visualizações', value: formatCompact(totals.views) },
    { label: 'Cliques', value: formatNumber(totals.clicks) },
    { label: 'CTR', value: formatPercent(totals.ctr) },
    { label: 'Conversões', value: formatNumber(totals.conversions) },
    { label: 'Vendas', value: formatNumber(totals.units) },
    { label: 'Faturamento', value: formatCurrency(totals.revenue) },
  ];
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6 ${className ?? ''}`}>
      {items.map((i) => (
        <div key={i.label} className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className="tabular mt-0.5 truncate text-[17px] font-semibold tracking-tight">{i.value}</p>
        </div>
      ))}
    </div>
  );
}
