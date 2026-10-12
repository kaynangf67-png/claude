import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Product } from '../types/menu';
import { Price } from './Price';
import { ProductImage } from './ProductImage';

interface Props {
  product: Product | null;
  onClose: () => void;
}

/** Foto ampliada do produto. <dialog> nativo: Esc fecha e o foco fica preso. */
export function ImageDialog({ product, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (product && !dialog.open) dialog.showModal();
    if (!product && dialog.open) dialog.close();
  }, [product]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="image-dialog-title"
      className="m-auto w-[min(92vw,560px)] overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-2xl"
    >
      {product && (
        <>
          <ProductImage
            src={product.image}
            alt={product.imageAlt ?? product.name}
            className="aspect-[4/3] w-full"
          />
          <div className="p-5">
            <h2 id="image-dialog-title" className="font-display text-xl font-semibold">
              {product.name}
            </h2>
            {product.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{product.description}</p>}
            <div className="mt-3">
              <Price prices={product.prices} size="lg" />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/70"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </>
      )}
    </dialog>
  );
}
