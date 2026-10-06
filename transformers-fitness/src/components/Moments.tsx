import { messages } from '../config/academia';
import { ContactLink } from './ui';

const moments = [
  { title: 'Começando agora?', text: 'Não precisa ser especialista para começar. Todo mundo dá o primeiro passo um dia.' },
  { title: 'Quer voltar a treinar?', text: 'Retome sua rotina no seu ritmo, sem pressa e sem comparação.' },
  { title: 'Já treina?', text: 'Continue buscando evolução e consistência, treino após treino.' },
  { title: 'Quer mais disposição?', text: 'Inclua movimento na sua rotina e sinta a diferença no dia a dia.' },
];

export function Moments() {
  return (
    <section aria-labelledby="momentos-title" className="section relative overflow-hidden">
      <div className="container-x">
        <div className="reveal max-w-3xl">
          <p className="eyebrow">Para todos os momentos</p>
          <h2 id="momentos-title" className="heading-lg mt-5 text-balance">
            Não importa de onde você parte. <span className="text-outline">Importa começar.</span>
          </h2>
        </div>

        <ol className="mt-14 border-t border-white/[0.08]">
          {moments.map((m, i) => (
            <li
              key={m.title}
              className="reveal group grid gap-3 border-b border-white/[0.08] py-8 transition-colors duration-500 hover:bg-white/[0.015] sm:grid-cols-[5rem_1fr] md:grid-cols-[6rem_1.2fr_1fr] md:items-center md:gap-8 md:py-10"
              style={{ ['--d' as string]: `${i * 70}ms` }}
            >
              <span className="text-sm font-semibold text-brand-500 tabular-nums">0{i + 1}</span>
              <h3 className="text-[1.65rem] leading-[1.05] font-black tracking-tight uppercase transition-transform duration-500 [font-stretch:115%] group-hover:translate-x-2 sm:text-4xl">
                {m.title}
              </h3>
              <p className="text-lg leading-relaxed text-mist-400 sm:col-start-2 md:col-start-auto">{m.text}</p>
            </li>
          ))}
        </ol>

        <div className="reveal mt-12">
          <ContactLink message={messages.visit} cta="momentos" arrow className="btn btn-ghost w-full sm:w-auto">
            Dar o primeiro passo
          </ContactLink>
        </div>
      </div>
    </section>
  );
}
