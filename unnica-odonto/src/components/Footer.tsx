import { Clock, MapPin, Phone } from 'lucide-react';
import { clinic, WHATSAPP_NUMBER, whatsappMessages } from '../config/clinic';
import { isWhatsAppConfigured } from '../lib/whatsapp';
import { InstagramIcon, WhatsAppIcon } from './BrandIcons';
import { Pending } from './Pending';
import { WhatsAppLink, Wordmark } from './ui';

const footerLinks = [
  { label: 'Início', href: '#inicio' },
  { label: 'A Clínica', href: '#clinica' },
  { label: 'Tratamentos', href: '#tratamentos' },
  { label: 'Estrutura', href: '#estrutura' },
  { label: 'FAQ', href: '#duvidas' },
];

function formatWhatsApp(n: string) {
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n;
}

export function Footer() {
  const a = clinic.address;
  const addressLine = [a.street, a.complement].filter(Boolean).join(', ');
  const cityLine = [a.neighborhood, [a.city, a.state].filter(Boolean).join(' · '), a.postalCode]
    .filter(Boolean)
    .join(' — ');

  return (
    <footer className="on-dark bg-navy-950 pt-20 pb-28 text-white/75 sm:pb-12">
      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Wordmark tone="light" />
            <p className="mt-5 max-w-xs text-[0.95rem] leading-relaxed">{clinic.tagline}</p>
            <WhatsAppLink message={whatsappMessages.general} cta="footer" className="btn btn-whatsapp mt-8" />
          </div>

          <nav aria-label="Rodapé" className="lg:col-span-2">
            <h2 className="text-[0.72rem] font-semibold tracking-[0.18em] text-wood-300 uppercase">Navegação</h2>
            <ul className="mt-5 space-y-1">
              {footerLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="inline-flex min-h-9 items-center text-[0.95rem] transition-colors hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-6">
            <h2 className="text-[0.72rem] font-semibold tracking-[0.18em] text-wood-300 uppercase">Contato</h2>
            <ul className="mt-5 grid gap-5 text-[0.95rem] sm:grid-cols-2">
              <li className="flex gap-3">
                <WhatsAppIcon className="mt-0.5 size-[1.1rem] shrink-0 text-white/60" />
                <div>
                  <p className="text-white">WhatsApp</p>
                  <WhatsAppLink
                    message={whatsappMessages.general}
                    cta="footer-numero"
                    showIcon={false}
                    className="inline-flex min-h-9 items-center underline decoration-white/25 underline-offset-4 hover:text-white"
                  >
                    {isWhatsAppConfigured ? formatWhatsApp(WHATSAPP_NUMBER) : <Pending>[número]</Pending>}
                  </WhatsAppLink>
                </div>
              </li>
              <li className="flex gap-3">
                <InstagramIcon className="mt-0.5 size-[1.1rem] shrink-0 text-white/60" />
                <div>
                  <p className="text-white">Instagram</p>
                  {clinic.instagram ? (
                    <a
                      href={`https://www.instagram.com/${clinic.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center underline decoration-white/25 underline-offset-4 hover:text-white"
                    >
                      {clinic.instagram}
                    </a>
                  ) : (
                    <p className="min-h-9 pt-1.5">
                      <Pending>[@instagram]</Pending>
                    </p>
                  )}
                </div>
              </li>
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-[1.1rem] shrink-0 text-white/60" aria-hidden="true" />
                <div>
                  <p className="text-white">Endereço</p>
                  {addressLine ? (
                    <address className="mt-1.5 not-italic leading-relaxed">
                      {addressLine}
                      {cityLine && <br />}
                      {cityLine}
                    </address>
                  ) : (
                    <p className="mt-1.5">
                      <Pending>[Endereço completo]</Pending>
                    </p>
                  )}
                  {a.mapsUrl ? (
                    <a
                      href={a.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-9 items-center text-wood-300 underline underline-offset-4 hover:text-white"
                    >
                      Abrir no Google Maps
                    </a>
                  ) : (
                    <WhatsAppLink
                      message={whatsappMessages.location}
                      cta="footer-como-chegar"
                      showIcon={false}
                      className="mt-1 inline-flex min-h-9 items-center text-wood-300 underline underline-offset-4 hover:text-white"
                    >
                      Pedir localização pelo WhatsApp
                    </WhatsAppLink>
                  )}
                </div>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-[1.1rem] shrink-0 text-white/60" aria-hidden="true" />
                <div>
                  <p className="text-white">Horário de atendimento</p>
                  {clinic.openingHours.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {clinic.openingHours.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5">
                      <Pending>[Dias e horários]</Pending>
                    </p>
                  )}
                </div>
              </li>
              {clinic.phoneDisplay && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 size-[1.1rem] shrink-0 text-white/60" aria-hidden="true" />
                  <div>
                    <p className="text-white">Telefone</p>
                    <a
                      href={`tel:+55${clinic.phoneDisplay.replace(/\D/g, '')}`}
                      className="inline-flex min-h-9 items-center hover:text-white"
                    >
                      {clinic.phoneDisplay}
                    </a>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-8 text-[0.82rem] text-white/55 lg:flex-row lg:items-center lg:justify-between">
          <p>© 2026 {clinic.name}. Todos os direitos reservados.</p>
          <p>
            Responsável técnico(a): {clinic.technicalLead.name || <Pending>[Nome]</Pending>} ·{' '}
            {clinic.technicalLead.cro || <Pending>[CRO-UF 0000]</Pending>}
            {' · '}
            {clinic.clinicRegistration || <Pending>[Inscrição da clínica no CRO]</Pending>}
          </p>
        </div>
      </div>
    </footer>
  );
}
