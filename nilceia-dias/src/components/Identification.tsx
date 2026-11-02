import { CalendarHeart, Droplets, Sparkles, type LucideIcon } from 'lucide-react';
import type { Intent } from '../config/site';
import { WhatsAppLink } from './ui';

const PATHS: { icon: LucideIcon; title: string; text: string; cta: string; intent: Intent; id: string }[] = [
  {
    icon: Sparkles,
    title: 'Quero me sentir ainda mais bonita',
    text: 'Para renovar o visual, cuidar dos cabelos e valorizar sua beleza.',
    cta: 'Quero renovar meu visual',
    intent: 'hair',
    id: 'a',
  },
  {
    icon: Droplets,
    title: 'Quero recuperar o aspecto dos meus fios',
    text: 'Para entender o que seus cabelos precisam e conhecer possibilidades de cuidado.',
    cta: 'Quero cuidar dos meus fios',
    intent: 'treatments',
    id: 'b',
  },
  {
    icon: CalendarHeart,
    title: 'Estou me preparando para um momento especial',
    text: 'Para noivas e mulheres que procuram uma produção especial.',
    cta: 'Tenho uma data especial',
    intent: 'brides',
    id: 'c',
  },
];

/** Três cards de vidro sobrepostos à base do hero: a visitante escolhe o próprio caminho. */
export function Identification() {
  return (
    <section aria-labelledby="identificacao-titulo" className="relative z-10 -mt-20 pb-6 sm:-mt-24">
      <h2 id="identificacao-titulo" className="sr-only">
        O que você procura?
      </h2>
      <ol className="wrap grid gap-3 md:grid-cols-3 md:gap-5">
        {PATHS.map(({ icon: Icon, ...p }, i) => (
          <li
            key={p.id}
            className={`glass card-shadow reveal grid grid-cols-[auto_1fr] gap-x-4 rounded-3xl px-5 pt-5 pb-3 text-left md:flex md:flex-col md:items-center md:px-6 md:pt-7 md:pb-6 md:text-center ${i === 1 ? 'md:-translate-y-3' : ''}`}
            style={{ transitionDelay: `${i * 90}ms` }}
          >
            <span className="row-span-3 flex size-11 items-center justify-center rounded-full bg-paper md:size-14 text-gold-ink shadow-[0_6px_16px_-8px_rgb(26_26_26/0.35)]">
              <Icon aria-hidden="true" strokeWidth={1.4} className="size-5 md:size-6" />
            </span>
            <h3 className="text-[1.05rem] leading-snug md:mt-5 md:text-[1.15rem] tracking-[-0.01em] text-onyx">{p.title}</h3>
            <p className="mt-1 text-[0.9rem] leading-relaxed text-muted md:mt-2 md:max-w-[18rem] md:text-[0.92rem]">{p.text}</p>
            <WhatsAppLink
              intent={p.intent}
              source="identification"
              ctaId={`identificacao-${p.id}`}
              className="link-arrow self-start md:mt-3 md:self-auto"
              icon={false}
            >
              {p.cta} →
            </WhatsAppLink>
          </li>
        ))}
      </ol>
    </section>
  );
}
