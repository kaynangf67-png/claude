import { WhatsAppLink } from './ui';
import type { Intent } from '../config/site';

const PATHS: { letter: string; title: string; text: string; cta: string; intent: Intent }[] = [
  {
    letter: 'A',
    title: 'Quero me sentir ainda mais bonita',
    text: 'Para mulheres que procuram renovar o visual, cuidar dos cabelos e valorizar sua beleza.',
    cta: 'Quero renovar meu visual',
    intent: 'hair',
  },
  {
    letter: 'B',
    title: 'Quero recuperar o aspecto dos meus fios',
    text: 'Para quem deseja entender as necessidades dos cabelos e conhecer possibilidades de cuidado.',
    cta: 'Quero cuidar dos meus fios',
    intent: 'treatments',
  },
  {
    letter: 'C',
    title: 'Estou me preparando para um momento especial',
    text: 'Para noivas e mulheres que procuram uma produção especial.',
    cta: 'Tenho uma data especial',
    intent: 'brides',
  },
];

export function Identification() {
  return (
    <section aria-labelledby="identificacao-titulo" className="py-20 sm:py-28 lg:py-32">
      <div className="wrap">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-12">
          <h2 id="identificacao-titulo" className="h-section reveal lg:col-span-7">
            Cada mulher tem sua beleza. <em className="accent">Cada cabelo tem sua história.</em>
          </h2>
          <p className="lead reveal max-w-md lg:col-span-4 lg:col-start-9 lg:self-end">
            Não existe uma única forma de cuidar da beleza. Existem objetivos, momentos e necessidades diferentes. Por isso, cada
            atendimento merece atenção aos detalhes e uma escolha adequada ao que você procura.
          </p>
        </div>

        <ol className="mt-14 grid border-t border-onyx/80 sm:mt-20 lg:grid-cols-3">
          {PATHS.map((p, i) => (
            <li
              key={p.letter}
              className={`reveal flex flex-col border-b border-line py-9 lg:border-b-0 lg:px-10 lg:py-12 ${
                i === 0 ? 'lg:pl-0' : 'lg:border-l'
              } ${i === 2 ? 'lg:pr-0' : ''}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span aria-hidden="true" className="display text-[3.4rem] leading-none text-gold italic">
                {p.letter}
              </span>
              <h3 className="mt-5 text-[0.82rem] leading-relaxed font-semibold tracking-[0.16em] uppercase">{p.title}</h3>
              <p className="mt-3 max-w-sm text-muted">{p.text}</p>
              <WhatsAppLink
                intent={p.intent}
                source="identification"
                ctaId={`identificacao-${p.letter.toLowerCase()}`}
                className="link-arrow mt-6 self-start"
                icon={false}
              >
                {p.cta} →
              </WhatsAppLink>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
