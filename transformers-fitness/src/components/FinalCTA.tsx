import { academia, messages } from '../config/academia';
import { hasWhatsApp, telUrl } from '../lib/contact';
import { ContactLink } from './ui';

export function FinalCTA() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8 lg:pb-32">
      <div className="grain reveal relative isolate mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-16 text-center text-ink-950 sm:px-12 sm:py-20 lg:py-28">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -top-1/2 left-1/2 size-[140%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.35),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brand-600 to-transparent" />
          <span className="absolute -bottom-[0.18em] left-1/2 -translate-x-1/2 text-[19vw] leading-none font-black whitespace-nowrap text-ink-950/[0.07] uppercase [font-stretch:125%] lg:text-[9.5rem]">
            Transformers
          </span>
        </div>
        <h2 id="cta-title" className="heading-lg mx-auto max-w-3xl text-balance">
          Pronto para dar o próximo passo?
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-ink-950/80 sm:text-xl">
          Fale com a equipe da Transformers Fitness e descubra qual opção combina melhor com você.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <ContactLink
            message={messages.plans}
            cta="cta-final"
            arrow
            className="btn min-h-16 w-full bg-ink-950 px-9 text-base text-white shadow-[0_20px_50px_-15px_rgb(0_0_0/0.6)] hover:-translate-y-0.5 hover:bg-black sm:w-auto"
          >
            {hasWhatsApp ? 'Falar com a Transformers no WhatsApp' : 'Falar com a Transformers'}
          </ContactLink>
          {hasWhatsApp && (
            <a href={telUrl} className="text-sm font-semibold text-ink-950/80 underline-offset-4 hover:underline">
              ou ligue {academia.phone.display}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
