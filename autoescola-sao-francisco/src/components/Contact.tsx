import type { ReactNode } from 'react';
import { ArrowUpRight, Clock, MapPin, Phone } from 'lucide-react';
import { messages, site } from '../config/site';
import { addressLine, addressRegion, instagramUrl, mapsEmbedUrl, mapsUrl } from '../lib/location';
import { isWhatsAppConfigured } from '../lib/whatsapp';
import { InstagramIcon, WhatsAppIcon } from './BrandIcons';
import { Pending, WhatsAppLink } from './ui';

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-forest-900/12 py-5">
      <span className="flex size-10 items-center justify-center rounded-full bg-forest-900/[0.06] text-forest-700" aria-hidden="true">
        {icon}
      </span>
      <div>
        <dt className="text-[0.72rem] font-semibold tracking-[0.18em] text-forest-600 uppercase">{label}</dt>
        <dd className="mt-1.5 text-[1.02rem] leading-snug text-forest-950">{children}</dd>
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <section id="contato" aria-labelledby="contato-title" className="py-20 sm:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <div className="reveal">
            <p className="eyebrow">Localização e contato</p>
            <h2 id="contato-title" className="heading-lg mt-5 text-balance text-forest-950">
              Venha conversar com a gente.
            </h2>
            <p className="lead mt-5 text-pretty">
              Passe na autoescola ou mande uma mensagem. A equipe explica tudo com calma, antes de qualquer decisão.
            </p>
          </div>

          <dl className="reveal mt-10">
            <Row icon={<MapPin className="size-[1.1rem]" />} label="Endereço">
              {addressLine}
              <span className="block text-muted">{addressRegion}</span>
              {site.address.postalCode && <span className="block text-muted">CEP {site.address.postalCode}</span>}
            </Row>
            <Row icon={<WhatsAppIcon className="size-[1.1rem]" />} label="WhatsApp">
              {isWhatsAppConfigured ? (
                <WhatsAppLink message={messages.general} cta="contato-numero" showIcon={false} className="text-link">
                  Iniciar conversa
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </WhatsAppLink>
              ) : (
                <Pending>número do WhatsApp</Pending>
              )}
            </Row>
            <Row icon={<Phone className="size-[1.1rem]" />} label="Telefone">
              {site.phoneDisplay ? (
                <a className="text-link" href={`tel:+55${site.phoneDisplay.replace(/\D/g, '')}`}>
                  {site.phoneDisplay}
                </a>
              ) : (
                <Pending>telefone</Pending>
              )}
            </Row>
            <Row icon={<Clock className="size-[1.1rem]" />} label="Horário de atendimento">
              {site.openingHours.length > 0 ? (
                site.openingHours.map((h) => (
                  <span key={h} className="block">
                    {h}
                  </span>
                ))
              ) : (
                <Pending>horário de atendimento</Pending>
              )}
            </Row>
            <Row icon={<InstagramIcon className="size-[1.1rem]" />} label="Instagram">
              {instagramUrl ? (
                <a className="text-link" href={instagramUrl} target="_blank" rel="noopener noreferrer">
                  {site.instagram}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              ) : (
                <Pending>@ do Instagram</Pending>
              )}
            </Row>
          </dl>

          <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row">
            <WhatsAppLink message={messages.visit} cta="contato" className="btn btn-primary">
              Chamar no WhatsApp
            </WhatsAppLink>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <MapPin className="size-4" aria-hidden="true" />
              Abrir no Google Maps
            </a>
          </div>
        </div>

        <div className="reveal lg:col-span-7">
          <div className="relative h-[360px] overflow-hidden rounded-[22px] border border-forest-900/12 bg-paper-2 sm:h-[460px] lg:h-full lg:min-h-[560px]">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              aria-hidden="true"
              className="hatch absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <MapPin className="size-8 text-forest-700" strokeWidth={1.6} />
              <span className="font-semibold text-forest-950">{addressLine}</span>
              <span className="text-sm text-muted">{addressRegion}</span>
            </a>
            <iframe
              title={`Mapa: ${site.name}, ${addressLine}, ${addressRegion}`}
              src={mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full border-0 grayscale-[35%]"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}
