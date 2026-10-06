import { useEffect, useState } from 'react';
import { Menu, Phone, X } from 'lucide-react';
import { academia, messages } from '../config/academia';
import { channelLabel, contactUrl, hasWhatsApp, telUrl } from '../lib/contact';
import { WhatsAppIcon } from './BrandIcons';
import { ContactLink, Logo } from './ui';

export const navItems = [
  { href: '#inicio', label: 'Início' },
  { href: '#academia', label: 'A Academia' },
  { href: '#atividades', label: 'Atividades' },
  { href: '#estrutura', label: 'Estrutura' },
  { href: '#avaliacoes', label: 'Avaliações' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contato', label: 'Contato' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        solid ? 'border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-ink-950"
      >
        Pular para o conteúdo
      </a>
      <div className="container-x flex h-[4.5rem] items-center justify-between gap-6 lg:h-20">
        <a href="#inicio" aria-label={`${academia.name} — início`} onClick={() => setOpen(false)}>
          <Logo />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.slice(1).map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="relative rounded-lg px-3 py-2 text-[0.88rem] font-medium text-mist-300 transition-colors after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-brand-500 after:transition-transform after:duration-300 hover:text-white hover:after:scale-x-100"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ContactLink
            message={messages.default}
            cta="header"
            className="btn btn-primary hidden min-h-11 px-5 text-[0.8rem] sm:inline-flex"
          >
            {hasWhatsApp ? 'Falar no WhatsApp' : academia.phone.display}
          </ContactLink>
          {/* Atalho de contato sempre visível no celular */}
          <a
            href={contactUrl(messages.default)}
            {...(hasWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            data-cta="header-mobile"
            aria-label={channelLabel}
            className="grid size-11 place-items-center rounded-xl bg-brand-500 text-ink-950 sm:hidden"
          >
            {hasWhatsApp ? <WhatsAppIcon className="size-5" /> : <Phone className="size-5" />}
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      <div
        id="menu-mobile"
        className={`fixed inset-x-0 top-[4.5rem] bottom-0 bg-ink-950 transition-[opacity,visibility] duration-500 lg:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <nav aria-label="Menu" className="container-x flex h-full flex-col pt-6 pb-10">
          <ul className="flex flex-col">
            {navItems.map((item, i) => (
              <li
                key={item.href}
                className={`border-b border-white/[0.06] transition duration-500 ${
                  open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                }`}
                style={{ transitionDelay: open ? `${60 + i * 40}ms` : '0ms' }}
              >
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-4 text-2xl font-extrabold tracking-tight uppercase [font-stretch:110%]"
                >
                  {item.label}
                  <span className="text-sm font-medium text-mist-400">0{i + 1}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-auto grid gap-3">
            <ContactLink message={messages.default} cta="menu-mobile" className="btn btn-primary w-full">
              {channelLabel}
            </ContactLink>
            {hasWhatsApp && (
              <a href={telUrl} className="btn btn-ghost w-full" data-cta="menu-telefone">
                <Phone className="size-4" /> {academia.phone.display}
              </a>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
