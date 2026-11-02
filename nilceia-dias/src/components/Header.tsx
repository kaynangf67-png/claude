import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PageConfig, SectionKey } from '../config/pages';
import { WhatsAppIcon } from './BrandIcons';
import { WhatsAppLink, Wordmark } from './ui';

const NAV: { label: string; id: string; section: SectionKey }[] = [
  { label: 'Serviços', id: 'servicos', section: 'services' },
  { label: 'Noivas', id: 'noivas', section: 'brides' },
  { label: 'Trabalhos', id: 'trabalhos', section: 'gallery' },
  { label: 'Sobre', id: 'sobre', section: 'about' },
  { label: 'Localização', id: 'localizacao', section: 'location' },
];

/**
 * Menu em pílula translúcida flutuando sobre a foto do hero (como no modelo).
 * Ao rolar, vira uma barra clara e compacta.
 */
export function Header({ page }: { page: PageConfig }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overHero = page.sections.length > 0; // a página de privacidade não tem hero com foto
  const light = overHero && !scrolled && !open; // texto claro sobre a foto
  const links = NAV.map((n) => ({ ...n, href: page.sections.includes(n.section) ? `#${n.id}` : `/#${n.id}` }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-full focus:bg-onyx focus:px-4 focus:py-3 focus:text-paper">
        Pular para o conteúdo
      </a>
      <div
        className={`mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-3 rounded-full pr-1.5 pl-5 transition-[background-color,border-color,box-shadow] duration-300 lg:h-16 lg:pl-7 ${
          light ? 'glass-dark text-paper' : 'card-shadow border border-line bg-paper/95 text-onyx backdrop-blur-md'
        }`}
      >
        <a href={overHero ? '#topo' : '/'} aria-label="Nilcéia Dias Hair & Company — início" className="flex min-h-12 items-center">
          <Wordmark compact dark={light} />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.href}
                  className={`inline-flex min-h-12 items-center text-[0.8rem] font-medium transition-opacity hover:opacity-100 ${light ? 'opacity-85' : 'opacity-75'}`}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <WhatsAppLink
            intent={page.primaryIntent}
            source="header"
            className={`${light ? 'btn-light' : 'btn-primary'} hidden !min-h-11 !px-5 !text-[0.72rem] sm:inline-flex`}
          >
            Agendar atendimento
          </WhatsAppLink>
          <WhatsAppLink
            intent={page.primaryIntent}
            source="header"
            ctaId="header-mobile"
            icon={false}
            ariaLabel="Agendar atendimento pelo WhatsApp"
            className="inline-flex size-12 items-center justify-center rounded-full sm:hidden"
          >
            <WhatsAppIcon className="size-[1.3rem]" />
          </WhatsAppLink>
          <button
            type="button"
            className="inline-flex size-12 items-center justify-center rounded-full lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X strokeWidth={1.5} className="size-6" /> : <Menu strokeWidth={1.5} className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="menu-mobile" className="card-shadow mx-auto mt-2 max-h-[calc(100dvh-6rem)] max-w-[1180px] overflow-y-auto rounded-3xl border border-line bg-paper lg:hidden">
          <nav aria-label="Menu" className="flex flex-col px-6 pt-3 pb-6">
            <ul className="divide-y divide-line">
              {links.map((l) => (
                <li key={l.id}>
                  <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center text-[1.15rem]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <WhatsAppLink intent={page.primaryIntent} source="menu" className="btn-primary mt-5 w-full">
              Agendar pelo WhatsApp
            </WhatsAppLink>
          </nav>
        </div>
      )}
    </header>
  );
}
