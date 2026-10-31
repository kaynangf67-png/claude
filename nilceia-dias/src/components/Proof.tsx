import { ArrowUpRight } from 'lucide-react';
import { brand, reviews } from '../config/site';
import { track } from '../lib/analytics';

export function Proof() {
  return (
    <section aria-labelledby="prova-titulo" className="border-y border-line bg-champagne/45 py-20 sm:py-28">
      <div className="wrap grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <p className="eyebrow">Avaliações</p>
          <h2 id="prova-titulo" className="h-section reveal mt-6">
            A confiança também se constrói através de <em className="accent">quem já viveu essa experiência.</em>
          </h2>
        </div>

        <div className="reveal lg:col-span-5 lg:col-start-8 lg:self-end">
          <a
            href={brand.casamentos.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('click_reviews_source', { cta_source: 'proof' })}
            className="group block border-t border-onyx pt-8"
          >
            <div className="flex items-end gap-5">
              <span className="display text-[5.5rem] leading-[0.8] sm:text-[7rem]">{brand.casamentos.rating}</span>
              <span aria-hidden="true" className="mb-2 flex gap-1 text-gold">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} viewBox="0 0 20 20" className="size-4"><path fill="currentColor" d="m10 1.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" /></svg>
                ))}
              </span>
            </div>
            <p className="mt-5 flex items-center justify-between gap-4 text-[0.75rem] font-semibold tracking-[0.18em] uppercase">
              Avaliação no Casamentos.com.br
              <ArrowUpRight aria-hidden="true" strokeWidth={1.5} className="size-5 text-gold-ink transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </p>
            <p className="mt-2 text-sm text-muted">Leia as avaliações completas na fonte original.</p>
          </a>
        </div>

        {reviews.length > 0 && (
          <ul className="grid gap-10 lg:col-span-12 lg:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.author + r.text.slice(0, 20)} className="reveal border-t border-line pt-6">
                <blockquote>
                  <p className="display text-[1.35rem] leading-snug">“{r.text}”</p>
                  <footer className="mt-4 text-[0.72rem] font-semibold tracking-[0.16em] text-muted uppercase">
                    {r.author} · {r.source}
                    {r.date ? ` · ${r.date}` : ''}
                  </footer>
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
