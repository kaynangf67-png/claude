import { Compass, HandHeart, Info, Route, ShieldCheck } from 'lucide-react';
import { messages } from '../config/site';
import { WhatsAppLink } from './ui';

const reasons = [
  {
    icon: HandHeart,
    title: 'Atendimento próximo',
    text: 'Você fala com pessoas, não com um formulário. Cada aluno chega com uma história, e a orientação respeita isso.',
  },
  {
    icon: Compass,
    title: 'Orientação clara',
    text: 'Etapas, exames e documentos explicados sem enrolação, para você saber exatamente onde está.',
  },
  {
    icon: ShieldCheck,
    title: 'Aprendizado responsável',
    text: 'A meta é passar na prova e continuar dirigindo bem depois dela.',
  },
  {
    icon: Route,
    title: 'Acompanhamento no processo',
    text: 'Da matrícula à prova prática, a equipe acompanha o seu andamento.',
  },
  {
    icon: Info,
    title: 'Informação acessível',
    text: 'Dúvida sobre categoria, requisito ou curso? Pergunte. Resposta direta, sem letra miúda.',
  },
];

export function WhyUs() {
  return (
    <section aria-labelledby="porque-title" className="py-20 sm:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="flex flex-col gap-10 lg:col-span-5">
          <div className="reveal">
            <p className="eyebrow">Por que a São Francisco</p>
            <h2 id="porque-title" className="heading-lg mt-5 text-balance text-forest-950">
              Perto de você em cada quilômetro do processo.
            </h2>
          </div>

          <div className="reveal on-dark relative overflow-hidden rounded-[22px] bg-forest-900 p-7 text-paper sm:p-9">
            <div aria-hidden="true" className="lane absolute inset-x-0 top-0 h-1 opacity-70" />
            <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-lime-300 uppercase">Contato direto com a equipe</p>
            <p className="display mt-4 text-[1.6rem] leading-[1.1]">Tem uma dúvida agora? Pergunte agora.</p>
            <p className="mt-3 text-forest-200">
              Uma mensagem no WhatsApp e você já sabe por onde começar.
            </p>
            <WhatsAppLink message={messages.general} cta="por-que" className="btn btn-primary mt-7">
              Falar com a equipe
            </WhatsAppLink>
          </div>
        </div>

        <ul className="grid gap-x-10 sm:grid-cols-2 lg:col-span-7 lg:pt-4">
          {reasons.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className={`reveal border-t border-forest-900/12 py-7 ${i === 0 ? 'sm:col-span-2' : ''}`}
              style={{ ['--reveal-delay' as string]: `${i * 60}ms` }}
            >
              <Icon className="size-6 text-forest-600" strokeWidth={1.6} aria-hidden="true" />
              <h3 className={`mt-4 font-semibold text-forest-950 ${i === 0 ? 'display text-[1.6rem] leading-tight' : 'text-[1.1rem]'}`}>
                {title}
              </h3>
              <p className={`mt-2 leading-relaxed text-muted ${i === 0 ? 'max-w-xl text-[1.05rem]' : 'text-[0.98rem]'}`}>{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
