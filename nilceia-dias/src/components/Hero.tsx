import { ArrowDown, MapPin } from 'lucide-react';
import { brand, facts } from '../config/site';
import type { PageConfig } from '../config/pages';
import { photos } from '../lib/photos';
import { Accent, WhatsAppLink } from './ui';

export function Hero({ page }: { page: PageConfig }) {
  const { hero } = page;
  const photo = photos[hero.photo];
  const proofs = [facts.years, facts.brides].filter((f) => f.show);

  return (
    <section id="topo" aria-labelledby="hero-titulo" className="relative overflow-hidden pt-16 lg:pt-[4.5rem]">
      <div className="wrap relative grid gap-10 pt-8 pb-12 sm:pt-12 lg:grid-cols-12 lg:gap-12 lg:pt-16 lg:pb-24">
        <div className="lg:col-span-7 lg:pt-6">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 id="hero-titulo" className="h-hero mt-5 max-w-[13ch] sm:mt-7">
            <Accent text={hero.headline} accent={hero.accent} />
          </h1>
          <p className="lead mt-5 max-w-[34rem] sm:mt-7">{hero.sub}</p>

          <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center sm:gap-6">
            <WhatsAppLink intent={hero.intent} source="hero" className="btn-primary w-full sm:w-auto">
              {hero.cta}
            </WhatsAppLink>
            <a href={hero.secondary.href} className="link-arrow justify-center sm:justify-start">
              {hero.secondary.label}
              <ArrowDown strokeWidth={1.5} className="size-4" aria-hidden="true" />
            </a>
          </div>

          {proofs.length > 0 && (
            <dl className="mt-9 flex items-stretch gap-6 border-t border-line pt-6 sm:mt-12 sm:gap-10">
              {proofs.map((f, i) => (
                <div key={f.label} className={`flex flex-col ${i > 0 ? 'border-l border-line pl-6 sm:pl-10' : ''}`}>
                  <dt className="order-2 mt-1 text-[0.68rem] font-semibold tracking-[0.18em] text-muted uppercase">{f.label}</dt>
                  <dd className="display order-1 text-[2rem] leading-none sm:text-[2.6rem]">{f.value}</dd>
                </div>
              ))}
              <div className="hidden flex-col border-l border-line pl-10 sm:flex">
                <dt className="order-2 mt-1 text-[0.68rem] font-semibold tracking-[0.18em] text-muted uppercase">no Casamentos.com.br</dt>
                <dd className="display order-1 text-[2.6rem] leading-none">{brand.casamentos.rating}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="relative lg:col-span-5">
          <div className="relative mx-auto max-w-[26rem] lg:mr-0 lg:ml-auto">
            <span aria-hidden="true" className="arch absolute -inset-3 border border-gold/50 sm:-inset-4" />
            <picture>
              <img
                src={photo.src}
                srcSet={'srcSet' in photo ? photo.srcSet : undefined}
                sizes="(min-width: 1024px) 420px, 90vw"
                width={photo.width}
                height={photo.height}
                alt={photo.alt}
                fetchPriority="high"
                decoding="async"
                className="arch relative aspect-[13/20] w-full object-cover"
              />
            </picture>
            <p className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 bg-onyx px-4 py-2.5 text-[0.65rem] font-semibold tracking-[0.22em] whitespace-nowrap text-champagne uppercase">
              <MapPin strokeWidth={1.5} className="size-3.5 text-gold" aria-hidden="true" />
              {brand.address.neighborhood.replace('Parque Residencial ', '')} · {brand.cityLabel}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
