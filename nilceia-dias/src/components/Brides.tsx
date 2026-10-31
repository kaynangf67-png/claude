import { brand, facts } from '../config/site';
import { useViewEvent } from '../hooks/useReveal';
import { photos } from '../lib/photos';
import { Ornament, WhatsAppLink } from './ui';

const POINTS = [
  { title: 'Experiência com noivas', text: 'Uma trajetória construída acompanhando o grande dia de muitas mulheres.' },
  { title: 'Seu estilo em primeiro lugar', text: 'Atenção às suas preferências, ao vestido e ao que você imagina para a produção.' },
  { title: 'Conversa inicial', text: 'Antes de tudo, entendemos a ocasião, o horário e o que é importante para você.' },
  { title: 'Data e planejamento', text: 'Consulta de disponibilidade para a sua data e orientação sobre os próximos passos.' },
];

export function Brides() {
  const ref = useViewEvent<HTMLElement>('view_brides_section');
  const p = photos.tranca;

  return (
    <section ref={ref} id="noivas" aria-labelledby="noivas-titulo" className="on-dark relative overflow-hidden bg-onyx text-champagne">
      <div className="wrap grid gap-12 py-20 sm:py-28 lg:grid-cols-12 lg:gap-16 lg:py-32">
        <div className="relative lg:col-span-5">
          <div className="relative mx-auto max-w-[28rem] lg:sticky lg:top-28">
            <img
              src={p.src}
              srcSet={p.srcSet}
              sizes="(min-width: 1024px) 440px, 88vw"
              width={p.width}
              height={p.height}
              alt={p.alt}
              loading="lazy"
              decoding="async"
              className="arch reveal aspect-[3/4] w-full object-cover"
            />
            {facts.brides.show && (
              <div className="absolute right-0 -bottom-6 bg-paper px-6 py-5 text-onyx sm:-right-6">
                <p className="display text-[2.6rem] leading-none">{facts.brides.value}</p>
                <p className="mt-1 text-[0.62rem] font-semibold tracking-[0.2em] text-muted uppercase">{facts.brides.label}</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 lg:col-start-7 lg:pt-8">
          <p className="eyebrow">Noivas</p>
          <h2 id="noivas-titulo" className="h-section reveal mt-6 text-paper">
            Seu grande dia merece uma profissional <em className="accent">em quem você confia.</em>
          </h2>
          <p className="lead reveal mt-7">
            Uma data especial merece cuidado desde o planejamento até os últimos detalhes da produção. A experiência de Nilcéia Dias com
            noivas é um diferencial para quem procura tranquilidade, atenção e uma produção alinhada ao seu estilo.
          </p>

          <ul className="mt-10 grid gap-x-10 sm:grid-cols-2">
            {POINTS.map((pt) => (
              <li key={pt.title} className="reveal border-t border-gold/25 py-6">
                <h3 className="display text-[1.45rem] leading-tight text-paper">{pt.title}</h3>
                <p className="mt-2 text-[0.95rem] text-muted-dark">{pt.text}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center">
            <WhatsAppLink intent="brides" source="brides" category="noivas" ctaId="noivas-destaque" className="btn-gold w-full sm:w-auto">
              Quero conversar sobre minha data
            </WhatsAppLink>
            <a
              href={brand.casamentos.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center text-[0.75rem] tracking-[0.14em] text-muted-dark uppercase underline-offset-4 hover:text-champagne hover:underline"
            >
              Nota {brand.casamentos.rating} no Casamentos.com.br ↗
            </a>
          </div>
          <Ornament className="mt-14" />
        </div>
      </div>
    </section>
  );
}
