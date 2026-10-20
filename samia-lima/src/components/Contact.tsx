import { useState, type ReactNode } from 'react';
import { Clock, Mail, MapPin, Navigation } from 'lucide-react';
import { fullAddress, professional, whatsappMessages } from '../config/site';
import { isPreview } from '../lib/preview';
import { whatsappUrl } from '../lib/whatsapp';
import { InstagramIcon, WhatsAppIcon } from './BrandIcons';
import { ExternalLink, PendingBadge, SectionHeader, ToothMark } from './ui';

export function Contact() {
  const p = professional;
  const a = p.address;

  return (
    <section id="contato" aria-labelledby="contato-titulo" className="py-20 sm:py-28">
      <div className="container-site">
        <SectionHeader
          id="contato-titulo"
          eyebrow="Localização e contato"
          title="Onde fica o consultório"
          lead="Atendimento em Residencial Jacaraípe, na Serra. Fale pelo WhatsApp para consultar horários."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="reveal card flex flex-col p-7 sm:p-9">
            <address className="not-italic">
              <ul className="divide-y divide-line">
                <ContactRow icon={<MapPin className="size-5" strokeWidth={1.6} />} label="Endereço">
                  {a.street}
                  <br />
                  {a.neighborhood}, {a.city}/{a.state}
                </ContactRow>
                <ContactRow icon={<WhatsAppIcon className="size-5" />} label="WhatsApp">
                  <a
                    href={whatsappUrl(whatsappMessages.general)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cta="contato:numero"
                    className="hover:text-wine-800 hover:underline"
                  >
                    {p.phoneDisplay}
                    <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
                  </a>
                </ContactRow>
                <ContactRow icon={<Mail className="size-5" strokeWidth={1.6} />} label="E-mail">
                  <a href={`mailto:${p.email}`} className="break-all hover:text-wine-800 hover:underline">
                    {p.email}
                  </a>
                </ContactRow>
                <ContactRow icon={<InstagramIcon className="size-5" />} label="Instagram">
                  <ExternalLink href={p.instagramUrl} className="hover:text-wine-800 hover:underline">
                    {p.instagramHandle}
                  </ExternalLink>
                </ContactRow>
                {p.openingHours.length > 0 ? (
                  <ContactRow icon={<Clock className="size-5" strokeWidth={1.6} />} label="Horários">
                    {p.openingHours.map((h) => (
                      <span key={h} className="block">
                        {h}
                      </span>
                    ))}
                  </ContactRow>
                ) : (
                  isPreview && (
                    <ContactRow icon={<Clock className="size-5" strokeWidth={1.6} />} label="Horários">
                      <PendingBadge>Horários a confirmar</PendingBadge>
                    </ContactRow>
                  )
                )}
              </ul>
            </address>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:mt-auto lg:pt-8">
              <ExternalLink href={a.mapsUrl} className="btn btn-primary">
                <Navigation className="size-4" aria-hidden="true" />
                Ver rota no Google Maps
              </ExternalLink>
              <a
                href={whatsappUrl(whatsappMessages.general)}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="contato"
                className="btn btn-outline"
              >
                <WhatsAppIcon className="size-4" />
                Chamar no WhatsApp
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </div>
          </div>

          <MapEmbed src={a.mapEmbedUrl} label={`Mapa com a localização do consultório: ${fullAddress}`} />
        </div>
      </div>
    </section>
  );
}

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 py-5 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0 text-wine-800" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted uppercase">{label}</p>
        <div className="mt-1.5 leading-relaxed text-wine-950">{children}</div>
      </div>
    </li>
  );
}

/**
 * O mapa do Google só carrega quando a pessoa pede: a página fica mais leve
 * e nenhum cookie de terceiros é definido sem uma ação do visitante.
 */
function MapEmbed({ src, label }: { src: string; label: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="reveal relative min-h-[22rem] overflow-hidden rounded-[var(--radius-card)] border border-line bg-wine-100 lg:min-h-0">
      {loaded ? (
        <iframe
          src={src}
          title={label}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
          {/* traçado de ruas estilizado */}
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 600 400">
            <g fill="none" stroke="#702338" strokeOpacity="0.12" strokeWidth="1.2">
              <path d="M-10 280C120 250 210 300 330 230S520 160 610 190" />
              <path d="M-10 120C90 140 180 90 290 130S470 240 610 220" />
              <path d="M180 -10C200 100 160 220 210 410" />
              <path d="M420 -10C400 120 450 260 400 410" />
              <path d="M-10 350C150 340 300 380 610 330" strokeOpacity="0.08" />
            </g>
          </svg>
          <span className="relative flex size-16 items-center justify-center rounded-full bg-white shadow-soft">
            <ToothMark className="h-7 w-6 text-wine-800" />
          </span>
          <p className="relative max-w-xs text-[0.95rem] leading-relaxed text-wine-950">
            {fullAddress}
          </p>
          <button type="button" onClick={() => setLoaded(true)} className="btn btn-outline relative bg-white/70">
            <MapPin className="size-4" aria-hidden="true" />
            Carregar mapa interativo
          </button>
          <p className="relative max-w-xs text-[0.75rem] text-muted">O mapa é fornecido pelo Google.</p>
        </div>
      )}
    </div>
  );
}
