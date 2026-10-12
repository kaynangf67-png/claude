import type { ReactNode } from 'react';
import { Clock, ExternalLink, Globe, Mail, MapPin, Phone } from 'lucide-react';
import type { MenuConfig } from '../types/menu';
import { formatAddress } from '../lib/menu';
import { FacebookIcon, InstagramIcon, TikTokIcon } from './icons';

/** Sobre, endereço, horários, contato e redes. Cada bloco some se o dado não existir. */
export function InfoSection({ config }: { config: MenuConfig }) {
  const r = config.restaurant;
  const address = formatAddress(config);
  const social = [
    r.social?.instagram && { href: r.social.instagram, label: 'Instagram', Icon: InstagramIcon },
    r.social?.facebook && { href: r.social.facebook, label: 'Facebook', Icon: FacebookIcon },
    r.social?.tiktok && { href: r.social.tiktok, label: 'TikTok', Icon: TikTokIcon },
    r.social?.website && { href: r.social.website, label: 'Site', Icon: Globe },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Globe }[];
  const hasContact = Boolean(r.phoneDisplay || r.email || social.length);

  const blocks = [address.length > 0, Boolean(r.openingHours?.length), hasContact].filter(Boolean).length;
  if (!r.description?.length && blocks === 0) return null;

  return (
    <section id="sobre" aria-labelledby="sobre-titulo" className="scroll-mt-32 border-t border-line bg-surface">
      <div className="container-menu py-12 sm:py-16">
        <h2 id="sobre-titulo" className="font-display text-3xl font-semibold">
          {r.name}
        </h2>
        {r.description?.map((p) => (
          <p key={p} className="mt-3 max-w-2xl leading-relaxed text-muted">
            {p}
          </p>
        ))}

        {blocks > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {address.length > 0 && (
              <InfoCard icon={<MapPin className="size-5" aria-hidden="true" />} title="Endereço">
                <address className="not-italic leading-relaxed">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                {r.address?.mapsUrl && (
                  <a
                    href={r.address.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                  >
                    Abrir no Google Maps
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                )}
              </InfoCard>
            )}

            {r.openingHours && r.openingHours.length > 0 && (
              <InfoCard icon={<Clock className="size-5" aria-hidden="true" />} title="Horário de funcionamento">
                <dl className="space-y-1.5">
                  {r.openingHours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <dt>{h.days}</dt>
                      <dd className="price text-right font-medium">{h.hours}</dd>
                    </div>
                  ))}
                </dl>
              </InfoCard>
            )}

            {hasContact && (
              <InfoCard icon={<Phone className="size-5" aria-hidden="true" />} title="Contato">
                <ul className="space-y-2">
                  {r.phoneDisplay && (
                    <li>
                      {r.phoneDigits ? (
                        <a href={`tel:+${r.phoneDigits}`} className="font-medium hover:text-brand">
                          {r.phoneDisplay}
                        </a>
                      ) : (
                        r.phoneDisplay
                      )}
                    </li>
                  )}
                  {r.email && (
                    <li>
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-brand">
                        <Mail className="size-4 shrink-0" aria-hidden="true" />
                        {r.email}
                      </a>
                    </li>
                  )}
                </ul>
                {social.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {social.map(({ href, label, Icon }) => (
                      <li key={label}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 ring-line transition hover:bg-brand hover:text-brand-contrast hover:ring-brand"
                        >
                          <Icon className="size-4" />
                          {label}
                          <span className="sr-only">(abre em nova aba)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </InfoCard>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-5 ring-1 ring-line">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">{icon}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}
