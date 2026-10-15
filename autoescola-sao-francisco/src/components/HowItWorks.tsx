import { messages } from '../config/site';
import { WhatsAppLink } from './ui';

const steps = [
  {
    title: 'Entre em contato',
    text: 'Chame a equipe no WhatsApp ou passe na autoescola. Conte qual categoria você quer e tire as primeiras dúvidas.',
  },
  {
    title: 'Conheça as categorias e os requisitos',
    text: 'Você recebe a orientação sobre a categoria escolhida, os documentos e as etapas exigidas pelo Detran-ES.',
  },
  {
    title: 'Prepare-se para as etapas da formação',
    text: 'Exames, conteúdo teórico e aulas práticas com instrutor, no ritmo de cada fase do processo.',
  },
  {
    title: 'Avance rumo à sua CNH',
    text: 'Com a preparação feita, você segue para as provas do Detran com mais segurança sobre o que vai encontrar.',
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-title" className="on-dark relative overflow-hidden bg-forest-950 py-20 text-paper sm:py-28">
      <div className="container-site">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="reveal max-w-2xl">
            <p className="eyebrow">Como funciona</p>
            <h2 id="como-funciona-title" className="heading-lg mt-5 text-balance">
              Quatro etapas. Uma de cada vez.
            </h2>
            <p className="lead mt-5 text-pretty">
              Você não precisa entender o processo todo antes de começar. A gente mostra o próximo passo.
            </p>
          </div>
          <WhatsAppLink message={messages.general} cta="como-funciona" className="btn btn-primary reveal self-start lg:self-auto">
            Dar o primeiro passo
          </WhatsAppLink>
        </div>

        <div className="reveal relative mt-16">
          {/* pista: horizontal no desktop, vertical no celular */}
          <div aria-hidden="true" className="absolute top-0 bottom-0 left-[1.4rem] w-[3px] bg-paper/10 lg:top-[1.4rem] lg:right-0 lg:bottom-auto lg:left-0 lg:h-[3px] lg:w-auto">
            <div className="route-fill h-full w-full origin-top bg-lime-400 lg:origin-left" />
          </div>

          <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.8rem_1fr] gap-x-5 lg:block">
                <span className="display relative z-10 flex size-[2.8rem] items-center justify-center rounded-full bg-lime-400 text-[0.95rem] text-forest-950 ring-8 ring-forest-950 tabular-nums">
                  0{i + 1}
                </span>
                <div className="lg:mt-8 lg:pr-4">
                  <h3 className="text-[1.15rem] leading-snug font-semibold text-balance">{step.title}</h3>
                  <p className="mt-2.5 text-[0.98rem] leading-relaxed text-forest-200">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="reveal mt-14 max-w-3xl border-t border-paper/10 pt-6 text-[0.9rem] leading-relaxed text-forest-200/80">
          O tempo de cada etapa depende da agenda de exames do Detran-ES e do ritmo de cada aluno. A aprovação nas provas
          depende do desempenho do candidato.
        </p>
      </div>
    </section>
  );
}
