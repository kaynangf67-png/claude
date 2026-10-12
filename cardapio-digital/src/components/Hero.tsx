import { MapPin, Share2 } from 'lucide-react';
import type { Restaurant } from '../types/menu';
import { asset } from '../lib/url';

interface Props {
  restaurant: Restaurant;
  onShare: () => void;
}

export function Hero({ restaurant: r, onShare }: Props) {
  const hasImage = Boolean(r.heroImage);
  const city = [r.address?.neighborhood, r.address?.city].filter(Boolean).join(' · ') || null;

  return (
    <header className="relative isolate overflow-hidden bg-brand text-brand-contrast">
      {hasImage ? (
        <>
          <img
            src={asset(r.heroImage!)}
            alt={r.heroImageAlt ?? ''}
            className="absolute inset-0 -z-10 size-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.13]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 15%, currentColor 0 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, currentColor 0 1px, transparent 1.5px)',
            backgroundSize: '22px 22px, 34px 34px',
          }}
        />
      )}

      <div className={`container-menu flex flex-col pt-5 pb-10 sm:pb-14 ${hasImage ? 'min-h-[58svh] text-white sm:min-h-[440px]' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          {r.logo ? (
            <img
              src={asset(r.logo)}
              alt={r.logoAlt ?? `Logo ${r.name}`}
              className="h-12 w-auto max-w-[160px] object-contain sm:h-14"
            />
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onShare}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-current/12 px-4 text-sm font-semibold ring-1 ring-current/25 backdrop-blur transition hover:bg-current/20"
          >
            <Share2 className="size-4" aria-hidden="true" />
            Compartilhar
          </button>
        </div>

        <div className={hasImage ? 'mt-auto pt-16' : 'pt-12 sm:pt-16'}>
          {r.type && <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-80">{r.type}</p>}
          <h1 className="mt-2 font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-6xl">{r.name}</h1>
          {r.tagline && <p className="mt-3 max-w-xl text-base leading-relaxed opacity-90 sm:text-lg">{r.tagline}</p>}
          {city && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm opacity-85">
              <MapPin className="size-4" aria-hidden="true" />
              {city}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
