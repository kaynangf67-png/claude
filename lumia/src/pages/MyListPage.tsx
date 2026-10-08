import { useEffect, useState } from 'react';
import type { CatalogItem } from '@/types/content';
import { catalog } from '@/services/catalogService';
import { useApp } from '@/context/AppContext';
import { MovieGrid } from '@/components/MovieGrid';
import { Footer } from '@/components/Footer';

export default function MyListPage() {
  const { myList, favorites, notify } = useApp();
  const [items, setItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    catalog.list().then(setItems);
  }, []);
  const pick = (ids: string[]) => ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as CatalogItem[];
  return (
    <main className="page" id="conteudo">
      <div className="container">
        <p className="eyebrow">Sua coleção</p>
        <h1 className="serif" style={{ fontSize: 'clamp(40px,6vw,72px)', margin: '6px 0 26px' }}>
          Minha Lista
        </h1>
        <MovieGrid items={pick(myList)} empty="Use + em qualquer título para guardá-lo aqui." />
        <h2 className="section-title" id="favoritos" style={{ margin: '48px 0 16px' }}>
          Favoritos
        </h2>
        <MovieGrid items={pick(favorites)} empty="Toque no ♥ de um título para favoritá-lo." />
        {notify.length > 0 && (
          <>
            <h2 className="section-title" style={{ margin: '48px 0 16px' }}>
              Avise-me quando chegar
            </h2>
            <MovieGrid items={pick(notify)} />
          </>
        )}
      </div>
      <Footer />
    </main>
  );
}
