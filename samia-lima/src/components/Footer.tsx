import { professional, whatsappMessages } from '../config/site';
import { whatsappUrl } from '../lib/whatsapp';
import { navItems } from './Header';
import { ExternalLink, Wordmark } from './ui';

export function Footer() {
  const p = professional;
  const a = p.address;
  const year = new Date().getFullYear();

  return (
    <footer data-hide-fab className="on-dark border-t border-white/10 bg-[#3a111f] text-white/75">
      <div className="container-site grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr] lg:py-20">
        <div>
          <Wordmark tone="light" />
          <p className="mt-6 max-w-xs text-[0.92rem] leading-relaxed">
            {p.fullName}
            <br />
            {p.profession} · {p.cro}
          </p>
        </div>

        <div>
          <h2 className="text-[0.7rem] font-semibold tracking-[0.2em] text-white uppercase">Contato</h2>
          <ul className="mt-5 space-y-3 text-[0.92rem]">
            <li>
              {a.street}
              <br />
              {a.neighborhood}, {a.city}/{a.state}
            </li>
            <li>
              <a
                href={whatsappUrl(whatsappMessages.general)}
                target="_blank"
                rel="noopener noreferrer"
                data-cta="rodape"
                className="hover:text-white hover:underline"
              >
                WhatsApp {p.phoneDisplay}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${p.email}`} className="break-all hover:text-white hover:underline">
                {p.email}
              </a>
            </li>
            <li>
              <ExternalLink href={p.instagramUrl} className="hover:text-white hover:underline">
                Instagram {p.instagramHandle}
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href={a.mapsUrl} className="hover:text-white hover:underline">
                Ver no Google Maps
              </ExternalLink>
            </li>
          </ul>
        </div>

        <nav aria-label="Rodapé">
          <h2 className="text-[0.7rem] font-semibold tracking-[0.2em] text-white uppercase">Navegação</h2>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.92rem] lg:grid-cols-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-white hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-3 py-6 text-[0.8rem] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {p.brandName} · {p.profession} · {p.cro}
          </p>
          {p.privacyPolicyUrl && (
            <a href={p.privacyPolicyUrl} className="hover:text-white hover:underline">
              Política de privacidade
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
