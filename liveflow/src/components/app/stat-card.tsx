import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  change,
  hint,
  loading,
  accent = 'primary',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  change?: number | null;
  hint?: string;
  loading?: boolean;
  accent?: 'primary' | 'pink' | 'teal' | 'amber';
}) {
  const accents = {
    primary: 'bg-chart-1/12 text-chart-1',
    pink: 'bg-chart-2/12 text-chart-2',
    teal: 'bg-chart-3/14 text-chart-3',
    amber: 'bg-chart-4/16 text-chart-4',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground sm:text-[13px]">{label}</span>
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', accents[accent])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="tabular mt-1.5 truncate text-lg font-semibold tracking-tight sm:text-[22px]">{value}</p>
      )}
      <div className="mt-1 flex h-4 items-center gap-1.5 text-xs">
        {change != null && !loading && (
          <span className={cn('inline-flex items-center font-medium', change >= 0 ? 'text-success' : 'text-destructive')}>
            {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {formatPercent(Math.abs(change))}
          </span>
        )}
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
