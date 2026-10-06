import { Gem, HeartHandshake, Building2, Cpu } from 'lucide-react';
import { clinic } from '../config/clinic';
import { SectionHeader } from './ui';

const cards = [
  {
    icon: HeartHandshake,
    title: 'Atendimento humanizado',
    text: 'Um atendimento pensado para entender as necessidades de cada paciente.',
  },
  {
    icon: Building2,
    title: 'Estrutura moderna',
    text: 'Um ambiente planejado para proporcionar conforto durante sua experiência na clínica.',
  },
  {
    icon: Cpu,
    title: 'Tecnologia',
    text: 'Recursos e equipamentos que auxiliam na realização dos procedimentos odontológicos.',
  },
  {
    icon: Gem,
    title: 'Cuidado em cada detalhe',
    text: 'Da recepção ao atendimento, cada etapa é pensada para transmitir segurança e acolhimento.',
  },
];

export function Differentials() {
  return (
    <section id="diferenciais" aria-labelledby="diferenciais-title" className="bg-white py-24 sm:py-32">
      <div className="container-site">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <SectionHeader
                id="diferenciais-title"
                eyebrow={`Por que a ${clinic.name.split(' ')[0]}`}
                title="Uma experiência diferente de cuidar do seu sorriso."
                lead="Mais do que um procedimento: um cuidado que começa no momento em que você entra na clínica."
              />
            </div>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {cards.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className={`reveal group relative rounded-3xl border border-navy-900/8 bg-sand-50 p-7 transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lift sm:p-8 ${
                  i % 2 === 1 ? 'sm:translate-y-10 sm:hover:translate-y-9' : ''
                }`}
                style={{ ['--reveal-delay' as string]: `${i * 80}ms` }}
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-navy-900 text-white">
                    <Icon className="size-[1.35rem]" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="font-display text-2xl text-wood-500/70">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-8 font-display text-[1.7rem] leading-tight text-navy-900">{title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
