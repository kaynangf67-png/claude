import type { Intent } from '../config/site';
import { WhatsAppLink } from './ui';

const STEPS = [
  { n: '01', title: 'Você escolhe o que procura', text: 'Identifique o serviço ou o objetivo do seu atendimento.' },
  { n: '02', title: 'Conversamos pelo WhatsApp', text: 'Entendemos melhor sua necessidade e verificamos as informações necessárias.' },
  { n: '03', title: 'Alinhamos seu atendimento', text: 'Consultamos disponibilidade e orientamos sobre os próximos passos.' },
];

export function Steps({ intent }: { intent: Intent }) {
  return (
    <section id="como-funciona" aria-labelledby="passos-titulo" className="on-dark bg-onyx py-20 text-champagne sm:py-28">
      <div className="wrap">
        <p className="eyebrow">Como funciona</p>
        <h2 id="passos-titulo" className="h-section reveal mt-6 max-w-[18ch] text-paper">
          Do primeiro contato <em className="accent">ao seu horário.</em>
        </h2>
        <ol className="mt-14 grid gap-0 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className={`reveal border-t border-gold/25 py-8 lg:py-10 ${i > 0 ? 'lg:border-l lg:pl-10' : 'lg:pr-10'}`} style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="display text-[3.2rem] leading-none text-gold">{s.n}</span>
              <h3 className="mt-5 text-[0.8rem] font-semibold tracking-[0.18em] text-paper uppercase">{s.title}</h3>
              <p className="mt-3 max-w-xs text-muted-dark">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 border-t border-gold/25 pt-10">
          <WhatsAppLink intent={intent} source="steps" className="btn-gold w-full sm:w-auto">
            Começar minha conversa
          </WhatsAppLink>
        </div>
      </div>
    </section>
  );
}
