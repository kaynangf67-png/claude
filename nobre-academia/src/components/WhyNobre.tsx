import { HeartPulse, Layers, MapPin, Repeat } from 'lucide-react';
import { messages } from '../config/academia';
import { ContactLink, SectionHeader } from './ui';

const reasons = [
  {
    icon: Layers,
    title: 'Variedade de atividades',
    text: 'Musculação, funcional, aulas coletivas e luta: opções para diferentes objetivos e estilos de treino.',
  },
  {
    icon: Repeat,
    title: 'Ambiente para sua rotina',
    text: 'Uma academia pensada para você encaixar a atividade física no dia a dia.',
  },
  {
    icon: MapPin,
    title: 'Localização em Jacaraípe',
    text: 'Na Avenida Abido Saad, com facilidade para quem mora ou circula pela região.',
  },
  {
    icon: HeartPulse,
    title: 'Bem-estar e qualidade de vida',
    text: 'Treinar não precisa ser só sobre estética. É também sobre saúde, disposição e qualidade de vida.',
  },
];

export function WhyNobre() {
  return (
    <section id="academia" aria-labelledby="academia-title" className="section relative">
      <div className="container-x">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeader
              id="academia-title"
              eyebrow="Por que Nobre?"
              title={
                <>
                  Mais que treino. <span className="text-accent">Um lugar para evoluir.</span>
                </>
              }
              lead="Seja para começar, voltar ou ir além, a Nobre Academia é o lugar para transformar treino em hábito, aqui em Jacaraípe."
            />
            <div className="reveal mt-9 hidden lg:block" style={{ ['--d' as string]: '150ms' }}>
              <ContactLink message={messages.visit} cta="por-que-nobre" arrow className="btn btn-ghost">
                Quero conhecer
              </ContactLink>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {reasons.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className={`reveal card card-hover group p-7 sm:p-8 ${i % 2 === 1 ? 'sm:translate-y-10' : ''}`}
                style={{ ['--d' as string]: `${i * 90}ms` }}
              >
                <div className="pointer-events-none absolute -top-24 -right-24 size-48 rounded-full bg-ember-500/0 blur-3xl transition-colors duration-700 group-hover:bg-ember-500/20" />
                <span className="icon-tile">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="heading-md mt-7">{title}</h3>
                <p className="mt-3 leading-relaxed text-mist-400">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
