import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { brand, portfolio } from '../config/site';
import { track } from '../lib/analytics';
import { InstagramIcon } from './BrandIcons';

function Lightbox({ index, onClose, onMove }: { index: number; onClose: () => void; onMove: (d: number) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const item = portfolio[index];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onMove(1);
      if (e.key === 'ArrowLeft') onMove(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onMove]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-label={`Foto ${index + 1} de ${portfolio.length}`}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-onyx/95 p-0 text-paper backdrop:bg-onyx/80"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) onMove(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex h-full flex-col items-center justify-center p-4 sm:p-10">
        <img src={item.src} width={item.width} height={item.height} alt={item.alt} className="max-h-[80dvh] w-auto object-contain" />
        <p className="mt-4 text-center text-sm text-muted-dark">{item.alt}</p>
      </div>
      <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="absolute top-3 right-3 inline-flex size-12 items-center justify-center">
        <X strokeWidth={1.25} className="size-7" />
      </button>
      {portfolio.length > 1 && (
        <>
          <button type="button" onClick={() => onMove(-1)} aria-label="Foto anterior" className="absolute top-1/2 left-2 inline-flex size-12 -translate-y-1/2 items-center justify-center">
            <ChevronLeft strokeWidth={1.25} className="size-8" />
          </button>
          <button type="button" onClick={() => onMove(1)} aria-label="Próxima foto" className="absolute top-1/2 right-2 inline-flex size-12 -translate-y-1/2 items-center justify-center">
            <ChevronRight strokeWidth={1.25} className="size-8" />
          </button>
        </>
      )}
    </dialog>
  );
}

export function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + portfolio.length) % portfolio.length)), []);
  const hasPhotos = portfolio.length > 0;

  return (
    <section id="trabalhos" aria-labelledby="galeria-titulo" className="py-20 sm:py-28">
      <div className="wrap">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Trabalhos</p>
            <h2 id="galeria-titulo" className="h-section reveal mt-6 max-w-[16ch]">
              Penteados, produções <em className="accent">e detalhes.</em>
            </h2>
          </div>
          {hasPhotos && (
          <a
            href={brand.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('click_instagram', { cta_source: 'gallery' })}
            className="btn-ghost self-start sm:self-auto"
          >
            <InstagramIcon className="size-4" />
            <span className="sm:hidden">Ver no Instagram</span>
            <span className="hidden sm:inline">@{brand.instagramHandle}</span>
          </a>
          )}
        </div>

        {hasPhotos ? (
          <ul className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {portfolio.map((p, i) => (
              <li key={p.src} className={`w-[78vw] shrink-0 snap-center sm:w-auto ${i % 5 === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(i);
                    track('view_gallery_photo', { category: p.category ?? 'geral' });
                  }}
                  className="group block h-full w-full overflow-hidden bg-sand"
                  aria-label={`Ampliar foto: ${p.alt}`}
                >
                  <img
                    src={p.src}
                    width={p.width}
                    height={p.height}
                    alt={p.alt}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/5] h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="reveal mt-12 grid gap-6 border border-line p-7 sm:p-10 lg:grid-cols-12 lg:items-center">
            <p className="display text-[1.6rem] leading-snug lg:col-span-8 sm:text-[1.9rem]">
              Os trabalhos reais da Nilcéia, de produções de noivas a cortes e penteados, ficam reunidos no Instagram do salão.
            </p>
            <div className="lg:col-span-4 lg:text-right">
              <a
                href={brand.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('click_instagram', { cta_source: 'gallery_empty' })}
                className="btn-primary w-full sm:w-auto"
              >
                <InstagramIcon className="size-4" />
                <span>Ver trabalhos no Instagram</span>
              </a>
            </div>
          </div>
        )}
      </div>
      {open !== null && hasPhotos && <Lightbox index={open} onClose={() => setOpen(null)} onMove={move} />}
    </section>
  );
}
