import { messages, site } from '../config/site';
import { addressLine, addressRegion, instagramUrl, mapsUrl } from '../lib/location';
import { isWhatsAppConfigured } from '../lib/whatsapp';
import { navLinks } from './Header';
import { Logo, Pending, WhatsAppLink } from './ui';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="on-dark bg-forest-950 text-paper">
      <div className="container-site grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:py-20">
        <div className="sm:col-span-2 lg:col-span-5">
          <Logo tone="light" />
          <p className="mt-6 max-w-sm leading-relaxed text-forest-200">{site.tagline}</p>
          <WhatsAppLink message={messages.general} cta="rodape" className="btn btn-primary mt-8">
            Falar pelo WhatsApp
          </WhatsAppLink>
        </div>

        <nav aria-label="Rodapé" className="lg:col-span-3">
          <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-lime-300 uppercase">Navegação</p>
          <ul className="mt-5 space-y-3">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-forest-200 transition-colors hover:text-paper">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#contato" className="text-forest-200 transition-colors hover:text-paper">
                Contato
              </a>
            </li>
          </ul>
        </nav>

        <div className="lg:col-span-4">
          <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-lime-300 uppercase">Contato</p>
          <ul className="mt-5 space-y-4 text-forest-200">
            <li>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-paper">
                {addressLine}
                <br />
                {addressRegion}
              </a>
            </li>
            <li>
              {isWhatsAppConfigured ? (
                <WhatsAppLink message={messages.general} cta="rodape-texto" showIcon={false} className="transition-colors hover:text-paper">
                  WhatsApp
                </WhatsAppLink>
              ) : (
                <>
                  WhatsApp: <Pending>número</Pending>
                </>
              )}
            </li>
            {site.phoneDisplay && <li>Telefone: {site.phoneDisplay}</li>}
            <li>
              {instagramUrl ? (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-paper">
                  Instagram {site.instagram}
                </a>
              ) : (
                <>
                  Instagram: <Pending>@</Pending>
                </>
              )}
            </li>
            {site.openingHours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-paper/10">
        <div className="container-site flex flex-col gap-3 py-6 text-[0.85rem] text-forest-200/80 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. Todos os direitos reservados.
          </p>
          {site.privacyPolicyUrl && (
            <a href={site.privacyPolicyUrl} className="transition-colors hover:text-paper">
              Política de privacidade
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
