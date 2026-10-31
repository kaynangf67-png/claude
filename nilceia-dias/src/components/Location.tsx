import { ArrowUpRight, MapPin, Navigation, Phone } from 'lucide-react';
import { useState } from 'react';
import { brand, type Intent } from '../config/site';
import { track } from '../lib/analytics';
import { DirectionsLink, WhatsAppLink } from './ui';

export function Location({ intent }: { intent: Intent }) {
  // O mapa do Google só carrega após o clique: página mais leve e
  // nenhum cookie de terceiros antes da ação do visitante.
  const [showMap, setShowMap] = useState(false);
  const a = brand.address;

  return (
    <section id="localizacao" aria-labelledby="local-titulo" className="py-20 sm:py-28">
      <div className="wrap grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="eyebrow">Localização</p>
          <h2 id="local-titulo" className="h-section reveal mt-6">
            Em Serra, <em className="accent">no Laranjeiras.</em>
          </h2>
          <address className="mt-8 flex gap-4 not-italic">
            <MapPin aria-hidden="true" strokeWidth={1.25} className="mt-1 size-5 shrink-0 text-gold-ink" />
            <span className="text-[1.05rem] leading-relaxed">
              {a.street}
              <br />
              {a.neighborhood}
              <br />
              {a.city} — {a.state}, {a.postalCode}
            </span>
          </address>
          <p className="mt-5 flex gap-4">
            <Phone aria-hidden="true" strokeWidth={1.25} className="mt-1 size-5 shrink-0 text-gold-ink" />
            <a href={brand.phoneHref} onClick={() => track('click_phone', { cta_source: 'location' })} className="-mt-3 inline-flex min-h-12 items-center text-[1.05rem] underline-offset-4 hover:underline">
              {brand.phoneDisplay}
            </a>
          </p>
          {brand.openingHours.length > 0 && (
            <ul className="mt-5 space-y-1 text-muted">
              {brand.openingHours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-sm text-muted">Horários e disponibilidade são confirmados pelo WhatsApp.</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <DirectionsLink source="location" className="btn-primary">
              <Navigation aria-hidden="true" strokeWidth={1.5} className="size-4" />
              <span>Traçar rota</span>
            </DirectionsLink>
            <WhatsAppLink intent={intent} source="location" className="btn-ghost">
              WhatsApp
            </WhatsAppLink>
          </div>
          <a
            href={brand.maps.open}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('click_open_maps', { cta_source: 'location' })}
            className="link-arrow mt-4"
          >
            Abrir no Google Maps <ArrowUpRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </a>
        </div>

        <div className="reveal lg:col-span-7">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-line bg-champagne/60 lg:aspect-auto lg:h-full lg:min-h-[28rem]">
            {showMap ? (
              <iframe
                title={`Mapa: ${a.street}, ${a.neighborhood}, ${a.city} — ${a.state}`}
                src={brand.maps.embed}
                className="absolute inset-0 h-full w-full border-0 grayscale-[35%]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowMap(true);
                  track('view_map', { cta_source: 'location' });
                }}
                className="group absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
              >
                {/* Malha decorativa de "mapa" em CSS puro */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
                    backgroundSize: '44px 44px',
                  }}
                />
                <span className="relative flex size-14 items-center justify-center rounded-full bg-onyx text-gold transition-transform group-hover:scale-105">
                  <MapPin aria-hidden="true" strokeWidth={1.5} className="size-6" />
                </span>
                <span className="relative text-[0.78rem] font-semibold tracking-[0.18em] uppercase">Carregar mapa</span>
                <span className="relative max-w-xs text-xs text-muted">O mapa é fornecido pelo Google e carrega só quando você pedir.</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
