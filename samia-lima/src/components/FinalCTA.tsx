import { MapPin } from 'lucide-react';
import { professional, whatsappMessages } from '../config/site';
import { ToothMark, WhatsAppLink } from './ui';

export function FinalCTA() {
  return (
    <section data-hide-fab aria-labelledby="cta-final-titulo" className="on-dark relative overflow-hidden bg-wine-950 py-24 sm:py-32">
      {/* arcos decorativos */}
      <svg aria-hidden="true" viewBox="0 0 800 400" className="absolute inset-x-0 bottom-0 mx-auto h-full w-[min(1100px,180%)] max-w-none -translate-x-0">
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M${100 + i * 60} 400V${300 - i * 10}a${300 - i * 60} ${300 - i * 60} 0 0 1 ${600 - i * 120} 0V400`}
            fill="none"
            stroke="white"
            strokeOpacity={0.05 + i * 0.015}
          />
        ))}
      </svg>
      <div className="container-site reveal relative flex flex-col items-center text-center">
        <ToothMark className="h-12 w-10 text-wine-200/80" strokeWidth={1} />
        <h2 id="cta-final-titulo" className="heading-lg mt-8 max-w-3xl text-balance">
          Seu próximo passo começa com <em className="italic">uma conversa.</em>
        </h2>
        <p className="lead mt-6 max-w-xl text-pretty">
          Entre em contato para tirar suas dúvidas e consultar um horário para sua avaliação odontológica.
        </p>
        <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
          <WhatsAppLink message={whatsappMessages.general} cta="cta-final" className="btn btn-light px-7">
            Falar com a {professional.shortName}
          </WhatsAppLink>
          <a
            href="#contato"
            className="inline-flex items-center gap-2 font-semibold text-white underline decoration-white/30 underline-offset-[6px] transition-colors hover:decoration-white"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Ver localização
          </a>
        </div>
      </div>
    </section>
  );
}
