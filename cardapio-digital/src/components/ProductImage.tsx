import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { asset } from '../lib/url';

interface Props {
  src?: string;
  alt: string;
  className?: string;
}

/** Foto do produto ou placeholder neutro quando a foto falta ou não carrega. */
export function ProductImage({ src, alt, className = '' }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-soft text-brand/45 ${className}`}
        role="img"
        aria-label="Foto indisponível"
      >
        <UtensilsCrossed className="size-7" strokeWidth={1.5} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={asset(src)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
