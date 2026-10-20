import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { professional, whatsappMessages } from '../config/site';
import { WhatsAppIcon } from './BrandIcons';
import { WhatsAppLink, Wordmark } from './ui';

export const navItems = [
  { label: 'Início', href: '#inicio' },
  { label: 'A Dra. Sâmia', href: '#sobre' },
  { label: 'Tratamentos', href: '#tratamentos' },
  { label: 'Avaliações', href: '#avaliacoes' },
  { label: 'Convênios', href: '#convenios' },
  { label: 'Contato', href: '#contato' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled || open
          ? 'border-line bg-paper/95 shadow-[0_10px_30px_-24px_rgb(75_23_40/0.45)] backdrop-blur-md'
          : 'border-transparent bg-paper'
      }`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:rounded-md focus:bg-white focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <div className="container-site flex h-[4.25rem] items-center justify-between gap-4 lg:h-[5.25rem]">
        <a href="#inicio" aria-label={`${professional.brandName} — início`} onClick={() => setOpen(false)}>
          <Wordmark />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 xl:gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-full px-3 py-2 text-[0.9rem] font-medium text-ink/75 transition-colors hover:bg-wine-100/70 hover:text-wine-950 xl:px-3.5"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <WhatsAppLink
            message={whatsappMessages.general}
            cta="header"
            className="btn btn-primary hidden min-h-11 px-5 text-[0.88rem] md:inline-flex"
          />
          <WhatsAppLink
            message={whatsappMessages.general}
            cta="header-mobile"
            className="inline-flex size-11 items-center justify-center rounded-full bg-wine-800 text-white md:hidden"
            showIcon={false}
            ariaLabel="Agendar pelo WhatsApp (abre em nova aba)"
          >
            <WhatsAppIcon className="size-5" />
          </WhatsAppLink>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-wine-950 hover:bg-wine-100/70 lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        className={`grid transition-[grid-template-rows] duration-300 ease-out lg:hidden ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        inert={!open}
      >
        <nav aria-label="Menu" className="overflow-hidden">
          <ul className="container-site flex max-h-[calc(100svh-4.25rem)] flex-col overflow-y-auto pt-1 pb-6">
            {navItems.map((item) => (
              <li key={item.href} className="border-b border-line last:border-0">
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-14 items-center font-display text-[1.6rem] text-wine-950"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="pt-5">
              <WhatsAppLink message={whatsappMessages.general} cta="menu-mobile" className="btn btn-primary w-full" />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
