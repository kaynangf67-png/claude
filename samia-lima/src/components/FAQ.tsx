import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { faq } from '../config/site';
import { SectionHeader, WhatsAppLink } from './ui';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="duvidas" aria-labelledby="faq-titulo" className="bg-white py-20 sm:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeader
            id="faq-titulo"
            eyebrow="Dúvidas frequentes"
            title="Perguntas antes da consulta"
            lead="Não encontrou sua dúvida? Pergunte pelo WhatsApp."
          />
        </div>

        <div className="reveal border-t border-line">
          {faq.map((item, i) => {
            const isOpen = open === i;
            const btnId = `${baseId}-q${i}`;
            const panelId = `${baseId}-a${i}`;
            return (
              <div key={item.question} className="border-b border-line">
                <h3>
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-[1.05rem] font-medium text-wine-950 transition-colors hover:text-wine-800 sm:text-[1.1rem]"
                  >
                    {item.question}
                    <Plus
                      className={`size-5 shrink-0 text-wine-800 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                  inert={!isOpen}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-2xl pb-5 leading-relaxed text-muted">{item.answer}</p>
                    {item.whatsapp && (
                      <WhatsAppLink
                        message={item.whatsapp}
                        cta={`faq:${i + 1}`}
                        className="link-arrow mb-7 text-[0.92rem]"
                      >
                        Perguntar pelo WhatsApp
                        <span className="sr-only"> (abre em nova aba)</span>
                      </WhatsAppLink>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
