import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { clinic, whatsappMessages } from '../config/clinic';
import { WhatsAppIcon } from './BrandIcons';
import { WhatsAppLink, Wordmark } from './ui';

export const navItems = [
  { label: 'Início', href: '#inicio' },
  { label: 'A Clínica', href: '#clinica' },
  { label: 'Tratamentos', href: '#tratamentos' },
  { label: 'Estrutura', href: '#estrutura' },
  { label: 'Dúvidas', href: '#duvidas' },
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
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        open
          ? 'border-b border-navy-900/8 bg-white'
          : solid
          ? 'border-b border-navy-900/8 bg-white/90 shadow-[0_8px_30px_-20px_rgb(11_37_64/0.35)] backdrop-blur-md'
          : 'border-b border-navy-900/8 bg-white lg:border-transparent lg:bg-transparent'
      }`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-md focus:bg-white focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <div className="container-site flex h-[4.25rem] items-center justify-between gap-4 lg:h-20">
        <a href="#inicio" aria-label={`${clinic.name} — início`} onClick={() => setOpen(false)}>
          <Wordmark />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-full px-4 py-2 text-[0.92rem] font-medium text-navy-900/75 transition-colors hover:bg-navy-900/5 hover:text-navy-900"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <WhatsAppLink
            message={whatsappMessages.general}
            cta="header"
            className="btn btn-whatsapp hidden min-h-11 px-5 text-[0.9rem] sm:inline-flex"
          />
          <WhatsAppLink
            message={whatsappMessages.general}
            cta="header-mobile"
            className="inline-flex size-11 items-center justify-center rounded-full bg-whatsapp text-white sm:hidden"
            showIcon={false}
            ariaLabel="Falar pelo WhatsApp"
          >
            <WhatsAppIcon className="size-5" />
          </WhatsAppLink>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-navy-900 hover:bg-navy-900/5 lg:hidden"
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
          <ul className="container-site flex flex-col pt-1 pb-6">
            {navItems.map((item) => (
              <li key={item.href} className="border-b border-navy-900/8 last:border-0">
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-14 items-center font-display text-2xl text-navy-900"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="pt-5">
              <WhatsAppLink message={whatsappMessages.general} cta="menu-mobile" className="btn btn-whatsapp w-full" />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
