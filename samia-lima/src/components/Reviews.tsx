import { Quote, Star } from 'lucide-react';
import { googleRating, professional, reviews } from '../config/site';
import { ExternalLink, SectionHeader } from './ui';

/**
 * Avaliações reais (src/config/site.ts → reviews). Sem avaliações cadastradas,
 * mostra um convite para lê-las diretamente no Google, sem inventar nada.
 */
export function Reviews() {
  const googleButton = (
    <ExternalLink href={professional.address.mapsUrl} className="btn btn-outline">
      <GoogleG />
      Ver avaliações no Google
    </ExternalLink>
  );

  return (
    <section id="avaliacoes" aria-labelledby="avaliacoes-titulo" className="bg-stone py-20 sm:py-28">
      <div className="container-site">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeader
            id="avaliacoes-titulo"
            eyebrow="Avaliações"
            title="A experiência de quem já esteve aqui"
          />
          {googleRating && (
            <p className="reveal flex items-center gap-3 text-wine-950">
              <Star className="size-5 fill-wine-800 text-wine-800" aria-hidden="true" />
              <span>
                <strong className="font-semibold">{googleRating.rating.toFixed(1).replace('.', ',')}</strong> no Google ·{' '}
                {googleRating.count} avaliações
                <span className="block text-[0.78rem] text-muted">Consultado em {googleRating.checkedAt}</span>
              </span>
            </p>
          )}
        </div>

        {reviews.length > 0 ? (
          <>
            <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <li key={r.author + r.text.slice(0, 20)} className="reveal card flex flex-col p-7">
                  <Quote className="size-6 text-wine-800/40" strokeWidth={1.4} aria-hidden="true" />
                  <blockquote className="mt-4 flex-1">
                    <p className="leading-relaxed text-ink/90">{r.text}</p>
                  </blockquote>
                  <p className="mt-6 border-t border-line pt-4 text-[0.9rem]">
                    <span className="font-semibold text-wine-950">{r.author}</span>
                    <span className="block text-muted">{r.source}</span>
                  </p>
                </li>
              ))}
            </ul>
            <div className="reveal mt-10">{googleButton}</div>
          </>
        ) : (
          <div className="reveal card mt-12 grid items-center gap-8 p-8 sm:p-10 md:grid-cols-[auto_1fr_auto] md:gap-10">
            <span
              aria-hidden="true"
              className="hidden font-display text-[5rem] leading-[0.6] text-wine-800/25 select-none md:block"
              style={{ fontVariationSettings: "'opsz' 72" }}
            >
              “
            </span>
            <div>
              <p className="heading-md">As avaliações dos pacientes estão no Google.</p>
              <p className="mt-2 max-w-xl leading-relaxed text-muted">
                Leia os comentários de quem já foi atendido no perfil do consultório no Google Maps, exatamente como
                foram escritos.
              </p>
            </div>
            <div>{googleButton}</div>
          </div>
        )}
      </div>
    </section>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.2 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}
