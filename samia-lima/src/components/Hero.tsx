import { ArrowDown, MapPin } from 'lucide-react';
import { locationLabel, professional, whatsappMessages } from '../config/site';
import { photos } from '../lib/photos';
import { BrandPanel, Photo, WhatsAppLink } from './ui';

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="hero-titulo" className="relative pt-[4.25rem] lg:pt-[5.25rem]">
      <div className="container-site grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pt-16 lg:pb-24">
        <div className="max-w-xl">
          <p className="eyebrow">Odontologia com cuidado e atenção</p>
          <h1 id="hero-titulo" className="heading-xl mt-6 text-balance">
            Seu sorriso merece cuidado <em className="text-wine-800 italic">em cada detalhe.</em>
          </h1>
          <p className="lead mt-7 max-w-[34rem] text-pretty">
            Encontre um atendimento odontológico pensado para ouvir você, esclarecer suas dúvidas e cuidar da sua saúde
            bucal com atenção e responsabilidade.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <WhatsAppLink message={whatsappMessages.general} cta="hero" className="btn btn-primary px-7">
              Agendar uma avaliação
            </WhatsAppLink>
            <a href="#tratamentos" className="btn btn-outline">
              Conhecer os tratamentos
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-8 flex items-center gap-2 text-[0.9rem] text-muted">
            <MapPin className="size-4 shrink-0 text-wine-800" aria-hidden="true" />
            Atendimento em {locationLabel}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[26rem] lg:mr-0 lg:max-w-none">
          <div className="arch relative aspect-square overflow-hidden shadow-lift sm:aspect-[4/5]">
            {photos.hero ? (
              <Photo photo={photos.hero} priority className="h-full" sizes="(min-width: 1024px) 480px, 90vw" />
            ) : (
              <BrandPanel className="h-full" />
            )}
          </div>
          {/* Selo de registro profissional */}
          <div className="card absolute -bottom-6 left-1/2 flex w-max -translate-x-1/2 items-center gap-3 px-5 py-3.5 lg:-left-10 lg:translate-x-0">
            <span className="flex size-9 items-center justify-center rounded-full bg-wine-100 font-display text-[1.05rem] text-wine-800 italic">
              SL
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[0.92rem] font-semibold text-wine-950">{professional.profession}</span>
              <span className="text-[0.8rem] text-muted">{professional.cro}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
