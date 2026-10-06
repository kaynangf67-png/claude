import { ArrowUpRight, Quote, Star } from 'lucide-react';
import { academia, reviews } from '../config/academia';
import { GoogleIcon } from './BrandIcons';
import { SectionHeader } from './ui';

const rating = academia.googleRating.toLocaleString('pt-BR', { minimumFractionDigits: 1 });

function Stars({ value, className = 'size-5' }: { value: number; className?: string }) {
  return (
    <span className="flex gap-1 text-amber-400" role="img" aria-label={`${value.toLocaleString('pt-BR')} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block">
            <Star className={`${className} text-amber-400/25`} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${className} fill-current`} aria-hidden />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Reviews() {
  return (
    <section id="avaliacoes" aria-labelledby="avaliacoes-title" className="section relative overflow-hidden bg-ink-900">
      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <SectionHeader
            id="avaliacoes-title"
            eyebrow="Avaliações"
            title={
              <>
                Quem conhece, <span className="text-accent">recomenda</span>
              </>
            }
            lead="A nota da Nobre no Google é construída por quem treina aqui. Veja o que alunos e clientes dizem sobre a academia."
          />

          <div className="reveal card relative p-8 sm:p-10" style={{ ['--d' as string]: '120ms' }}>
            <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="flex items-center gap-3 text-sm font-medium text-mist-300">
              <GoogleIcon className="size-6" />
              Nota no Google
            </div>
            <div className="mt-6 flex items-end gap-4">
              <span className="text-[5.5rem] leading-[0.8] font-black tracking-tighter [font-stretch:110%]">{rating}</span>
              <span className="pb-1 text-2xl font-bold text-mist-400">/5</span>
            </div>
            <div className="mt-5">
              <Stars value={academia.googleRating} className="size-6" />
            </div>
            <p className="mt-5 text-mist-400">Avaliações reais, escritas por alunos e clientes da academia.</p>
            <a
              href={academia.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-cta="avaliacoes-google"
              className="btn btn-light mt-8 w-full"
            >
              Ver avaliações no Google
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>

        {/* Depoimentos reais (copiados do Google com autorização) — só aparecem se cadastrados no config */}
        {reviews.length > 0 && (
          <ul className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <li
                key={r.author + i}
                className="reveal card flex flex-col p-7"
                style={{ ['--d' as string]: `${(i % 3) * 80}ms` }}
              >
                <Quote className="size-8 text-ember-500" aria-hidden />
                <blockquote className="mt-5 flex-1 leading-relaxed text-mist-300">“{r.text}”</blockquote>
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
                  <div>
                    <p className="font-semibold">{r.author}</p>
                    <p className="text-xs text-mist-400">Avaliação no Google{r.when ? ` · ${r.when}` : ''}</p>
                  </div>
                  <Stars value={r.rating} className="size-4" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
