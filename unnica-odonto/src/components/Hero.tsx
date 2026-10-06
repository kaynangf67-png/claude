import { ArrowDown, MapPin } from 'lucide-react';
import { clinic, SHOW_PENDING, whatsappMessages } from '../config/clinic';
import { photos } from '../lib/photos';
import { Pending } from './Pending';
import { Photo, WhatsAppLink } from './ui';

export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="hero relative overflow-hidden bg-navy-950 pt-[4.25rem] lg:bg-transparent lg:bg-gradient-to-b lg:from-sand-50 lg:via-white lg:to-white lg:pt-20"
    >
      {/* Mobile: foto vertical do consultório como fundo */}
      <div aria-hidden="true" className="absolute inset-0 top-[4.25rem] overflow-hidden lg:hidden">
        <Photo photo={photos.consultorio} priority imgClassName="origin-bottom scale-[1.2] object-[50%_100%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/15 via-navy-950/70 via-45% to-navy-950/95" />
      </div>

      {/* Linha de luz: referência à iluminação indireta da clínica */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 -right-40 hidden lg:block h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(closest-side,rgb(217_185_151/0.35),transparent)] lg:top-10"
      />

      <div className="container-site relative grid min-h-[calc(100svh-4.25rem)] items-end gap-12 pt-48 pb-10 sm:pt-72 lg:min-h-0 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-16 lg:pb-24">
        <div className="lg:col-span-6 xl:col-span-6">
          <p className="eyebrow reveal max-lg:text-white/90">
            Clínica odontológica
            {clinic.cityLabel ? (
              <span className="text-white/70 lg:text-muted"> · {clinic.cityLabel}</span>
            ) : (
              SHOW_PENDING && <span className="normal-case tracking-normal">
                · <Pending>[cidade]</Pending>
              </span>
            )}
          </p>

          <h1 id="hero-title" className="heading-xl reveal mt-5 text-balance text-white lg:mt-6 lg:text-navy-900" style={{ ['--reveal-delay' as string]: '80ms' }}>
            Seu cuidado odontológico em um ambiente{' '}
            <em className="text-wood-300 italic lg:text-petrol-600">pensado para você.</em>
          </h1>

          <p className="reveal mt-5 max-w-xl text-pretty text-[1.02rem] leading-relaxed text-white/80 sm:text-lg lg:mt-6 lg:text-muted" style={{ ['--reveal-delay' as string]: '160ms' }}>
            Na {clinic.name}, você encontra atendimento odontológico, tecnologia e uma estrutura preparada para
            oferecer uma experiência mais confortável e segura.
          </p>

          <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row lg:mt-9" style={{ ['--reveal-delay' as string]: '240ms' }}>
            <WhatsAppLink message={whatsappMessages.general} cta="hero" className="btn btn-whatsapp min-h-14 px-7 text-base" />
            <a href="#estrutura" className="btn btn-ghost min-h-14 px-7 text-base max-lg:border-white/30 max-lg:bg-white/10 max-lg:text-white">
              Conhecer a clínica
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>

          {(clinic.address.street || SHOW_PENDING) && (
          <p className="reveal mt-6 flex items-start gap-2 text-sm text-white/75 lg:text-muted" style={{ ['--reveal-delay' as string]: '300ms' }}>
            <MapPin className="mt-0.5 size-4 shrink-0 text-wood-300 lg:text-wood-500" aria-hidden="true" />
            {clinic.address.street ? (
              <span>
                {clinic.address.street}
                {clinic.address.neighborhood && ` · ${clinic.address.neighborhood}`}
              </span>
            ) : (
              <Pending>[Endereço da clínica]</Pending>
            )}
          </p>
          )}
        </div>

        <div className="relative hidden lg:col-span-6 lg:block xl:col-span-6">
          <div className="relative mx-auto max-w-[30rem] lg:mr-0 lg:ml-auto">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-navy-900/5">
              <Photo photo={photos.salaDeEspera} priority imgClassName="object-[50%_45%]" />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy-950/45 to-transparent" />
              <p className="absolute bottom-5 left-5 text-[0.7rem] font-semibold tracking-[0.2em] text-white/90 uppercase">
                Recepção
              </p>
            </div>

            {/* Cartão sobreposto com o consultório */}
            <div className="absolute -bottom-8 -left-4 w-[42%] sm:-left-10 lg:-left-16">
              <div className="aspect-[3/4] overflow-hidden rounded-2xl border-4 border-white shadow-lift">
                <Photo photo={photos.consultorio} priority imgClassName="object-[50%_60%]" />
              </div>
            </div>

            <div className="absolute top-6 -right-2 hidden max-w-[13rem] rounded-2xl bg-white/95 p-4 shadow-soft backdrop-blur sm:block lg:-right-6">
              <p className="font-display text-xl leading-tight text-navy-900">Estrutura moderna</p>
              <p className="mt-1 text-[0.8rem] leading-snug text-muted">
                Recepção e consultórios pensados para o seu conforto.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
