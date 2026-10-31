import { ArrowDown } from 'lucide-react';
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

const PHOTO: Record<string, PhotoKey> = { cabelos: 'cabelos', tratamentos: 'fios', make: 'make' };

function ServiceRow({ s, index, heroPhoto }: { s: ServiceCategory; index: number; heroPhoto: PhotoKey }) {
  const ref = useViewEvent<HTMLElement>('view_service', { category: s.id });
  // Nunca repetir na mesma página a foto usada no hero.
  const photo = photos[PHOTO[s.id] === heroPhoto ? 'tranca' : PHOTO[s.id]];
  const flip = index % 2 === 1;

  return (
    <article ref={ref} id={`servico-${s.id}`} className="reveal grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-12 lg:gap-16 lg:py-20">
      <div className={`lg:col-span-6 ${flip ? 'lg:order-2 lg:col-start-7' : ''}`}>
        <div className="relative overflow-hidden bg-sand">
          <img
            src={photo.src}
            srcSet={'srcSet' in photo ? photo.srcSet : undefined}
            sizes="(min-width: 1024px) 560px, 92vw"
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            loading="lazy"
            decoding="async"
            className="aspect-[6/5] w-full object-cover transition-transform duration-[1.2s] ease-out hover:scale-[1.03]"
          />
        </div>
      </div>
      <div className={`lg:col-span-5 ${flip ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-8'}`}>
        <p className="flex items-center gap-4 text-[0.7rem] font-semibold tracking-[0.24em] text-gold-ink uppercase">
          <span className="display text-2xl tracking-normal text-onyx not-italic">{s.number}</span>
          <span className="h-px w-8 bg-gold" aria-hidden="true" />
          {s.name}
        </p>
        <h3 className="h-card mt-5">{s.headline}</h3>
        <p className="mt-4 text-muted">{s.description}</p>
        <p className="mt-5 border-l-2 border-gold pl-4 text-[0.95rem] text-onyx">{s.benefit}</p>
        {s.items.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {s.items.map((it) => (
              <li key={it} className="border border-line px-3 py-1.5 text-[0.75rem] tracking-[0.08em] text-muted uppercase">
                {it}
              </li>
            ))}
          </ul>
        )}
        <WhatsAppLink intent={s.intent} source={SOURCE[s.id]} category={s.id} ctaId={`servico-${s.id}`} className="btn-ghost mt-8">
          {s.cta}
        </WhatsAppLink>
      </div>
    </article>
  );
}

export function Services({ heroPhoto, hasBrides }: { heroPhoto: PhotoKey; hasBrides: boolean }) {
  const enabled = services.filter((s) => s.enabled);
  const brides = enabled.find((s) => s.id === 'noivas');
  const rest = enabled.filter((s) => s.id !== 'noivas');
  const bridesRef = useViewEvent<HTMLDivElement>('view_service', { category: 'noivas' });

  return (
    <section id="servicos" aria-labelledby="servicos-titulo" className="border-t border-line bg-champagne/45 py-20 sm:py-28">
      <div className="wrap">
        <div className="grid gap-6 lg:grid-cols-12">
          <p className="eyebrow lg:col-span-12">Serviços</p>
          <h2 id="servicos-titulo" className="h-section reveal lg:col-span-7">
            Cuidado para cada fase, <em className="accent">cada ocasião.</em>
          </h2>
          <p className="lead reveal lg:col-span-4 lg:col-start-9 lg:self-end">
            Valores e disponibilidade variam conforme o serviço. Escolha o que procura e a conversa já começa no assunto certo.
          </p>
        </div>

        {brides && (
          <div ref={bridesRef} className="on-dark reveal mt-14 grid gap-6 bg-onyx p-7 text-champagne sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-12">
            <p className="flex items-center gap-4 text-[0.7rem] font-semibold tracking-[0.24em] text-gold uppercase lg:col-span-3">
              <span className="display text-2xl tracking-normal text-paper">{brides.number}</span>
              {brides.name}
            </p>
            <div className="lg:col-span-5">
              <h3 className="h-card text-paper">{brides.headline}</h3>
              <p className="mt-3 text-muted-dark">{brides.description}</p>
            </div>
            <div className="flex flex-col gap-2 lg:col-span-4 lg:items-end">
              {hasBrides ? (
                <a href="#noivas" className="btn-gold w-full sm:w-auto">
                  {brides.cta}
                  <ArrowDown aria-hidden="true" strokeWidth={1.5} className="size-4" />
                </a>
              ) : (
                <WhatsAppLink intent="brides" source="brides" category="noivas" ctaId="servico-noivas" className="btn-gold w-full sm:w-auto">
                  {brides.cta}
                </WhatsAppLink>
              )}
            </div>
          </div>
        )}

        <div className="divide-y divide-line">
          {rest.map((s, i) => (
            <ServiceRow key={s.id} s={s} index={i} heroPhoto={heroPhoto} />
          ))}
        </div>
      </div>
    </section>
  );
}
