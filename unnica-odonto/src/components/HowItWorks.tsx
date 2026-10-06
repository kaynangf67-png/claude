import { clinic, whatsappMessages } from '../config/clinic';
import { SectionHeader, WhatsAppLink } from './ui';

const steps = [
  { title: 'Entre em contato', text: 'Fale conosco pelo WhatsApp.' },
  { title: 'Conte o que você procura', text: 'Explique sua necessidade e tire suas dúvidas.' },
  { title: 'Agende seu atendimento', text: 'Nossa equipe orientará você sobre os próximos passos.' },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-title" className="bg-sand-50 py-24 sm:py-32">
      <div className="container-site">
        <SectionHeader
          id="como-funciona-title"
          eyebrow="Como funciona"
          title="Começar seu atendimento é simples."
          align="center"
        />

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            aria-hidden="true"
            className="absolute top-8 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-wood-300/0 via-wood-300 to-wood-300/0 md:block"
          />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="reveal relative flex flex-col items-center text-center"
              style={{ ['--reveal-delay' as string]: `${i * 120}ms` }}
            >
              <span className="relative inline-flex size-16 items-center justify-center rounded-full border border-wood-300 bg-white font-display text-2xl text-navy-900 shadow-soft">
                0{i + 1}
              </span>
              <h3 className="mt-6 font-display text-[1.75rem] leading-tight text-navy-900">{s.title}</h3>
              <p className="mt-2 max-w-[16rem] text-[0.95rem] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
          </ol>
        </div>

        <div className="reveal mt-14 flex justify-center">
          <WhatsAppLink message={whatsappMessages.schedule} cta="como-funciona" className="btn btn-whatsapp min-h-14 px-8 text-base">
            Falar com a {clinic.name}
          </WhatsAppLink>
        </div>
      </div>
    </section>
  );
}
