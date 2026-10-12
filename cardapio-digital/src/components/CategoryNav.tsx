import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Category } from '../types/menu';

interface Props {
  categories: Category[];
  active: string | null;
  query: string;
  onQueryChange: (q: string) => void;
}

/** Barra fixa com busca e atalhos para as categorias. */
export function CategoryNav({ categories, active, query, onQueryChange }: Props) {
  const scroller = useRef<HTMLUListElement>(null);

  // Mantém a categoria ativa visível na faixa horizontal (sem rolar a página).
  useEffect(() => {
    const list = scroller.current;
    const chip = active ? list?.querySelector<HTMLElement>(`[data-category="${active}"]`) : null;
    if (!list || !chip) return;
    const target = chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2;
    list.scrollTo({ left: target, behavior: 'smooth' });
  }, [active]);

  return (
    <nav aria-label="Categorias do cardápio" className="sticky top-0 z-30 border-b border-line bg-bg/92 backdrop-blur-md">
      <div className="container-menu py-2.5">
        <label className="relative block">
          <span className="sr-only">Buscar no cardápio</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar prato ou bebida"
            className="h-11 w-full rounded-full bg-surface pr-11 pl-10 text-[16px] ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-line"
              aria-label="Limpar busca"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </label>

        {!query && categories.length > 1 && (
          <ul ref={scroller} className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            {categories.map((c) => {
              const isActive = c.id === active;
              return (
                <li key={c.id} className="shrink-0">
                  <a
                    href={`#${c.id}`}
                    data-category={c.id}
                    aria-current={isActive ? 'true' : undefined}
                    className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition ${
                      isActive ? 'bg-brand text-brand-contrast' : 'bg-surface text-ink ring-1 ring-line hover:ring-brand'
                    }`}
                  >
                    {c.name}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
