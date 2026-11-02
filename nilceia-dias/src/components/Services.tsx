import { ArrowRight } from 'lucide-react';
import { services, type ServiceCategory } from '../config/site';
import type { CtaSource } from '../lib/analytics';
import { photos, type PhotoKey } from '../lib/photos';
import { useViewEvent } from '../hooks/useReveal';
import { WhatsAppLink } from './ui';

const SOURCE: Record<ServiceCategory['id'], CtaSource> = {
  noivas: 'brides',
  cabelos: 'hair',
  tratamentos: 'treatments',
  make: 'makeup',
};

const PHOTO: Record<ServiceCategory['id'], PhotoKey> = { noivas: 'tranca', cabelos: 'cabelos', tratamentos: 'ondas', make: 'make' };

function ServiceCard({ s, heroPhoto, hasBrides }: { s: ServiceCategory; heroPhoto: PhotoKey; hasBrides: boolean }) {
  const ref = useViewEvent<HTMLElement>('view_service', { category: s.id });
  // Nunca repetir na mesma página a foto do hero.
  const photo = photos[PHOTO[s.id] === heroPhoto ? 'fios' : PHOTO[s.id]];
  const toBrides = s.id === 'noivas' && hasBrides;

  return (
    <article ref={ref} id={`servico-${s.id}`} className="reveal group flex flex-col">
      <div className="overflow-hidden rounded-2xl bg-sand">
        <img
          src={photo.src}
          srcSet={'srcSet' in photo ? photo.srcSet : undefined}
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 92vw"
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <p className="mt-5 text-[0.66rem] font-semibold tracking-[0.22em] text-gold-ink uppercase">{s.name}</p>
      <h3 className="mt-2 text-[1.25rem] leading-snug tracking-[-0.015em]">{s.headline}</h3>
      <p className="mt-2 text-[0.94rem] leading-relaxed text-muted">{s.description}</p>
      {s.items.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {s.items.map((it) => (
            <li key={it} className="rounded-full border border-line px-3 py-1 text-[0.75rem] text-muted">
              {it}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-4">
        {toBrides ? (
          <a href="#noivas" className="link-arrow">
            {s.cta} <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </a>
        ) : (
          <WhatsAppLink intent={s.intent} source={SOURCE[s.id]} category={s.id} ctaId={`servico-${s.id}`} className="link-arrow" icon={false}>
            {s.cta} →
          </WhatsAppLink>
        )}
      </div>
    </article>
  );
}

export function Services({ heroPhoto, hasBrides }: { heroPhoto: PhotoKey; hasBrides: boolean }) {
  const enabled = services.filter((s) => s.enabled);

  return (
    <section id="servicos" aria-labelledby="servicos-titulo" className="py-20 sm:py-28">
      <div className="wrap">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow justify-center before:hidden">Serviços</p>
          <h2 id="servicos-titulo" className="h-section reveal mt-4">
            Cuidado para cada fase, <em className="accent">cada ocasião.</em>
          </h2>
          <p className="lead reveal mt-5">
            Valores e disponibilidade variam conforme o serviço. Escolha o que procura e a conversa já começa no assunto certo.
          </p>
        </div>

        <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {enabled.map((s) => (
            <ServiceCard key={s.id} s={s} heroPhoto={heroPhoto} hasBrides={hasBrides} />
          ))}
        </div>
      </div>
    </section>
  );
}
