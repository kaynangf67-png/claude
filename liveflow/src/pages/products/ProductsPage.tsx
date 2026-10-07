import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, Copy, Eye, MoreHorizontal, Package, Pause, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/page';
import { ProductImage } from '@/components/app/media';
import { ProductStatusBadge } from '@/components/app/status';
import { ProductDialog } from '@/components/app/product-dialog';
import { CATEGORIES } from '@/components/app/product-form';
import { useConfirm } from '@/components/app/confirm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton, Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useServices } from '@/contexts/services';
import { qk, useAction, useAnalytics, usePlan, useProducts } from '@/hooks/queries';
import { formatCurrency, formatNumber } from '@/lib/format';
import { computeTotals, presetToRange } from '@/services/analytics';
import { groupBy } from '@/lib/utils';
import type { Product, ProductStatus } from '@/types/domain';

type StatusFilter = ProductStatus | 'all';
type SortKey = 'recent' | 'name' | 'price' | 'revenue';

function ProductActions({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const services = useServices();
  const plan = usePlan();
  const navigate = useNavigate();
  const [confirm, confirmNode] = useConfirm();
  const duplicate = useAction(() => services.products.duplicate(product.id, plan), { invalidate: [qk.products], success: 'Produto duplicado' });
  const setStatus = useAction((s: ProductStatus) => services.products.setStatus(product.id, s), { invalidate: [qk.products], success: 'Status atualizado' });
  const remove = useAction(() => services.products.remove(product.id), { invalidate: [qk.products, qk.videos, qk.lives, ['analytics']], success: 'Produto excluído' });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${product.name}`} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => navigate(`/produtos/${product.id}`)}>
            <Eye /> Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicate.mutate(undefined)}>
            <Copy /> Duplicar
          </DropdownMenuItem>
          {product.status === 'active' ? (
            <DropdownMenuItem onSelect={() => setStatus.mutate('paused')}>
              <Pause /> Pausar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setStatus.mutate('active')}>
              <Play /> Ativar
            </DropdownMenuItem>
          )}
          {product.status !== 'archived' && (
            <DropdownMenuItem onSelect={() => setStatus.mutate('archived')}>
              <Archive /> Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={async () => {
              const ok = await confirm({
                title: `Excluir "${product.name}"?`,
                description: 'Vídeos e lives continuam existindo, mas perdem o vínculo com este produto. As métricas dele serão apagadas.',
                confirmLabel: 'Excluir',
                destructive: true,
              });
              if (ok) remove.mutate(undefined);
            }}
          >
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmNode}
    </>
  );
}

export default function ProductsPage() {
  const products = useProducts();
  const range = useMemo(() => presetToRange('30d'), []);
  const analytics = useAnalytics(range);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [dialog, setDialog] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });

  const revenueBy = useMemo(() => {
    const groups = groupBy(analytics.data ?? [], (r) => r.product_id);
    return new Map([...groups].map(([id, rows]) => [id, computeTotals(rows)]));
  }, [analytics.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (products.data ?? []).filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)),
    );
    const sorters: Record<SortKey, (a: Product, b: Product) => number> = {
      recent: (a, b) => b.created_at.localeCompare(a.created_at),
      name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
      price: (a, b) => Number(b.promo_price ?? b.price) - Number(a.promo_price ?? a.price),
      revenue: (a, b) => (revenueBy.get(b.id)?.revenue ?? 0) - (revenueBy.get(a.id)?.revenue ?? 0),
    };
    return [...list].sort(sorters[sort]);
  }, [products.data, query, status, category, sort, revenueBy]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, active: 0, paused: 0, archived: 0 };
    for (const p of products.data ?? []) {
      c.all++;
      c[p.status]++;
    }
    return c;
  }, [products.data]);

  const openNew = () => setDialog({ open: true, product: null });
  const openEdit = (product: Product) => setDialog({ open: true, product });

  return (
    <div className="animate-in">
      <PageHeader
        title="Produtos"
        description="Catálogo que você divulga nas lives e vídeos."
        actions={
          <Button onClick={openNew}>
            <Plus /> Novo produto
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {(['all', 'active', 'paused', 'archived'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${status === s ? 'border-transparent bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              {{ all: 'Todos', active: 'Ativos', paused: 'Pausados', archived: 'Arquivados' }[s]} <span className="opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou SKU" className="pl-9" aria-label="Buscar produtos" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria" className="sm:w-40">
              <option value="">Todas categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar" className="sm:w-40">
              <option value="recent">Mais recentes</option>
              <option value="revenue">Maior faturamento</option>
              <option value="price">Maior preço</option>
              <option value="name">Nome (A–Z)</option>
            </NativeSelect>
          </div>
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (products.data ?? []).length === 0 ? (
        <EmptyState icon={Package} title="Nenhum produto cadastrado" description="Cadastre o primeiro produto para associar a vídeos e lives." action={<Button onClick={openNew}><Plus /> Novo produto</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Ajuste a busca ou os filtros." />
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Produto</TH>
                  <TH>Categoria</TH>
                  <TH className="text-right">Preço</TH>
                  <TH className="text-right">Comissão</TH>
                  <TH className="text-right">Vendas (30d)</TH>
                  <TH className="text-right">Faturamento (30d)</TH>
                  <TH>Status</TH>
                  <TH className="w-10" />
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => {
                  const t = revenueBy.get(p.id);
                  return (
                    <TR key={p.id} className="cursor-pointer" onClick={() => navigate(`/produtos/${p.id}`)}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <ProductImage product={p} className="size-10" />
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.sku ?? 'Sem SKU'}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-muted-foreground">{p.category || '—'}</TD>
                      <TD className="tabular text-right">
                        {p.promo_price != null ? (
                          <div>
                            <p className="font-medium">{formatCurrency(Number(p.promo_price))}</p>
                            <p className="text-xs text-muted-foreground line-through">{formatCurrency(Number(p.price))}</p>
                          </div>
                        ) : (
                          formatCurrency(Number(p.price))
                        )}
                      </TD>
                      <TD className="tabular text-right">{Number(p.commission_rate)}%</TD>
                      <TD className="tabular text-right">{formatNumber(t?.units ?? 0)}</TD>
                      <TD className="tabular text-right font-medium">{formatCurrency(t?.revenue ?? 0)}</TD>
                      <TD>
                        <ProductStatusBadge status={p.status} />
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <ProductActions product={p} onEdit={() => openEdit(p)} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          {/* Mobile: cartões */}
          <div className="grid gap-2 md:hidden">
            {filtered.map((p) => {
              const t = revenueBy.get(p.id);
              return (
                <Card key={p.id} className="flex items-center gap-3 p-3">
                  <Link to={`/produtos/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <ProductImage product={p} className="size-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="tabular text-sm">
                        {formatCurrency(Number(p.promo_price ?? p.price))} <span className="text-xs text-muted-foreground">· {Number(p.commission_rate)}%</span>
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <ProductStatusBadge status={p.status} />
                        <span className="text-[11px] text-muted-foreground">{formatCurrency(t?.revenue ?? 0)} em 30d</span>
                      </div>
                    </div>
                  </Link>
                  <ProductActions product={p} onEdit={() => openEdit(p)} />
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ProductDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} product={dialog.product} />
    </div>
  );
}
