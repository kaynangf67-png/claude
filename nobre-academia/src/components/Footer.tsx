import { MapPin, Phone } from 'lucide-react';
import { academia } from '../config/academia';
import { telUrl } from '../lib/contact';
import { FacebookIcon, InstagramIcon } from './BrandIcons';
import { navItems } from './Header';
import { Logo } from './ui';

export function Footer() {
  const a = academia.address;
  const social = [
    academia.instagram && {
      href: `https://www.instagram.com/${academia.instagram}/`,
      label: `Instagram @${academia.instagram}`,
      Icon: InstagramIcon,
    },
    academia.facebookUrl && { href: academia.facebookUrl, label: 'Facebook', Icon: FacebookIcon },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof InstagramIcon }[];

  return (
    <footer className="border-t border-white/[0.06] bg-ink-950 pb-28 sm:pb-12">
      <div className="container-x grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr] lg:py-20">
        <div>
          <Logo />
          <p className="mt-6 max-w-sm leading-relaxed text-mist-400">
            Academia em Jacaraípe, Serra/ES. Musculação, funcional, GAP, Jump, Zumba e MMA para cuidar da saúde, do
            condicionamento e da qualidade de vida.
          </p>
          {social.length > 0 && (
            <ul className="mt-7 flex gap-3">
              {social.map(({ href, label, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid size-11 place-items-center rounded-xl border border-white/10 text-mist-300 transition hover:border-ember-500 hover:bg-ember-500 hover:text-white"
                  >
                    <Icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="Rodapé">
          <p className="text-xs font-semibold tracking-[0.22em] text-mist-400 uppercase">Navegação</p>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-mist-300 transition-colors hover:text-white">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-mist-400 uppercase">Contato</p>
          <ul className="mt-5 space-y-4 text-mist-300">
            <li>
              <a href={academia.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-white">
                <MapPin className="mt-1 size-4 shrink-0 text-ember-500" aria-hidden />
                <span>
                  {a.street} — {a.neighborhood}
                  <br />
                  {a.city}/{a.state} · CEP {a.postalCode}
                </span>
              </a>
            </li>
            <li>
              <a href={telUrl} className="flex items-center gap-3 hover:text-white">
                <Phone className="size-4 shrink-0 text-ember-500" aria-hidden />
                {academia.phone.display}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="container-x flex flex-col gap-2 border-t border-white/[0.06] pt-8 text-sm text-mist-400 sm:flex-row sm:justify-between">
        <p>© {academia.copyrightYear} Nobre Academia. Todos os direitos reservados.</p>
        <p>Jacaraípe · Serra · Espírito Santo</p>
      </div>
    </footer>
  );
}
