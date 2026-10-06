import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { faq, whatsappMessages } from '../config/clinic';
import { SectionHeader, WhatsAppLink } from './ui';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="duvidas" aria-labelledby="faq-title" className="bg-white py-24 sm:py-32">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <SectionHeader
              id="faq-title"
              eyebrow="Dúvidas"
              title="Perguntas frequentes"
              lead="Não encontrou sua resposta? Nossa equipe responde pelo WhatsApp."
            />
            <WhatsAppLink message={whatsappMessages.general} cta="faq-topo" className="btn btn-ghost reveal mt-8">
              Enviar minha dúvida
            </WhatsAppLink>
          </div>
        </div>

        <ul className="reveal divide-y divide-navy-900/10 border-y border-navy-900/10 lg:col-span-8">
          {faq.map((item, i) => {
            const isOpen = open === i;
            const btnId = `${baseId}-q${i}`;
            const panelId = `${baseId}-a${i}`;
            return (
              <li key={item.question}>
                <h3>
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-[1.05rem] font-semibold text-navy-900 transition-colors hover:text-petrol-600 sm:text-lg"
                  >
                    {item.question}
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color,color] duration-300 ${
                        isOpen ? 'rotate-45 border-navy-900 bg-navy-900 text-white' : 'border-navy-900/15 text-navy-900'
                      }`}
                    >
                      <Plus className="size-4" />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  inert={!isOpen}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pr-12 pb-6">
                      <p className="text-[0.98rem] leading-relaxed text-muted">{item.answer}</p>
                      <WhatsAppLink
                        message={whatsappMessages.question(item.question)}
                        cta={`faq:${i + 1}`}
                        className="mt-4 inline-flex min-h-11 items-center gap-2 text-[0.92rem] font-semibold text-whatsapp hover:text-whatsapp-hover"
                      >
                        Perguntar pelo WhatsApp
                      </WhatsAppLink>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
