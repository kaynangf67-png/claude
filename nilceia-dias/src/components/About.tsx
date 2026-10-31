import { facts, nilceiaPhoto, type Intent } from '../config/site';
import { WhatsAppLink } from './ui';

export function About({ intent }: { intent: Intent }) {
  return (
    <section id="sobre" aria-labelledby="sobre-titulo" className="py-20 sm:py-28 lg:py-36">
      <div className="wrap grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          {nilceiaPhoto ? (
            <img
              src={nilceiaPhoto.src}
              width={nilceiaPhoto.width}
              height={nilceiaPhoto.height}
              alt="Nilcéia Dias, cabeleireira e fundadora da Nilcéia Dias Hair & Company"
              loading="lazy"
              className="arch reveal aspect-[4/5] w-full object-cover"
            />
          ) : (
            // Sem foto real ainda: composição tipográfica, sem imagem de banco.
            <div aria-hidden={!facts.years.show} className="reveal relative flex aspect-[4/5] max-h-[30rem] w-full flex-col items-center justify-center border border-line bg-champagne/50">
              <span className="absolute inset-4 border border-gold/40" aria-hidden="true" />
              {facts.years.show ? (
                <>
                  <span className="display text-[7rem] leading-[0.85] sm:text-[8.5rem]">{facts.years.value}</span>
                  <span className="mt-4 text-[0.7rem] font-semibold tracking-[0.3em] text-gold-ink uppercase">{facts.years.label}</span>
                </>
              ) : (
                <span className="display text-[3.4rem]">ND</span>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
          <p className="eyebrow">Sobre Nilcéia</p>
          <h2 id="sobre-titulo" className="h-section reveal mt-6">
            Experiência que se traduz <em className="accent">em cuidado.</em>
          </h2>
          <blockquote className="reveal mt-8">
            <p className="display text-[1.25rem] leading-[1.5] text-onyx sm:text-[1.45rem]">
              “São anos dedicados à beleza, ao cuidado e aos momentos especiais de tantas mulheres. Acredito que cada atendimento deve
              respeitar a individualidade de cada cliente, valorizando suas preferências e entendendo o que realmente procura.”
            </p>
            <footer className="mt-6 flex items-center gap-4">
              <span className="h-px w-10 bg-gold" aria-hidden="true" />
              <span className="text-[0.72rem] font-semibold tracking-[0.2em] uppercase">
                Nilcéia Dias{facts.years.show ? ` · ${facts.years.value} anos de profissão` : ''}
              </span>
            </footer>
          </blockquote>
          <WhatsAppLink intent={intent} source="about" className="btn-ghost mt-10">
            Conversar com a Nilcéia
          </WhatsAppLink>
        </div>
      </div>
    </section>
  );
}
