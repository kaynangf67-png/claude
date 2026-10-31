import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PageConfig, SectionKey } from '../config/pages';
import { WhatsAppIcon } from './BrandIcons';
import { WhatsAppLink, Wordmark } from './ui';

const NAV: { label: string; id: string; section: SectionKey }[] = [
  { label: 'Serviços', id: 'servicos', section: 'services' },
  { label: 'Noivas', id: 'noivas', section: 'brides' },
  { label: 'Experiência', id: 'sobre', section: 'about' },
  { label: 'Localização', id: 'localizacao', section: 'location' },
];

export function Header({ page }: { page: PageConfig }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = page.key === 'home';
  // Em páginas de campanha, links para seções ausentes levam à home.
  const links = NAV.map((n) => ({ ...n, href: page.sections.includes(n.section) ? `#${n.id}` : `/#${n.id}` }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-300 ${
        scrolled || open ? 'border-b border-line bg-paper/95 backdrop-blur-md' : 'border-b border-transparent bg-paper/0'
      }`}
    >
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-onyx focus:px-4 focus:py-3 focus:text-paper">
        Pular para o conteúdo
      </a>
      <div className="wrap flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <a href={isHome ? '#topo' : '/'} aria-label="Nilcéia Dias Hair & Company — início" className="flex min-h-12 items-center">
          <Wordmark compact />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {links.map((l) => (
              <li key={l.id}>
                <a href={l.href} className="relative inline-flex min-h-12 items-center text-[0.72rem] font-semibold tracking-[0.2em] text-onyx/80 uppercase transition-colors hover:text-onyx">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <WhatsAppLink intent={page.primaryIntent} source="header" className="btn-primary hidden !min-h-11 !px-5 sm:inline-flex">
            Agendar atendimento
          </WhatsAppLink>
          <WhatsAppLink
            intent={page.primaryIntent}
            source="header"
            ctaId="header-mobile"
            icon={false}
            ariaLabel="Agendar atendimento pelo WhatsApp"
            className="inline-flex size-12 items-center justify-center text-onyx sm:hidden"
          >
            <WhatsAppIcon className="size-[1.35rem]" />
          </WhatsAppLink>
          <button
            type="button"
            className="inline-flex size-12 items-center justify-center text-onyx lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X strokeWidth={1.25} className="size-6" /> : <Menu strokeWidth={1.25} className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="menu-mobile" className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-paper lg:hidden">
          <nav aria-label="Menu" className="wrap flex h-full flex-col pt-6 pb-10">
            <ul className="divide-y divide-line border-b border-line">
              {links.map((l, i) => (
                <li key={l.id}>
                  <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-16 items-baseline gap-4 py-4">
                    <span className="text-[0.7rem] font-semibold tracking-[0.2em] text-gold-ink">0{i + 1}</span>
                    <span className="display text-[2rem] leading-none">{l.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-10">
              <WhatsAppLink intent={page.primaryIntent} source="menu" className="btn-primary w-full">
                Agendar pelo WhatsApp
              </WhatsAppLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
