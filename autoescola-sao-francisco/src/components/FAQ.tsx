import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { faq, messages } from '../config/site';
import { WhatsAppLink } from './ui';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="duvidas" aria-labelledby="duvidas-title" className="bg-white py-20 sm:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="reveal lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
          <p className="eyebrow">Dúvidas frequentes</p>
          <h2 id="duvidas-title" className="heading-lg mt-5 text-balance text-forest-950">
            Antes de começar.
          </h2>
          <p className="lead mt-5 text-pretty">
            As respostas gerais estão aqui. O que depende das regras vigentes ou da sua situação, a equipe confirma
            direto com você.
          </p>
          <WhatsAppLink message={messages.general} cta="faq" className="btn btn-dark mt-8">
            Perguntar à equipe
          </WhatsAppLink>
        </div>

        <div className="lg:col-span-8">
          <ul className="border-t border-forest-900/12">
            {faq.map((item, i) => {
              const isOpen = open === i;
              const buttonId = `${baseId}-q${i}`;
              const panelId = `${baseId}-a${i}`;
              return (
                <li key={item.question} className="border-b border-forest-900/12">
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="group flex w-full items-start justify-between gap-6 py-6 text-left"
                    >
                      <span className="text-[1.08rem] leading-snug font-semibold text-forest-950 transition-colors group-hover:text-forest-700 sm:text-[1.15rem]">
                        {item.question}
                      </span>
                      <span
                        className={`mt-[-2px] flex size-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-300 ${
                          isOpen ? 'rotate-45 border-lime-400 bg-lime-400 text-forest-950' : 'border-forest-900/20 text-forest-800'
                        }`}
                        aria-hidden="true"
                      >
                        <Plus className="size-4" strokeWidth={2.2} />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                    className="pr-12 pb-7"
                  >
                    <div className="max-w-2xl space-y-3 text-[1rem] leading-relaxed text-muted">
                      {item.answer.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
