import { clinic, whatsappMessages } from '../config/clinic';
import { photos } from '../lib/photos';
import { Photo, WhatsAppLink } from './ui';

export function FinalCTA() {
  return (
    <section aria-labelledby="cta-title" className="bg-white pb-6 sm:pb-10">
      <div className="container-site">
        <div className="on-dark reveal relative isolate overflow-hidden rounded-[2rem] bg-navy-900 px-6 py-16 text-center sm:px-12 sm:py-24 lg:rounded-[2.5rem]">
          <Photo
            photo={photos.balcao}
            className="absolute inset-0 -z-20"
            imgClassName="object-[50%_45%] opacity-25"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-900/80 via-navy-900/90 to-navy-950" />
          <p className="eyebrow justify-center text-wood-300">{clinic.name}</p>
          <h2 id="cta-title" className="heading-lg mx-auto mt-5 max-w-2xl text-balance text-white sm:text-6xl">
            Pronto para cuidar melhor do seu sorriso?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/75">
            Fale com a equipe da {clinic.name} e descubra o melhor caminho para o seu atendimento.
          </p>
          <WhatsAppLink
            message={whatsappMessages.general}
            cta="cta-final"
            className="btn btn-whatsapp mt-10 min-h-16 w-full px-10 text-lg sm:w-auto"
          />
        </div>
      </div>
    </section>
  );
}
