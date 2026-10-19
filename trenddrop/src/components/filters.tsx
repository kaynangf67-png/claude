import { useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { isHttpUrl } from '@shared/analysis';
import { MARKETPLACE_LABEL, type CompetitionLevel, type Marketplace } from '@shared/types';
import { ageDays } from '@/lib/format';
import { windowed, type EnrichedProduct } from '@/state/hooks';
import { Button, Input, Label, Select, Toggle } from './ui';

export type SortKey = 'growth' | 'profit' | 'margin' | 'score';

export interface Filters {
  marketplace: Marketplace | 'all';
  category: string;
  priceMin: string;
  priceMax: string;
  costMax: string;
  profitMin: string;
  marginMin: string;
  growthMin: string;
  competition: CompetitionLevel | 'all';
  updatedWithin: 'all' | '1' | '7' | '30';
  withSupplierLink: boolean;
  verifiedOnly: boolean;
  risingRecently: boolean;
  sort: SortKey;
  days: '7' | '30' | '90';
}

export const DEFAULT_FILTERS: Filters = {
  marketplace: 'all',
  category: '',
  priceMin: '',
  priceMax: '',
  costMax: '',
  profitMin: '',
  marginMin: '',
  growthMin: '',
  competition: 'all',
  updatedWithin: 'all',
  withSupplierLink: false,
  verifiedOnly: false,
  risingRecently: false,
  sort: 'score',
  days: '30',
};

const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function applyFilters(items: EnrichedProduct[], f: Filters): EnrichedProduct[] {
  const days = Number(f.days);
  const out = items
    .map((p) => ({ ...p, growthPct: windowed(p, days).growth }))
    .filter((p) => {
      if (f.marketplace !== 'all' && p.marketplace !== f.marketplace) return false;
      if (f.category && p.category !== f.category) return false;
      const price = p.price ?? null;
      if (n(f.priceMin) != null && (price == null || price < n(f.priceMin)!)) return false;
      if (n(f.priceMax) != null && (price == null || price > n(f.priceMax)!)) return false;
      if (n(f.costMax) != null && (p.supplierCost == null || p.supplierCost > n(f.costMax)!)) return false;
      if (n(f.profitMin) != null && (p.insight.profit == null || p.insight.profit.profit < n(f.profitMin)!)) return false;
      if (n(f.marginMin) != null && (p.insight.profit?.marginPct == null || p.insight.profit.marginPct < n(f.marginMin)!)) return false;
      if (n(f.growthMin) != null && (p.growthPct == null || p.growthPct < n(f.growthMin)!)) return false;
      if (f.competition !== 'all' && p.competition?.level !== f.competition) return false;
      if (f.updatedWithin !== 'all' && ageDays(p.updatedAt) > Number(f.updatedWithin)) return false;
      if (f.withSupplierLink && !isHttpUrl(p.supplierUrl)) return false;
      if (f.verifiedOnly && p.quality !== 'oficial') return false;
      if (f.risingRecently) {
        const g7 = windowed(p, 7).growth;
        if (g7 == null || g7 < 10) return false;
      }
      return true;
    });
  const val = (p: EnrichedProduct): number | null =>
    f.sort === 'growth' ? (p.growthPct ?? null) : f.sort === 'profit' ? (p.insight.profit?.profit ?? null) : f.sort === 'margin' ? (p.insight.profit?.marginPct ?? null) : p.insight.score.score;
  // Sem dado vai para o fim, independentemente da direção.
  return out.sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  });
}

export function activeFilterCount(f: Filters) {
  const keys: (keyof Filters)[] = ['marketplace', 'category', 'priceMin', 'priceMax', 'costMax', 'profitMin', 'marginMin', 'growthMin', 'competition', 'updatedWithin', 'withSupplierLink', 'verifiedOnly', 'risingRecently'];
  return keys.filter((k) => f[k] !== DEFAULT_FILTERS[k]).length;
}

export function FilterPanel({ f, set, categories, hideMarketplace }: { f: Filters; set: (f: Filters) => void; categories: string[]; hideMarketplace?: boolean }) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(f);
  const up = <K extends keyof Filters>(k: K, v: Filters[K]) => set({ ...f, [k]: v });

  const body = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {!hideMarketplace && (
        <div>
          <Label htmlFor="f-mp">Marketplace</Label>
          <Select id="f-mp" value={f.marketplace} onChange={(e) => up('marketplace', e.target.value as Filters['marketplace'])}>
            <option value="all">Todos</option>
            {(['mercadolivre', 'tiktok', 'shopee', 'manual'] as Marketplace[]).map((m) => <option key={m} value={m}>{MARKETPLACE_LABEL[m]}</option>)}
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor="f-cat">Categoria</Label>
        <Select id="f-cat" value={f.category} onChange={(e) => up('category', e.target.value)}>
          <option value="">Todas</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>
      <div>
        <Label>Preço de venda (R$)</Label>
        <div className="flex gap-2">
          <Input aria-label="Preço mínimo" inputMode="decimal" placeholder="mín." value={f.priceMin} onChange={(e) => up('priceMin', e.target.value)} />
          <Input aria-label="Preço máximo" inputMode="decimal" placeholder="máx." value={f.priceMax} onChange={(e) => up('priceMax', e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="f-cost">Custo máximo no fornecedor</Label>
        <Input id="f-cost" inputMode="decimal" prefix="R$" value={f.costMax} onChange={(e) => up('costMax', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="f-profit">Lucro mínimo</Label>
        <Input id="f-profit" inputMode="decimal" prefix="R$" value={f.profitMin} onChange={(e) => up('profitMin', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="f-margin">Margem mínima</Label>
        <Input id="f-margin" inputMode="decimal" suffix="%" value={f.marginMin} onChange={(e) => up('marginMin', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="f-growth">Crescimento mínimo</Label>
        <Input id="f-growth" inputMode="decimal" suffix="%" value={f.growthMin} onChange={(e) => up('growthMin', e.target.value)} />
      </div>
      <div>
        <Label htmlFor="f-comp">Concorrência estimada</Label>
        <Select id="f-comp" value={f.competition} onChange={(e) => up('competition', e.target.value as Filters['competition'])}>
          <option value="all">Qualquer</option>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="f-upd">Última atualização</Label>
        <Select id="f-upd" value={f.updatedWithin} onChange={(e) => up('updatedWithin', e.target.value as Filters['updatedWithin'])}>
          <option value="all">Qualquer data</option>
          <option value="1">Últimas 24 horas</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </Select>
      </div>
      <div className="flex flex-col justify-end gap-2.5 sm:col-span-2 lg:col-span-3 lg:flex-row lg:items-center lg:gap-6">
        <Toggle id="f-link" checked={f.withSupplierLink} onChange={(v) => up('withSupplierLink', v)} label="Com link no DropSeller" />
        <Toggle id="f-ver" checked={f.verifiedOnly} onChange={(v) => up('verifiedOnly', v)} label="Somente dados verificados (fonte oficial)" />
        <Toggle id="f-rise" checked={f.risingRecently} onChange={(v) => up('risingRecently', v)} label="Em alta recentemente (+10% em 7 dias)" />
      </div>
    </div>
  );

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={open ? 'primary' : 'secondary'} size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros {count > 0 && <span className="rounded bg-black/20 px-1">{count}</span>}
        </Button>
        <Select aria-label="Ordenar" className="h-8 w-auto text-xs" value={f.sort} onChange={(e) => up('sort', e.target.value as SortKey)}>
          <option value="score">Melhor indicador de oportunidade</option>
          <option value="growth">Maior crescimento</option>
          <option value="profit">Maior lucro estimado</option>
          <option value="margin">Maior margem</option>
        </Select>
        <Select aria-label="Período da tendência" className="h-8 w-auto text-xs" value={f.days} onChange={(e) => up('days', e.target.value as Filters['days'])}>
          <option value="7">Tendência: 7 dias</option>
          <option value="30">Tendência: 30 dias</option>
          <option value="90">Tendência: 90 dias</option>
        </Select>
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => set({ ...DEFAULT_FILTERS, sort: f.sort, days: f.days })}>
            <X className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>
      {open && <div className="mt-3 rounded-xl border border-line bg-surface p-4 animate-fade-in">{body}</div>}
    </div>
  );
}

export function useCategories(items: EnrichedProduct[] | undefined) {
  return useMemo(() => [...new Set((items ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [items]);
}
