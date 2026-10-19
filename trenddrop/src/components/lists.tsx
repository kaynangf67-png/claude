import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { EnrichedProduct } from '@/state/hooks';
import { MarketplaceBadge, ProductImage, ScoreRing } from './product';
import { Card, CardHeader, Skeleton } from './ui';

export function RankList({
  title,
  subtitle,
  icon,
  items,
  value,
  empty,
  loading,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  items: EnrichedProduct[];
  value: (p: EnrichedProduct) => ReactNode;
  empty: ReactNode;
  loading?: boolean;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      {loading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-ink-3">{empty}</div>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((p, i) => (
            <li key={p.id}>
              <Link to={`/produto/${encodeURIComponent(p.id)}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 sm:px-5">
                <span className={cn('w-4 text-xs font-semibold tabular', i < 3 ? 'text-brand-2' : 'text-ink-3')}>{i + 1}</span>
                <ProductImage p={p} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <MarketplaceBadge m={p.marketplace} />
                    {p.quality === 'demo' && <span className="text-[10px] text-warn">demo</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">{value(p)}</div>
                <ScoreRing score={p.insight.score.score} size={34} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function StatCard({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; accent?: boolean }) {
  return (
    <Card className={cn('relative overflow-hidden p-4 sm:p-5', accent && 'border-brand/30')}>
      {accent && <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-3">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-2">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-ink tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </Card>
  );
}
