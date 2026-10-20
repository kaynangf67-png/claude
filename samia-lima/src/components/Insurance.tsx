import type { CSSProperties } from 'react';
import { ShieldCheck, Wallet } from 'lucide-react';
import { whatsappMessages } from '../config/site';
import { SectionHeader, WhatsAppLink } from './ui';

const options = [
  {
    icon: ShieldCheck,
    title: 'Atendimento por convênio',
    text: 'Informe o nome do seu plano odontológico e confirme se ele é aceito no consultório.',
    cta: 'Consultar meu convênio',
    message: whatsappMessages.insurance,
    id: 'convenio',
  },
  {
    icon: Wallet,
    title: 'Atendimento particular',
    text: 'Tire suas dúvidas sobre a consulta e as condições para o atendimento particular.',
    cta: 'Consultar condições',
    message: whatsappMessages.private,
    id: 'particular',
  },
];

/** Nenhum convênio, preço ou condição é listado até a confirmação do consultório. */
export function Insurance() {
  return (
    <section id="convenios" aria-labelledby="convenios-titulo" className="py-20 sm:py-28">
      <div className="container-site grid gap-12">
        <SectionHeader
          id="convenios-titulo"
          eyebrow="Convênios e particular"
          title="Vamos encontrar a melhor forma de cuidar do seu sorriso"
          lead="Entre em contato para consultar as opções de atendimento, verificar se seu plano odontológico é aceito e entender as condições para atendimento particular."
        />
        <ul className="grid gap-5 md:grid-cols-2 lg:gap-6">
          {options.map(({ icon: Icon, title, text, cta, message, id }, i) => (
            <li
              key={id}
              className={`reveal flex flex-col rounded-[var(--radius-card)] p-7 sm:p-10 ${
                i === 0 ? 'bg-wine-800 text-white' : 'card'
              }`}
              style={{ '--reveal-delay': `${i * 90}ms` } as CSSProperties}
            >
              <span
                className={`flex size-12 items-center justify-center rounded-full ${i === 0 ? 'bg-white/12' : 'bg-wine-100'}`}
              >
                <Icon className={`size-6 ${i === 0 ? 'text-white' : 'text-wine-800'}`} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h3
                className={`mt-7 font-display text-[1.55rem] leading-tight ${i === 0 ? 'text-white' : 'text-wine-950'}`}
                style={{ fontVariationSettings: "'opsz' 40" }}
              >
                {title}
              </h3>
              <p className={`mt-3 flex-1 leading-relaxed ${i === 0 ? 'text-white/75' : 'text-muted'}`}>{text}</p>
              <WhatsAppLink
                message={message}
                cta={`convenios:${id}`}
                className={`btn mt-8 self-start ${i === 0 ? 'btn-light' : 'btn-primary'}`}
              >
                {cta}
              </WhatsAppLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
