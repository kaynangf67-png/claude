import { brand, type Intent } from '../config/site';
import { track } from '../lib/analytics';
import { photos } from '../lib/photos';
import { Ornament, WhatsAppLink } from './ui';

export function FinalCTA({ intent }: { intent: Intent }) {
  const bg = photos.ondas;
  return (
    <section aria-labelledby="final-titulo" className="on-dark relative isolate overflow-hidden bg-onyx text-champagne">
      <img src={bg.src} width={bg.width} height={bg.height} alt="" loading="lazy" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-onyx/70" />
      <div className="wrap flex flex-col items-center py-24 text-center sm:py-32">
        <Ornament />
        <h2 id="final-titulo" className="h-section reveal mt-8 max-w-[20ch] text-paper">
          Seu próximo momento especial <em className="accent">começa com uma conversa.</em>
        </h2>
        <p className="lead reveal mt-6 max-w-xl">
          Conte o que você procura. Vamos conversar sobre a melhor forma de cuidar da sua beleza.
        </p>
        <WhatsAppLink intent={intent} source="final" className="btn-gold mt-10 w-full max-w-sm sm:w-auto">
          Falar com Nilcéia pelo WhatsApp
        </WhatsAppLink>
        <a
          href={brand.phoneHref}
          onClick={() => track('click_phone', { cta_source: 'final' })}
          className="mt-5 inline-flex min-h-12 items-center text-[0.8rem] tracking-[0.16em] text-muted-dark uppercase underline-offset-4 hover:text-champagne hover:underline"
        >
          ou ligue {brand.phoneDisplay}
        </a>
      </div>
    </section>
  );
}
