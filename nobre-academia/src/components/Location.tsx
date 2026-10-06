import { MapPin, Navigation, Phone } from 'lucide-react';
import { academia } from '../config/academia';
import { telUrl } from '../lib/contact';
import { SectionHeader } from './ui';

export function Location() {
  const a = academia.address;
  const embed = `https://www.google.com/maps?q=${encodeURIComponent(academia.mapsEmbedQuery)}&z=16&output=embed`;

  return (
    <section id="contato" aria-labelledby="contato-title" className="section">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
          <div className="flex flex-col">
            <SectionHeader
              id="contato-title"
              eyebrow="Localização"
              title={
                <>
                  Estamos em <span className="text-accent">Jacaraípe</span>
                </>
              }
              lead="A Nobre Academia está localizada na Avenida Abido Saad, em Jacaraípe, Serra – ES."
            />

            <address className="reveal mt-10 not-italic" style={{ ['--d' as string]: '100ms' }}>
              <div className="card flex gap-5 p-6 sm:p-7">
                <span className="icon-tile">
                  <MapPin className="size-6" aria-hidden />
                </span>
                <div className="leading-relaxed">
                  <p className="text-lg font-bold">{a.street}</p>
                  <p className="text-mist-300">
                    {a.neighborhood} — {a.city}/{a.state}
                  </p>
                  <p className="text-mist-400">CEP {a.postalCode}</p>
                </div>
              </div>
            </address>

            <div className="reveal mt-6 grid gap-3 sm:grid-cols-2" style={{ ['--d' as string]: '180ms' }}>
              <a
                href={academia.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="como-chegar"
                className="btn btn-primary"
              >
                <Navigation className="size-4" aria-hidden />
                Como chegar
              </a>
              <a href={telUrl} data-cta="ligar-localizacao" className="btn btn-ghost">
                <Phone className="size-4" aria-hidden />
                Ligar agora
              </a>
            </div>
            <p className="reveal mt-4 text-sm text-mist-400">
              Telefone:{' '}
              <a href={telUrl} className="font-semibold text-white underline-offset-4 hover:underline">
                {academia.phone.display}
              </a>
            </p>
          </div>

          <div className="reveal relative min-h-[340px] overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-850 sm:min-h-[420px] lg:min-h-0">
            {/* Fundo exibido enquanto o mapa carrega (ou se ele for bloqueado) */}
            <a
              href={academia.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-mist-400"
            >
              <div className="grid-lines absolute inset-0" aria-hidden />
              <MapPin className="relative size-10 text-ember-500" aria-hidden />
              <span className="relative text-sm font-semibold">Abrir no Google Maps</span>
            </a>
            <iframe
              title={`Mapa: ${academia.name}, ${a.street}, ${a.neighborhood}, ${a.city}/${a.state}`}
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full [filter:grayscale(1)_invert(0.92)_contrast(0.9)_hue-rotate(180deg)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
