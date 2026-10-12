import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { menu } from 'virtual:menu';
import type { Product } from './types/menu';
import { buildSections, normalize } from './lib/menu';
import { menuUrl } from './lib/url';
import { Hero } from './components/Hero';
import { CategoryNav } from './components/CategoryNav';
import { ProductCard } from './components/ProductCard';
import { ImageDialog } from './components/ImageDialog';
import { InfoSection } from './components/InfoSection';
import { ShareSection } from './components/ShareSection';

/** Pendentes aparecem em dev e na prévia para o dono. Em 'live'/'demo' de produção nem chegam ao bundle. */
const INCLUDE_PENDING = import.meta.env.DEV || menu.stage === 'preview';

const STAGE_NOTICE: Record<string, string> = {
  demo: 'Cardápio de demonstração · dados fictícios',
  preview: 'Prévia para aprovação · preços e itens ainda não confirmados pelo restaurante',
};

export default function App() {
  const sections = useMemo(() => buildSections(menu, INCLUDE_PENDING), []);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(sections[0]?.category.id ?? null);
  const [zoomed, setZoomed] = useState<Product | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>(undefined);
  const url = useMemo(() => menuUrl(menu.restaurant.publicUrl), []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copiado');
    } catch {
      notify(`Copie o link: ${url}`);
    }
  }, [url, notify]);

  const share = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Cardápio · ${menu.restaurant.name}`, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    copy();
  }, [url, copy]);

  // Destaca a categoria visível na barra de navegação.
  useEffect(() => {
    if (query) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-140px 0px -55% 0px' },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.category.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections, query]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return null;
    return sections.flatMap((s) =>
      s.products.filter((p) => normalize(`${p.name} ${p.description ?? ''} ${s.category.name}`).includes(q)),
    );
  }, [query, sections]);

  return (
    <>
      {STAGE_NOTICE[menu.stage] && (
        <div role="note" className="bg-ink px-4 py-2 text-center text-xs font-medium text-bg">
          {STAGE_NOTICE[menu.stage]}
        </div>
      )}

      <Hero restaurant={menu.restaurant} onShare={share} />

      <CategoryNav
        categories={sections.map((s) => s.category)}
        active={active}
        query={query}
        onQueryChange={setQuery}
      />

      <main id="cardapio" className="container-menu pt-8 pb-16">
        {results ? (
          <section aria-live="polite">
            <h2 className="text-sm font-semibold text-muted">
              {results.length === 0
                ? `Nenhum item encontrado para “${query}”.`
                : `${results.length} ${results.length === 1 ? 'item encontrado' : 'itens encontrados'}`}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 md:gap-4">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} onOpenImage={setZoomed} />
              ))}
            </div>
          </section>
        ) : sections.length === 0 ? (
          <p className="py-16 text-center text-muted">Cardápio em atualização.</p>
        ) : (
          sections.map(({ category, products }) => (
            <section
              key={category.id}
              id={category.id}
              aria-labelledby={`${category.id}-titulo`}
              className="scroll-mt-32 pt-6 first:pt-0 sm:pt-10"
            >
              <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
                <div>
                  <h2 id={`${category.id}-titulo`} className="font-display text-2xl font-semibold sm:text-3xl">
                    {category.name}
                  </h2>
                  {category.description && <p className="mt-1 text-sm text-muted">{category.description}</p>}
                </div>
                <span className="shrink-0 pb-1 text-xs font-medium text-muted">
                  {products.length} {products.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 md:gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} onOpenImage={setZoomed} />
                ))}
              </div>
            </section>
          ))
        )}

        {menu.restaurant.menuNotes && menu.restaurant.menuNotes.length > 0 && (
          <ul className="mt-12 space-y-1 text-xs leading-relaxed text-muted">
            {menu.restaurant.menuNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </main>

      <InfoSection config={menu} />
      <ShareSection url={url} restaurantName={menu.restaurant.name} onShare={share} onCopy={copy} />

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} {menu.restaurant.name} · Cardápio digital por Web Company
      </footer>

      <ImageDialog product={zoomed} onClose={() => setZoomed(null)} />

      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-5 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg shadow-lg transition ${
          toast ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        {toast}
      </div>
    </>
  );
}
