import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import type { Marketplace } from '@shared/types';
import { pct } from '@/lib/format';
import { useCatalog, type EnrichedProduct } from '@/state/hooks';
import { applyFilters, DEFAULT_FILTERS, FilterPanel, useCategories, type Filters } from './filters';
import { ProductCollection } from './ProductCollection';
import { Button, Card, CardHeader, EmptyState, Input } from './ui';

export function SearchBar({ onSearch, placeholder, loading, initial = '' }: { onSearch: (q: string) => void; placeholder: string; loading?: boolean; initial?: string }) {
  const [q, setQ] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) onSearch(q.trim());
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <Input aria-label="Pesquisar" className="pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} />
      </div>
      <Button type="submit" variant="primary" loading={loading} disabled={!q.trim()}>Pesquisar</Button>
    </form>
  );
}

/** Categorias dos produtos monitorados nesta plataforma (dados reais do seu catálogo). */
export function CategoryBreakdown({ items }: { items: EnrichedProduct[] }) {
  const map = new Map<string, { count: number; growth: number[]; score: number[] }>();
  for (const p of items) {
    const k = p.category ?? 'Sem categoria';
    const e = map.get(k) ?? { count: 0, growth: [], score: [] };
    e.count++;
    if (p.growthPct != null) e.growth.push(p.growthPct);
    if (p.insight.score.score != null) e.score.push(p.insight.score.score);
    map.set(k, e);
  }
  const rows = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return (
    <Card>
      <CardHeader title="Categorias monitoradas" subtitle="Calculado a partir dos produtos que você acompanha nesta plataforma" />
      {rows.length === 0 ? (
        <EmptyState title="Sem categorias ainda" description="Monitore produtos para acompanhar as categorias." />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(([name, e]) => (
            <li key={name} className="flex items-center justify-between px-4 py-2.5 text-sm sm:px-5">
              <span className="truncate text-ink">{name}</span>
              <span className="flex items-center gap-4 text-xs text-ink-3 tabular">
                <span>{e.count} produto(s)</span>
                <span>tend. {pct(avg(e.growth), true)}</span>
                <span>oport. {avg(e.score)?.toFixed(0) ?? '—'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function MonitoredSection({ marketplace }: { marketplace: Marketplace }) {
  const catalog = useCatalog();
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const mine = (catalog.data ?? []).filter((p) => p.marketplace === marketplace);
  const categories = useCategories(mine);
  const items = applyFilters(mine, { ...f, marketplace });
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-ink">Produtos monitorados nesta plataforma</h2>
      <FilterPanel f={f} set={setF} categories={categories} hideMarketplace />
      <ProductCollection items={items} loading={catalog.isLoading} days={Number(f.days)} empty={<EmptyState title="Nenhum produto monitorado aqui" description="Use a busca acima e clique em Monitorar para acompanhar preço e tendência." />} />
    </section>
  );
}
