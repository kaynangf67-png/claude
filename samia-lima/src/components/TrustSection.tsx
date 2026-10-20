import type { CSSProperties } from 'react';
import { BadgeCheck, MapPin, MessageCircleHeart, UserRound } from 'lucide-react';
import { locationLabel, professional } from '../config/site';

const items = [
  { icon: UserRound, label: 'Profissional', value: professional.fullName },
  { icon: BadgeCheck, label: professional.profession, value: professional.cro },
  { icon: MapPin, label: 'Atendimento', value: locationLabel },
  {
    icon: MessageCircleHeart,
    label: 'Cuidado',
    value: 'Atendimento individual, com tempo para ouvir e explicar cada etapa.',
  },
];

/** Faixa de credenciais: apenas informações verificáveis. */
export function TrustSection() {
  return (
    <section aria-label="Informações profissionais" className="border-y border-line bg-white">
      <ul className="container-site grid gap-x-10 gap-y-8 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:py-14">
        {items.map(({ icon: Icon, label, value }, i) => (
          <li
            key={label}
            className="reveal flex gap-4 lg:border-l lg:border-line lg:pl-8 lg:first:border-0 lg:first:pl-0"
            style={{ '--reveal-delay': `${i * 70}ms` } as CSSProperties}
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-wine-800" strokeWidth={1.6} aria-hidden="true" />
            <div>
              <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted uppercase">{label}</p>
              <p className="mt-1.5 text-[0.98rem] leading-snug text-wine-950">{value}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
