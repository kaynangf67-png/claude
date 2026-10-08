import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogItem } from '@/types/content';
import { MovieCard } from './MovieCard';

export function MovieRow({ title, items, more, wide = false, id }: { title: string; items: CatalogItem[]; more?: string; wide?: boolean; id?: string }) {
  const track = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' });
  return (
    <section className={`row ${wide ? 'row-wide' : ''}`} aria-labelledby={id ?? title}>
      <div className="row-head">
        <h2 className="section-title" id={id ?? title}>
          {title}
        </h2>
        {more && <Link to={more}>Ver tudo</Link>}
      </div>
      <div className="row-track-wrap">
        <button className="row-arrow left" aria-label="Rolar para a esquerda" onClick={() => scroll(-1)}>
          <ChevronLeft />
        </button>
        <div className="row-track" ref={track}>
          {items.map((i) => (
            <MovieCard key={i.id} item={i} wide={wide} />
          ))}
        </div>
        <button className="row-arrow right" aria-label="Rolar para a direita" onClick={() => scroll(1)}>
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}

export function MovieGrid({ items, empty = 'Nada por aqui ainda.' }: { items: CatalogItem[]; empty?: string }) {
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <div className="grid">
      {items.map((i) => (
        <MovieCard key={i.id} item={i} />
      ))}
    </div>
  );
}
