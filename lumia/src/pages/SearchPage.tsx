import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { CatalogItem } from '@/types/content';
import { catalog } from '@/services/catalogService';
import { MovieGrid } from '@/components/MovieGrid';
import { Footer } from '@/components/Footer';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [items, setItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    catalog.list(q ? { q } : {}).then(setItems);
  }, [q]);
  return (
    <main className="page" id="conteudo">
      <div className="container">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get('q') as string;
            setParams(v ? { q: v } : {});
          }}
          style={{ display: 'flex', gap: 10, margin: '6px 0 26px', maxWidth: 680 }}
        >
          <input className="input" name="q" defaultValue={q} key={q} placeholder="Busque por título, gênero, elenco, país…" aria-label="Buscar" autoFocus />
          <button className="btn btn-primary" type="submit" aria-label="Buscar">
            <Search size={18} />
          </button>
        </form>
        <p className="muted" style={{ marginBottom: 18 }}>
          {q ? `${items.length} resultado(s) para “${q}”` : 'Todo o catálogo'}
        </p>
        <MovieGrid items={items} empty="Nada encontrado. Tente “suspense”, “Japão” ou “Libras”." />
      </div>
      <Footer />
    </main>
  );
}
