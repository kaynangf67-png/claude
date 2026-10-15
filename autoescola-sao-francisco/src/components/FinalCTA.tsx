import { messages } from '../config/site';
import { photos } from '../lib/photos';
import { WhatsAppLink } from './ui';

/** Estrada em perspectiva, abaixo do conteúdo, apontando para o horizonte (o botão). */
function Road() {
  return (
    <svg viewBox="0 0 1200 220" preserveAspectRatio="none" className="block h-28 w-full sm:h-40" aria-hidden="true">
      <path d="M585 0 L615 0 L1080 220 L120 220 Z" fill="#08170f" opacity="0.75" />
      <path d="M585 0 L120 220 M615 0 L1080 220" stroke="#f5f3ec" strokeOpacity="0.16" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d="M600 8 L600 220" stroke="#c4ef4f" strokeOpacity="0.7" strokeWidth="5" strokeDasharray="16 20" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function FinalCTA() {
  const photo = photos.final;
  return (
    <section aria-labelledby="final-title" className="px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="on-dark relative isolate overflow-hidden rounded-[28px] bg-gradient-to-b from-forest-900 to-forest-800 text-paper">
        {photo && (
          <>
            <img src={photo.src} alt="" loading="lazy" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-forest-950/75" />
          </>
        )}

        <div className="container-site relative flex flex-col items-center pt-24 pb-14 text-center sm:pt-32 lg:pt-36">
          <p className="eyebrow reveal justify-center">O próximo passo</p>
          <h2 id="final-title" className="heading-xl reveal mt-6 max-w-[16ch] text-balance">
            Seu próximo destino começa aqui.
          </h2>
          <p className="lead reveal mt-6 max-w-xl text-pretty">
            Mande uma mensagem, tire suas dúvidas sobre a CNH e descubra qual é o melhor caminho para você. A primeira
            conversa já é o começo da viagem.
          </p>
          <WhatsAppLink message={messages.general} cta="final" className="btn btn-primary reveal mt-10 min-h-14 px-8 text-base">
            Falar com a Autoescola
          </WhatsAppLink>
        </div>
        {!photo && <Road />}
      </div>
    </section>
  );
}
