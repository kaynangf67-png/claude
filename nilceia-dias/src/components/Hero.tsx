import { ArrowDown, MapPin, Star } from 'lucide-react';
import { brand, facts } from '../config/site';
import type { PageConfig } from '../config/pages';
import { photos } from '../lib/photos';
import { Accent, WhatsAppLink } from './ui';

/**
 * Hero em tela cheia com foto ao fundo e texto centralizado (estrutura do modelo).
 * A foto atual é ilustrativa; quando houver uma foto real do salão em alta
 * resolução (mín. 1920 px de largura), troque `photos.fios` em src/lib/photos.ts.
 */
export function Hero({ page }: { page: PageConfig }) {
  const { hero } = page;
  const photo = photos[hero.photo];
  const proofs = [facts.years, facts.brides].filter((f) => f.show);
  const hasCards = page.sections[0] === 'identification';

  return (
    <section
      id="topo"
      aria-labelledby="hero-titulo"
      className={`on-dark relative isolate flex min-h-[86svh] items-center overflow-hidden bg-onyx text-paper ${hasCards ? 'pb-28 sm:pb-36' : 'pb-16'} pt-28 sm:pt-32`}
    >
      <img
        src={photo.src}
        srcSet={'srcSet' in photo ? photo.srcSet : undefined}
        sizes="100vw"
        width={photo.width}
        height={photo.height}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(26_26_26/0.55)_0%,rgb(26_26_26/0.62)_55%,rgb(26_26_26/0.85)_100%)]" />

      <div className="wrap flex flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.12em] whitespace-nowrap text-gold uppercase sm:tracking-[0.24em]">
          <MapPin aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
          {hero.eyebrow}
        </p>
        <h1 id="hero-titulo" className="h-hero mt-6 max-w-[16ch] text-paper">
          <Accent text={hero.headline} accent={hero.accent} />
        </h1>
        <p className="mt-6 max-w-[36rem] text-[1rem] leading-[1.7] text-paper/85 sm:text-[1.1rem]">{hero.sub}</p>

        <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <WhatsAppLink intent={hero.intent} source="hero" className="btn-light w-full sm:w-auto">
            {hero.cta}
          </WhatsAppLink>
          <a href={hero.secondary.href} className="btn w-full border border-paper/35 text-paper hover:bg-paper/10 sm:w-auto">
            {hero.secondary.label}
            <ArrowDown strokeWidth={1.5} className="size-4" aria-hidden="true" />
          </a>
        </div>

        <dl className="mt-10 grid w-full max-w-md grid-cols-3 gap-2 text-[0.72rem] leading-tight tracking-[0.06em] text-paper/80 uppercase sm:flex sm:w-auto sm:max-w-none sm:gap-x-9 sm:text-[0.72rem] sm:tracking-[0.14em]">
          {proofs.map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1 sm:flex-row sm:items-baseline sm:gap-2">
              <dt className="sr-only">{f.label}</dt>
              <dd className="text-[1.35rem] tracking-[-0.02em] text-paper normal-case">{f.value}</dd>
              <span aria-hidden="true" className="text-center">{f.label}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
            <dt className="sr-only">Avaliação no Casamentos.com.br</dt>
            <dd className="flex items-center gap-1.5 text-[1.35rem] tracking-[-0.02em] text-paper normal-case">
              <Star aria-hidden="true" className="size-4 fill-gold text-gold" />
              {brand.casamentos.rating}
            </dd>
            <span aria-hidden="true" className="text-center">
              <span className="sm:hidden">Casamentos</span>
              <span className="hidden sm:inline">Casamentos.com.br</span>
            </span>
          </div>
        </dl>
      </div>
    </section>
  );
}
