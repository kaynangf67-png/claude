import { brand, type Intent } from '../config/site';
import { openConsentPanel } from '../lib/consent';
import { hasTracking, track } from '../lib/analytics';
import { InstagramIcon } from './BrandIcons';
import { DirectionsLink, WhatsAppLink, Wordmark } from './ui';

export function Footer({ intent }: { intent: Intent }) {
  const a = brand.address;
  const year = new Date().getFullYear();
  return (
    <footer id="rodape" className="on-dark border-t border-gold/20 bg-onyx text-champagne">
      <div className="wrap grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <Wordmark dark />
          <p className="mt-5 max-w-xs text-sm text-muted-dark">Cabelos, tratamentos, make e produção de noivas em {brand.cityLabel}.</p>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-[0.66rem] font-semibold tracking-[0.24em] text-gold uppercase">Contato</h2>
          <ul className="mt-4 space-y-1 text-sm">
            <li>
              <WhatsAppLink intent={intent} source="footer" icon={false} className="inline-flex min-h-11 items-center hover:text-paper">
                WhatsApp {brand.phoneDisplay}
              </WhatsAppLink>
            </li>
            <li>
              <a
                href={brand.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('click_instagram', { cta_source: 'footer' })}
                className="inline-flex min-h-11 items-center gap-2 hover:text-paper"
              >
                <InstagramIcon className="size-4" /> @{brand.instagramHandle}
              </a>
            </li>
            <li>
              <a href={brand.casamentos.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-paper">
                Casamentos.com.br ↗
              </a>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-[0.66rem] font-semibold tracking-[0.24em] text-gold uppercase">Endereço</h2>
          <address className="mt-4 text-sm leading-relaxed not-italic">
            {a.street}
            <br />
            {a.neighborhood}
            <br />
            {a.city} — {a.state}, {a.postalCode}
          </address>
          <DirectionsLink source="footer" className="mt-2 inline-flex min-h-11 items-center text-sm text-gold underline-offset-4 hover:underline">
            Como chegar →
          </DirectionsLink>
        </div>

        <nav aria-label="Páginas" className="lg:col-span-2">
          <h2 className="text-[0.66rem] font-semibold tracking-[0.24em] text-gold uppercase">Páginas</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {[
              ['Início', '/'],
              ['Noivas', '/noivas/'],
              ['Cabelos', '/cabelos/'],
              ['Tratamentos', '/tratamentos-capilares/'],
            ].map(([l, h]) => (
              <li key={h}>
                <a href={h} className="inline-flex min-h-11 items-center hover:text-paper">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-gold/15">
        <div className="wrap flex flex-col gap-2 py-6 text-xs text-muted-dark sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {brand.name}. Todos os direitos reservados.</p>
          <p className="flex flex-wrap gap-x-5">
            <a href="/privacidade/" className="inline-flex min-h-11 items-center hover:text-champagne">
              Política de privacidade
            </a>
            {hasTracking && (
              <button type="button" onClick={openConsentPanel} className="inline-flex min-h-11 items-center hover:text-champagne">
                Preferências de cookies
              </button>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
