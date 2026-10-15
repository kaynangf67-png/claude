import { ArrowDown, MapPin, MessagesSquare, ShieldCheck, Signpost } from 'lucide-react';
import { messages, site } from '../config/site';
import { photos } from '../lib/photos';
import { GearPattern, Photo, WhatsAppLink } from './ui';

const benefits = [
  { icon: Signpost, label: 'Categorias A, B e A + B' },
  { icon: MessagesSquare, label: 'Atendimento próximo' },
  { icon: ShieldCheck, label: 'Direção responsável' },
];

function HeroVisual() {
  const photo = photos.hero;
  return (
    <div className="on-dark relative isolate h-full overflow-hidden rounded-[22px] bg-forest-900 text-paper">
      {photo ? (
        <>
          <Photo photo={photo} priority sizes="(min-width: 1024px) 46vw, 100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/75 via-forest-950/10 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-forest-950/80 p-3 pr-5 backdrop-blur-md sm:bottom-6 sm:left-6">
            <GearPattern className="size-14 text-paper" />
            <p className="text-sm leading-snug">
              <span className="block font-semibold">Primeira marcha</span>
              <span className="text-forest-200">{site.address.city}, {site.address.state}</span>
            </p>
          </div>
        </>
      ) : (
        <>
          {/* pista em perspectiva ao fundo */}
          <svg
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-0 h-[24%] w-full text-forest-800"
            aria-hidden="true"
          >
            <path d="M170 0 L230 0 L400 300 L0 300 Z" fill="currentColor" />
            <path d="M200 0 V300" stroke="#c4ef4f" strokeOpacity="0.5" strokeWidth="3" strokeDasharray="14 18" />
          </svg>
          <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_30%,rgb(196_239_79/0.10),transparent_70%)]" />
          <div className="relative flex h-full flex-col justify-between p-5 sm:p-8">
            <div className="flex items-start justify-between gap-4 text-[0.7rem] font-semibold tracking-[0.2em] text-forest-200 uppercase">
              <span>Ponto de partida</span>
              <span className="tabular-nums">1ª marcha</span>
            </div>
            <GearPattern className="mx-auto mt-4 mb-[18%] sm:-mt-4 sm:mb-[16%] w-[min(70%,320px)] text-paper" />
            <div className="flex items-end justify-between gap-4">
              <p className="display text-[1.05rem] leading-tight text-paper">
                {site.address.city}
                <span className="text-lime-300"> · </span>
                {site.address.state}
              </p>
              <p className="flex gap-1.5" aria-label="Categorias A, B e A + B">
                {['A', 'B', 'A+B'].map((c) => (
                  <span
                    key={c}
                    className="display rounded-md border border-paper/25 px-2 py-1 text-[0.78rem] leading-none text-paper"
                  >
                    {c}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="relative overflow-hidden pt-[4.5rem]">
      <div className="container-site grid gap-10 pt-8 pb-14 sm:pt-14 lg:grid-cols-12 lg:items-stretch lg:gap-12 lg:pt-16 lg:pb-20">
        <div className="flex flex-col justify-center lg:col-span-7 lg:py-6">
          <p className="eyebrow reveal">
            {site.kind} · {site.address.city}, {site.address.state}
          </p>
          <h1 id="hero-title" className="heading-xl reveal mt-6 text-balance text-forest-950" style={{ ['--reveal-delay' as string]: '80ms' }}>
            Sua liberdade começa na{' '}
            <span className="relative isolate whitespace-nowrap">
              primeira marcha
              <span aria-hidden="true" className="absolute inset-x-[-0.04em] bottom-[0.02em] -z-10 h-[0.2em] rounded-[3px] bg-lime-400" />
            </span>
            .
          </h1>
          <p className="lead reveal mt-7 max-w-xl text-pretty" style={{ ['--reveal-delay' as string]: '160ms' }}>
            Aprenda a dirigir com calma, segurança e alguém do seu lado em cada etapa. Na Auto Escola São Francisco,
            em Serra, você entende o processo, treina com instrutor e chega à prova sabendo o que fazer.
          </p>
          <div className="reveal mt-9 flex flex-col gap-3 sm:flex-row" style={{ ['--reveal-delay' as string]: '240ms' }}>
            <WhatsAppLink message={messages.general} cta="hero" className="btn btn-primary min-h-14 px-7 text-base">
              Quero tirar minha CNH
            </WhatsAppLink>
            <a href="#categorias" className="btn btn-outline min-h-14 px-7 text-base">
              Conhecer as categorias
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>

          <ul
            className="reveal mt-11 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-forest-900/12 pt-6 sm:grid-cols-3"
            style={{ ['--reveal-delay' as string]: '320ms' }}
          >
            {benefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-[0.95rem] font-medium text-graphite">
                <Icon className="size-[1.15rem] shrink-0 text-forest-600" strokeWidth={1.8} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="reveal aspect-[4/3.6] sm:aspect-[16/11] lg:col-span-5 lg:aspect-auto lg:min-h-[600px]" style={{ ['--reveal-delay' as string]: '200ms' }}>
          <HeroVisual />
        </div>
      </div>

      {/* faixa de pista: o detalhe que dá movimento à primeira dobra */}
      <div aria-hidden="true" className="relative h-14 bg-forest-950">
        <div className="lane lane-animated absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2" />
        <div className="container-site relative flex h-full items-center">
          <span className="flex items-center gap-2 bg-forest-950 pr-4 text-[0.72rem] font-semibold tracking-[0.2em] text-forest-200 uppercase">
            <MapPin className="size-3.5 text-lime-400" />
            <span className="hidden sm:inline">{site.address.neighborhood} · </span>
            {site.address.city}, {site.address.state}
          </span>
        </div>
      </div>
    </section>
  );
}
