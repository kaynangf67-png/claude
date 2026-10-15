import type { ReactNode } from 'react';
import { Car, Check, Motorbike } from 'lucide-react';
import { categories, type Category } from '../config/site';
import { SectionHeader, WhatsAppLink } from './ui';

const icons: Record<Category['id'], ReactNode> = {
  a: <Motorbike className="size-6" strokeWidth={1.6} aria-hidden="true" />,
  b: <Car className="size-6" strokeWidth={1.6} aria-hidden="true" />,
  ab: (
    <span className="flex items-center gap-1" aria-hidden="true">
      <Motorbike className="size-6" strokeWidth={1.6} />
      <span className="text-sm opacity-60">+</span>
      <Car className="size-6" strokeWidth={1.6} />
    </span>
  ),
};

export function Categories() {
  return (
    <section id="categorias" aria-labelledby="categorias-title" className="bg-white py-20 sm:py-28">
      <div className="container-site">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            id="categorias-title"
            eyebrow="Categorias"
            title="Escolha por onde começar."
            lead="Moto, carro ou os dois. Diga o que você precisa e a equipe explica as etapas, os requisitos e as condições da categoria."
          />
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:gap-0">
          {categories.map((cat, i) => {
            const featured = cat.id === 'ab';
            return (
              <article
                key={cat.id}
                id={`categoria-${cat.id}`}
                aria-labelledby={`categoria-${cat.id}-title`}
                className={`reveal group relative flex flex-col overflow-hidden rounded-[22px] p-7 sm:p-9 ${
                  featured
                    ? 'on-dark bg-forest-900 text-paper lg:ml-4'
                    : `border border-forest-900/12 bg-paper ${i === 0 ? 'lg:rounded-r-none' : 'lg:rounded-l-none lg:border-l-0'}`
                }`}
                style={{ ['--reveal-delay' as string]: `${i * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-[0.72rem] font-semibold tracking-[0.2em] uppercase ${featured ? 'text-lime-300' : 'text-forest-600'}`}>
                      Categoria
                    </p>
                    <p
                      className={`display mt-2 text-[4.5rem] leading-[0.85] tracking-[-0.04em] sm:text-[5.25rem] ${
                        featured ? 'text-lime-400' : 'text-forest-950'
                      }`}
                      aria-hidden="true"
                    >
                      {cat.code}
                    </p>
                  </div>
                  <span
                    className={`mt-1 inline-flex h-12 items-center rounded-full px-3.5 ${
                      featured ? 'bg-paper/10 text-paper' : 'bg-forest-900/[0.06] text-forest-800'
                    }`}
                  >
                    {icons[cat.id]}
                  </span>
                </div>

                <h3 id={`categoria-${cat.id}-title`} className="mt-8">
                  <span className={`block text-[0.95rem] font-semibold ${featured ? 'text-forest-200' : 'text-forest-600'}`}>
                    <span className="sr-only">Categoria {cat.code}: </span>
                    {cat.vehicle}
                  </span>
                  <span className="heading-md mt-2 block text-balance">{cat.title}</span>
                </h3>
                <p className={`mt-4 text-[1rem] leading-relaxed ${featured ? 'text-forest-200' : 'text-muted'}`}>
                  {cat.description}
                </p>

                <ul className={`mt-6 space-y-2.5 border-t pt-6 ${featured ? 'border-paper/15' : 'border-forest-900/12'}`}>
                  {cat.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-[0.95rem]">
                      <Check className={`size-4 shrink-0 ${featured ? 'text-lime-400' : 'text-forest-600'}`} strokeWidth={2.4} aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-9">
                  <WhatsAppLink
                    message={cat.message}
                    cta={`categoria-${cat.id}`}
                    className={`btn w-full ${featured ? 'btn-primary' : 'btn-dark'}`}
                  >
                    {cat.cta}
                  </WhatsAppLink>
                </div>
              </article>
            );
          })}
        </div>

        <p className="reveal mt-8 max-w-3xl text-[0.92rem] leading-relaxed text-muted">
          Valores, carga de aulas e prazos variam conforme a categoria e as regras vigentes do Detran-ES. A equipe
          informa tudo diretamente no atendimento.
        </p>
      </div>
    </section>
  );
}
