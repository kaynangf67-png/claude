import { ArrowDown, MapPin, Star } from 'lucide-react';
import { academia, activities, messages } from '../config/academia';
import { getPhoto } from '../lib/photos';
import { activityIcons } from './icons';
import { ContactLink, Photo } from './ui';

const rating = academia.googleRating.toLocaleString('pt-BR', { minimumFractionDigits: 1 });

export function Hero() {
  const photo = getPhoto(academia.heroImage);

  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="grain relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-[4.5rem] lg:pt-20"
    >
      {/* Fundo */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        {photo ? (
          <>
            <Photo photo={photo} alt="" sizes="100vw" priority className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/40" />
          </>
        ) : (
          <>
            <div className="grid-lines absolute inset-0" />
            <div className="glow-drift absolute -right-[20%] -bottom-[30%] size-[90vmax] rounded-full bg-[radial-gradient(circle,rgb(255_90_31/0.32),transparent_60%)] blur-2xl" />
            <div className="absolute -top-[25%] -left-[15%] size-[60vmax] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.05),transparent_60%)]" />
            <svg
              viewBox="0 0 600 600"
              className="absolute top-1/2 right-[-18%] hidden w-[62vw] max-w-[860px] -translate-y-1/2 text-white/[0.06] md:block lg:right-[-8%]"
              fill="none"
              stroke="currentColor"
            >
              {/* Anilha estilizada: anéis concêntricos */}
              <circle cx="300" cy="300" r="290" strokeWidth="1.5" />
              <circle cx="300" cy="300" r="235" strokeWidth="1" />
              <circle cx="300" cy="300" r="232" strokeWidth="1" strokeDasharray="2 10" />
              <circle cx="300" cy="300" r="150" strokeWidth="1.5" className="text-ember-500/40" stroke="currentColor" />
              <circle cx="300" cy="300" r="48" strokeWidth="1.5" />
              <circle cx="300" cy="300" r="30" strokeWidth="1" />
            </svg>
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      <div className="container-x relative flex flex-1 flex-col justify-center py-14 lg:py-20">
        <div className="grid items-center gap-14 lg:grid-cols-[1.55fr_1fr]">
          <div>
            <h1 id="hero-title">
              <span className="rise eyebrow" style={{ ['--d' as string]: '80ms' }}>
                Nobre Academia em Jacaraípe
              </span>
              <span className="rise heading-xl mt-6 block" style={{ ['--d' as string]: '160ms' }}>
                Seu objetivo.
                <br />
                Seu treino.
                <br />
                <span className="text-accent">Sua evolução.</span>
              </span>
            </h1>

            <p
              className="rise lead mt-7 max-w-xl text-pretty text-mist-300"
              style={{ ['--d' as string]: '280ms' }}
            >
              Na Nobre Academia, você encontra estrutura, variedade de atividades e um ambiente preparado para fazer
              parte da sua rotina.
            </p>

            <div
              className="rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ ['--d' as string]: '380ms' }}
            >
              <ContactLink message={messages.visit} cta="hero" arrow className="btn btn-primary w-full sm:w-auto">
                Quero conhecer a Nobre
              </ContactLink>
              <a href="#atividades" className="btn btn-ghost w-full sm:w-auto" data-cta="hero-atividades">
                Ver atividades
                <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>

            <ul
              className="rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-mist-300"
              style={{ ['--d' as string]: '480ms' }}
            >
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-ember-500" aria-hidden />
                {academia.address.neighborhood} — {academia.address.city}/{academia.address.state}
              </li>
              <li className="flex items-center gap-2">
                <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                <span>
                  <strong className="font-semibold text-white">{rating}/5</strong> no Google
                </span>
              </li>
            </ul>
          </div>

          {/* Painel de modalidades (desktop) */}
          <div className="rise hidden lg:block" style={{ ['--d' as string]: '560ms' }}>
            <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-7 backdrop-blur-md">
              <p className="text-xs font-semibold tracking-[0.22em] text-mist-400 uppercase">Atividades na Nobre</p>
              <ul className="mt-5 divide-y divide-white/[0.06]">
                {activities.map((a, i) => {
                  const Icon = activityIcons[a.icon];
                  return (
                    <li key={a.slug}>
                      <a
                        href={`#${a.slug}`}
                        className="group flex items-center gap-4 py-3.5 transition-colors hover:text-ember-300"
                      >
                        <span className="w-6 text-xs font-medium text-mist-400 tabular-nums">0{i + 1}</span>
                        <Icon className="size-5 text-ember-500" aria-hidden />
                        <span className="text-lg font-bold tracking-tight uppercase [font-stretch:110%]">{a.name}</span>
                        <span className="ml-auto h-px w-6 bg-white/20 transition-all duration-500 group-hover:w-10 group-hover:bg-ember-500" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Faixa de modalidades em movimento */}
      <div className="relative border-y border-white/[0.07] bg-ink-950/70 py-4 backdrop-blur-sm" aria-hidden>
        <div className="flex overflow-hidden">
          <div className="marquee-track flex shrink-0 items-center whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center">
                {[...activities, ...activities].map((a, i) => (
                  <span key={`${copy}-${i}`} className="flex items-center">
                    <span className="px-6 text-sm font-extrabold tracking-[0.18em] text-white/80 uppercase [font-stretch:120%]">
                      {a.name}
                    </span>
                    <span className="size-1.5 rotate-45 bg-ember-500" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
