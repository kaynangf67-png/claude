import type { Product } from '../types/menu';
import { isPublishable } from '../lib/menu';
import { Price } from './Price';
import { ProductImage } from './ProductImage';

interface Props {
  product: Product;
  onOpenImage: (product: Product) => void;
}

export function ProductCard({ product, onOpenImage }: Props) {
  const unavailable = product.available === false;
  const pending = !isPublishable(product);
  const alt = product.imageAlt ?? product.name;

  return (
    <article
      id={`produto-${product.id}`}
      className={`relative flex gap-4 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-line sm:p-4 ${
        pending ? 'outline-2 outline-dashed outline-offset-2 outline-red-500' : ''
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          {product.badge && !unavailable && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-contrast">
              {product.badge}
            </span>
          )}
          {unavailable && (
            <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Indisponível
            </span>
          )}
          {pending && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Pendente · não vai ao ar
            </span>
          )}
        </div>
        <h3
          className={`mt-1 font-display text-lg leading-snug font-semibold text-pretty ${unavailable ? 'text-muted' : ''}`}
        >
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 text-sm leading-relaxed text-muted text-pretty">{product.description}</p>
        )}
        <div className={`mt-auto pt-3 ${unavailable ? 'opacity-60' : ''}`}>
          <Price prices={product.prices} />
        </div>
      </div>

      {product.image ? (
        <button
          type="button"
          onClick={() => onOpenImage(product)}
          className="relative size-24 shrink-0 overflow-hidden rounded-xl sm:size-28"
          aria-label={`Ampliar foto: ${product.name}`}
        >
          <ProductImage
            src={product.image}
            alt={alt}
            className={`size-full transition-transform duration-300 hover:scale-105 ${unavailable ? 'grayscale' : ''}`}
          />
        </button>
      ) : (
        // Placeholder só em desenvolvimento; em produção o card sem foto fica só com texto.
        import.meta.env.DEV && <ProductImage alt={alt} className="size-24 shrink-0 rounded-xl sm:size-28" />
      )}
    </article>
  );
}
