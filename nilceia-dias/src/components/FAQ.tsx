import { Plus } from 'lucide-react';
import { faq } from '../config/site';
import { track } from '../lib/analytics';
import { WhatsAppLink } from './ui';

export function FAQ() {
  return (
    <section id="duvidas" aria-labelledby="faq-titulo" className="border-t border-line bg-champagne/45 py-20 sm:py-28">
      <div className="wrap grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="eyebrow">Dúvidas</p>
          <h2 id="faq-titulo" className="h-section reveal mt-6">
            Perguntas <em className="accent">frequentes.</em>
          </h2>
          <p className="lead mt-6">Não encontrou o que procura? Pergunte direto pelo WhatsApp.</p>
        </div>
        <div className="border-t border-onyx lg:col-span-8">
          {faq.map((f, i) => (
            <details
              key={f.question}
              className="group border-b border-line"
              onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track('faq_open', { faq_index: i + 1 }, { once: `faq-${i}` })}
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="display text-[1.1rem] leading-snug sm:text-[1.25rem]">{f.question}</span>
                <Plus aria-hidden="true" strokeWidth={1.25} className="size-5 shrink-0 text-gold-ink transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <div className="pb-7">
                <p className="max-w-2xl text-muted">{f.answer}</p>
                <WhatsAppLink intent={f.intent} source="faq" ctaId={`faq-${i + 1}`} icon={false} className="link-arrow mt-3">
                  Perguntar pelo WhatsApp →
                </WhatsAppLink>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
