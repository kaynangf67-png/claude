import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { gallery, gallerySlots, messages } from '../config/academia';
import { getPhoto, largestSrc, type PhotoInfo } from '../lib/photos';
import { ContactLink, Photo, SectionHeader } from './ui';

// Mosaico: a 1ª foto ocupa 2×2, as demais se encaixam ao redor (desktop).
const spans = [
  'col-span-2 lg:row-span-2',
  'lg:col-span-2',
  '',
  '',
  'lg:col-span-2',
  'col-span-2 lg:col-span-2',
];

export function Gallery() {
  const items = gallery
    .map((g) => ({ ...g, photo: getPhoto(g.file) }))
    .filter((g): g is { file: string; alt: string; photo: PhotoInfo } => g.photo !== null);
  const [index, setIndex] = useState<number | null>(null);

  return (
    <section id="estrutura" aria-labelledby="estrutura-title" className="section bg-ink-900">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeader
            id="estrutura-title"
            eyebrow="Estrutura"
            title={
              <>
                Conheça a <span className="text-accent">Transformers</span>
              </>
            }
            lead="Um espaço preparado para fazer parte da sua rotina de treino."
          />
          <div className="reveal shrink-0">
            <ContactLink message={messages.visit} cta="estrutura" arrow className="btn btn-ghost w-full sm:w-auto">
              Quero conhecer a academia
            </ContactLink>
          </div>
        </div>

        <ul className="mt-14 grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:gap-4 lg:auto-rows-[240px] lg:grid-cols-4">
          {items.length > 0
            ? items.map((item, i) => (
                <li
                  key={item.file}
                  className={`reveal ${spans[i % spans.length]}`}
                  style={{ ['--d' as string]: `${(i % 4) * 70}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className="group relative block h-full w-full overflow-hidden rounded-2xl bg-ink-800"
                    aria-label={`Ampliar foto: ${item.alt}`}
                  >
                    <Photo
                      photo={item.photo}
                      alt={item.alt}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      imgClassName="zoom-img"
                      className="absolute inset-0"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <Expand className="absolute right-4 bottom-4 size-5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  </button>
                </li>
              ))
            : gallerySlots.map((label, i) => (
                <li
                  key={label}
                  className={`reveal ${spans[i]}`}
                  style={{ ['--d' as string]: `${(i % 4) * 70}ms` }}
                >
                  {/* Espaço reservado: aparece até as fotos reais serem adicionadas em src/config/academia.ts */}
                  <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-white/15 bg-ink-850 p-5">
                    <div className="grid-lines absolute inset-0 opacity-50" aria-hidden />
                    <Camera className="relative size-6 text-brand-500" aria-hidden />
                    <div className="relative">
                      <p className="text-base leading-tight font-bold uppercase [font-stretch:110%] sm:text-lg">{label}</p>
                      <p className="mt-1 text-xs text-mist-400">Espaço para foto real da academia</p>
                    </div>
                  </div>
                </li>
              ))}
        </ul>
      </div>

      {items.length > 0 && <Lightbox items={items} index={index} onChange={setIndex} />}
    </section>
  );
}

interface LightboxProps {
  items: { alt: string; photo: PhotoInfo }[];
  index: number | null;
  onChange: (i: number | null) => void;
}

function Lightbox({ items, index, onChange }: LightboxProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const go = useCallback(
    (step: number) => index !== null && onChange((index + step + items.length) % items.length),
    [index, items.length, onChange],
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go]);

  const item = index !== null ? items[index] : null;

  return (
    <dialog
      ref={ref}
      onClose={() => onChange(null)}
      onClick={(e) => e.target === e.currentTarget && onChange(null)}
      className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-ink-950/95 backdrop:backdrop-blur-sm"
      aria-label="Galeria de fotos"
    >
      {item && (
        <div className="flex h-[100svh] w-screen flex-col items-center justify-center gap-4 p-4">
          <img
            src={largestSrc(item.photo)}
            alt={item.alt}
            className="max-h-[80svh] max-w-full rounded-xl object-contain"
          />
          <p className="max-w-2xl text-center text-sm text-mist-300">{item.alt}</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => go(-1)} className="btn btn-ghost min-h-12 px-4" aria-label="Foto anterior">
              <ChevronLeft className="size-5" />
            </button>
            <span className="w-16 text-center text-sm text-mist-400 tabular-nums">
              {index! + 1} / {items.length}
            </span>
            <button type="button" onClick={() => go(1)} className="btn btn-ghost min-h-12 px-4" aria-label="Próxima foto">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-4 right-4 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Fechar galeria"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </dialog>
  );
}
