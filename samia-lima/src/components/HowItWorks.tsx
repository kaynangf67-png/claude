import type { CSSProperties } from 'react';
import { whatsappMessages } from '../config/site';
import { SectionHeader, WhatsAppLink } from './ui';

const steps = [
  { title: 'Entre em contato', text: 'Fale conosco pelo WhatsApp e conte o que você precisa.' },
  { title: 'Agende sua avaliação', text: 'Consulte os horários disponíveis para seu atendimento.' },
  {
    title: 'Receba orientação profissional',
    text: 'Converse com a dentista para avaliar suas necessidades e conhecer as possibilidades de tratamento.',
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-titulo" className="py-20 sm:py-28">
      <div className="container-site">
        <SectionHeader
          id="como-funciona-titulo"
          eyebrow="Primeira avaliação"
          title="Comece com uma conversa"
          align="center"
        />

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* linha que conecta as etapas */}
          <span aria-hidden="true" className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-wine-800/20 md:block" />
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="reveal relative flex flex-col items-center text-center"
              style={{ '--reveal-delay': `${i * 90}ms` } as CSSProperties}
            >
              <span
                className="relative flex size-14 items-center justify-center rounded-full border border-wine-800/25 bg-paper font-display text-[1.5rem] text-wine-800 italic"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="heading-md mt-6">
                <span className="sr-only">Etapa {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-3 max-w-[18rem] leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="reveal mt-14 flex flex-col items-center gap-4 text-center">
          <WhatsAppLink message={whatsappMessages.general} cta="como-funciona" className="btn btn-primary px-7">
            Quero agendar minha avaliação
          </WhatsAppLink>
          <p className="max-w-md text-[0.85rem] text-muted">
            Diagnóstico e plano de tratamento são definidos somente após a avaliação clínica no consultório.
          </p>
        </div>
      </div>
    </section>
  );
}
