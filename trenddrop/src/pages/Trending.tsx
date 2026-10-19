import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Plus } from 'lucide-react';
import { useCatalog } from '@/state/hooks';
import { applyFilters, DEFAULT_FILTERS, FilterPanel, useCategories, type Filters } from '@/components/filters';
import { ManualProductModal } from '@/components/manual';
import { ProductCollection } from '@/components/ProductCollection';
import { Button, EmptyState, ErrorState, PageHeader } from '@/components/ui';

export default function Trending() {
  const catalog = useCatalog();
  const [f, setF] = useState<Filters>({ ...DEFAULT_FILTERS, sort: 'growth' });
  const [manual, setManual] = useState(false);
  const categories = useCategories(catalog.data);
  const items = applyFilters(catalog.data ?? [], f);
  const total = catalog.data?.length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Catálogo monitorado"
        title="Produtos em alta"
        description="Todos os produtos que você monitora, com filtros combináveis. O crescimento é calculado sobre a série do Google Trends vinculada a cada produto."
        actions={<Button onClick={() => setManual(true)}><Plus className="h-4 w-4" /> Cadastrar manualmente</Button>}
      />
      {catalog.error ? <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} className="mb-4" /> : null}
      <FilterPanel f={f} set={setF} categories={categories} />
      <ProductCollection
        items={items}
        loading={catalog.isLoading}
        days={Number(f.days)}
        empty={
          total === 0 ? (
            <EmptyState
              icon={<Flame className="h-5 w-5" />}
              title="Nenhum produto monitorado"
              description="Pesquise no Mercado Livre ou na Shopee e clique em Monitorar, ou cadastre manualmente um produto observado no TikTok Shop."
              action={<><Link to="/mercado-livre"><Button variant="primary">Pesquisar produtos</Button></Link><Button onClick={() => setManual(true)}>Cadastrar manualmente</Button></>}
            />
          ) : (
            <EmptyState title="Nenhum produto atende aos filtros" description="Afrouxe algum critério. Produtos sem o dado exigido por um filtro (ex.: custo, margem) ficam de fora." action={<Button onClick={() => setF({ ...DEFAULT_FILTERS, sort: f.sort, days: f.days })}>Limpar filtros</Button>} />
          )
        }
      />
      {manual && <ManualProductModal open={manual} onClose={() => setManual(false)} defaultMarketplace="manual" />}
    </div>
  );
}
