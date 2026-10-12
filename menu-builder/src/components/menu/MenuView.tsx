/**
 * Motor de renderização do cardápio público. O mesmo componente serve todos os
 * restaurantes; muda só o dado (PublicMenu) e o estilo (claro/noite + cores).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Clock, ExternalLink, Globe, MapPin, MessageCircle, Phone, Search, Share2, UtensilsCrossed, X } from 'lucide-react';
import type { MenuTheme, PublicMenu } from '@/domain/types';
import { whatsappDigits } from '@/domain/rules';
import { cn, formatBRL } from '@/lib/format';

const THEMES: Record<MenuTheme, Record<string, string>> = {
  claro: { '--m-bg': '#f7f6f3', '--m-surface': '#ffffff', '--m-ink': '#1c1917', '--m-muted': '#6b645c', '--m-line': '#e7e3dd' },
  noite: { '--m-bg': '#111110', '--m-surface': '#1c1b19', '--m-ink': '#f4f0ea', '--m-muted': '#a8a198', '--m-line': '#2f2d2a' },
};

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const readableOn = (hex: string) => (luminance(hex) > 0.4 ? '#141414' : '#ffffff');
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface Props {
  menu: PublicMenu;
  /** Faixa no topo (ex.: "Prévia" ou "Modo demonstração"). */
  banner?: ReactNode;
  shareUrl?: string;
}

export function MenuView({ menu, banner, shareUrl }: Props) {
  const theme = THEMES[menu.theme] ?? THEMES.claro;
  // Preço na cor da marca só se for legível sobre o card; senão usa a cor do texto.
  const priceColor = contrast(menu.primaryColor, theme['--m-surface']) >= 3 ? menu.primaryColor : theme['--m-ink'];
  const style = {
    ...theme,
    '--m-primary': menu.primaryColor,
    '--m-on-primary': readableOn(menu.primaryColor),
    '--m-secondary': menu.secondaryColor,
    '--m-on-secondary': readableOn(menu.secondaryColor),
    '--m-price': priceColor,
  } as CSSProperties;

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(menu.categories[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const chips = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.replace('cat-', ''));
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    menu.categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [menu.categories, query]);

  useEffect(() => {
    const chip = chips.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (chip && chips.current) chips.current.scrollTo({ left: chip.offsetLeft - chips.current.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
  }, [active]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return null;
    return menu.categories.flatMap((c) => c.products.filter((p) => normalize(`${p.name} ${p.description} ${c.name}`).includes(q)));
  }, [menu.categories, query]);

  async function share() {
    const url = shareUrl ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Cardápio · ${menu.restaurantName}`, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const whatsapp = menu.whatsappNumber ? whatsappDigits(menu.whatsappNumber) : null;
  const tel = menu.phone.replace(/[^\d+]/g, '');

  return (
    <div style={style} className="min-h-dvh bg-[var(--m-bg)] text-[var(--m-ink)]">
      {banner}
      <header className="relative isolate overflow-hidden bg-[var(--m-secondary)] text-[var(--m-on-secondary)]">
        {menu.coverUrl && (
          <>
            <img src={menu.coverUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        )}
        <div className={cn('mx-auto flex max-w-3xl flex-col px-4 pt-4 pb-8 sm:px-6', menu.coverUrl && 'min-h-[42svh] text-white')}>
          <div className="flex items-center justify-between gap-3">
            {menu.logoUrl ? (
              <img src={menu.logoUrl} alt={`Logotipo ${menu.restaurantName}`} className="h-14 w-auto max-w-[150px] rounded-md object-contain" />
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={share}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-black/20 px-4 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-black/30"
            >
              <Share2 className="size-4" aria-hidden="true" />
              {copied ? 'Link copiado' : 'Compartilhar'}
            </button>
          </div>
          <div className={cn(menu.coverUrl ? 'mt-auto pt-12' : 'pt-10')}>
            {menu.businessType && <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-80">{menu.businessType}</p>}
            <h1 className="mt-1.5 text-3xl leading-tight font-bold text-balance sm:text-5xl">{menu.restaurantName}</h1>
            {menu.description && <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed opacity-90">{menu.description}</p>}
          </div>
        </div>
      </header>

      <nav aria-label="Categorias do cardápio" className="sticky top-0 z-20 border-b border-[var(--m-line)] bg-[var(--m-bg)]/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-2.5 sm:px-6">
          <label className="relative block">
            <span className="sr-only">Buscar no cardápio</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--m-muted)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no cardápio"
              className="h-11 w-full rounded-full bg-[var(--m-surface)] pr-10 pl-10 text-base ring-1 ring-[var(--m-line)] outline-none placeholder:text-[var(--m-muted)] focus:ring-2 focus:ring-[var(--m-primary)]"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca" className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[var(--m-muted)]">
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </label>
          {!query && menu.categories.length > 1 && (
            <div ref={chips} className="-mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              {menu.categories.map((c) => (
                <a
                  key={c.id}
                  href={`#cat-${c.id}`}
                  data-cat={c.id}
                  aria-current={active === c.id ? 'true' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition',
                    active === c.id ? 'bg-[var(--m-primary)] text-[var(--m-on-primary)]' : 'bg-[var(--m-surface)] ring-1 ring-[var(--m-line)]',
                  )}
                >
                  {c.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 pt-6 pb-12 sm:px-6">
        {results ? (
          <section aria-live="polite">
            <p className="text-sm text-[var(--m-muted)]">
              {results.length === 0 ? `Nada encontrado para “${query}”.` : `${results.length} ${results.length === 1 ? 'item' : 'itens'}`}
            </p>
            <div className="mt-3 space-y-3">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : menu.categories.length === 0 ? (
          <p className="py-16 text-center text-[var(--m-muted)]">Cardápio em atualização.</p>
        ) : (
          menu.categories.map((c) => (
            <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-${c.id}-t`} className="scroll-mt-32 pb-8">
              <h2 id={`cat-${c.id}-t`} className="mb-3 text-xl font-bold sm:text-2xl">{c.name}</h2>
              <div className="space-y-3">
                {c.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <InfoBlock menu={menu} tel={tel} whatsapp={whatsapp} />

      <footer className="border-t border-[var(--m-line)] px-4 py-6 text-center text-xs text-[var(--m-muted)]">
        Cardápio digital por Web Company
      </footer>
    </div>
  );
}

function ProductCard({ product: p }: { product: PublicMenu['categories'][number]['products'][number] }) {
  return (
    <article className="flex gap-4 rounded-2xl bg-[var(--m-surface)] p-4 ring-1 ring-[var(--m-line)]">
      <div className="flex min-w-0 flex-1 flex-col">
        {!p.available && (
          <span className="mb-1 w-fit rounded-full bg-[var(--m-line)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--m-muted)] uppercase">
            Indisponível
          </span>
        )}
        <h3 className={cn('text-[17px] leading-snug font-semibold', !p.available && 'text-[var(--m-muted)]')}>{p.name}</h3>
        {p.description && <p className="mt-1 text-sm leading-relaxed text-[var(--m-muted)]">{p.description}</p>}
        <div className={cn('mt-auto pt-3', !p.available && 'opacity-60')}>
          {p.variations.length > 0 ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              {p.variations.map((v) => (
                <div key={v.label} className="flex items-baseline gap-1.5">
                  <dt className="text-xs font-medium tracking-wide text-[var(--m-muted)] uppercase">{v.label}</dt>
                  <dd className="tabular font-bold text-[var(--m-price)]">{v.price !== null && formatBRL(v.price)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            p.price !== null && <p className="tabular font-bold text-[var(--m-price)]">{formatBRL(p.price)}</p>
          )}
        </div>
      </div>
      {p.imageUrl && (
        <img src={p.imageUrl} alt={p.name} loading="lazy" className={cn('size-24 shrink-0 rounded-xl object-cover sm:size-28', !p.available && 'grayscale')} />
      )}
    </article>
  );
}

function InfoBlock({ menu, tel, whatsapp }: { menu: PublicMenu; tel: string; whatsapp: string | null }) {
  const links = [
    menu.instagramUrl && { href: menu.instagramUrl, label: 'Instagram', icon: <InstagramIcon className="size-4" /> },
    menu.websiteUrl && { href: menu.websiteUrl, label: 'Site', icon: <Globe className="size-4" aria-hidden="true" /> },
  ].filter(Boolean) as { href: string; label: string; icon: ReactNode }[];
  const has = menu.address || menu.openingHours || menu.phone || whatsapp || links.length;
  if (!has) return null;
  return (
    <section aria-labelledby="info-t" className="border-t border-[var(--m-line)] bg-[var(--m-surface)]">
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6">
        <h2 id="info-t" className="sr-only">Informações do restaurante</h2>
        {menu.address && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4" aria-hidden="true" /> Endereço</h3>
            <p className="mt-1.5 text-sm whitespace-pre-line text-[var(--m-muted)]">{menu.address}</p>
            {menu.googleMapsUrl && (
              <a href={menu.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--m-price)] hover:underline">
                Abrir no Google Maps <ExternalLink className="size-3.5" aria-hidden="true" /><span className="sr-only">(abre em nova aba)</span>
              </a>
            )}
          </div>
        )}
        {menu.openingHours && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" aria-hidden="true" /> Horário</h3>
            <p className="mt-1.5 text-sm whitespace-pre-line text-[var(--m-muted)]">{menu.openingHours}</p>
          </div>
        )}
        {(menu.phone || whatsapp || links.length > 0) && (
          <div className="sm:col-span-2">
            <h3 className="text-sm font-semibold">Contato</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {menu.phone && (
                <a href={tel ? `tel:${tel}` : undefined} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-[var(--m-line)]">
                  <Phone className="size-4" aria-hidden="true" /> {menu.phone}
                </a>
              )}
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--m-primary)] px-4 text-sm font-semibold text-[var(--m-on-primary)]">
                  <MessageCircle className="size-4" aria-hidden="true" /> Falar no WhatsApp
                </a>
              )}
              {links.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-[var(--m-line)]">
                  {l.icon} {l.label}<span className="sr-only">(abre em nova aba)</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function MenuUnavailable() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div>
        <UtensilsCrossed className="mx-auto size-8 text-ink-faint" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">Cardápio não encontrado</h1>
        <p className="mt-1 text-sm text-ink-soft">Este cardápio não existe ou não está publicado no momento.</p>
      </div>
    </div>
  );
}
