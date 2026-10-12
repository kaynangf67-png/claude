import type { PriceOption } from '../types/menu';
import { formatPrice } from '../lib/menu';

/** Preço único ou lista de variações (Pequena / Grande…). */
export function Price({ prices, size = 'md' }: { prices: PriceOption[]; size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-lg' : 'text-base';

  const value = (v: number | null) =>
    v === null ? (
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
        Precisa confirmar
      </span>
    ) : (
      formatPrice(v)
    );

  if (prices.length === 1 && !prices[0].label) {
    return <p className={`price font-semibold text-brand ${text}`}>{value(prices[0].value)}</p>;
  }

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1">
      {prices.map((p) => (
        <div key={p.label} className="flex items-baseline gap-1.5">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{p.label}</dt>
          <dd className={`price font-semibold text-brand ${text}`}>{value(p.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
