import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useCatalog } from '@/state/hooks';
import { ProductCollection } from '@/components/ProductCollection';
import { Button, EmptyState, ErrorState, PageHeader } from '@/components/ui';

export default function Favorites() {
  const catalog = useCatalog();
  const items = catalog.favorites
    .map((id) => catalog.data?.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  return (
    <div>
      <PageHeader eyebrow="Lista pessoal" title="Favoritos" description="Sua lista de oportunidades. Do cartão você já chega ao fornecedor." />
      {catalog.error ? <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} className="mb-4" /> : null}
      <ProductCollection
        items={items}
        loading={catalog.isLoading}
        empty={
          <EmptyState
            icon={<Heart className="h-5 w-5" />}
            title="Nenhum favorito ainda"
            description="Toque no coração de qualquer produto para guardá-lo aqui."
            action={<Link to="/em-alta"><Button variant="primary">Explorar produtos</Button></Link>}
          />
        }
      />
    </div>
  );
}
