import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { messages } from '../config/site';
import { Logo, WhatsAppLink } from './ui';

export const navLinks = [
  { href: '#inicio', label: 'Início' },
  { href: '#autoescola', label: 'A Autoescola' },
  { href: '#categorias', label: 'Categorias' },
  { href: '#cursos', label: 'Cursos' },
  { href: '#aprovados', label: 'Aprovados' },
  { href: '#duvidas', label: 'Dúvidas' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        solid ? 'border-b border-forest-900/10 bg-paper/92 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:rounded-full focus:bg-forest-900 focus:px-4 focus:py-2 focus:text-paper"
      >
        Pular para o conteúdo
      </a>
      <div className="container-site flex h-[4.5rem] items-center justify-between gap-6">
        <a href="#inicio" aria-label="Auto Escola São Francisco, voltar ao início" onClick={() => setOpen(false)}>
          <Logo />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-[0.93rem] font-medium text-graphite transition-colors hover:bg-forest-900/[0.05] hover:text-forest-950"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <WhatsAppLink
            message={messages.general}
            cta="header"
            className="btn btn-dark hidden min-h-11 px-5 text-[0.9rem] sm:inline-flex"
          >
            WhatsApp
          </WhatsAppLink>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-forest-950 hover:bg-forest-900/[0.06] lg:hidden"
            aria-expanded={open}
            aria-controls="menu-movel"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <div
        id="menu-movel"
        hidden={!open}
        className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-forest-900/10 bg-paper lg:hidden"
      >
        <nav aria-label="Menu" className="container-site flex min-h-full flex-col py-6">
          <ul className="divide-y divide-forest-900/10">
            {navLinks.map((link, i) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between py-4 text-forest-950"
                >
                  <span className="display text-[1.6rem]">{link.label}</span>
                  <span className="font-display text-sm text-muted tabular-nums">0{i + 1}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-8">
            <WhatsAppLink message={messages.general} cta="menu-movel" className="btn btn-primary w-full">
              Falar pelo WhatsApp
            </WhatsAppLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
