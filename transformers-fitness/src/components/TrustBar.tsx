import { BadgeCheck, Clock, HeartHandshake, MapPin } from 'lucide-react';
import { academia } from '../config/academia';

const items = [
  { icon: Clock, title: 'Abre às 5h', text: 'Segunda a sexta, até as 22h' },
  { icon: MapPin, title: 'Av. Minas Gerais', text: `${academia.address.district}, ${academia.address.city}/ES` },
  { icon: BadgeCheck, title: 'Wellhub e TotalPass', text: 'Aceitos na academia' },
  { icon: HeartHandshake, title: 'Atendimento personalizado', text: 'Em um ambiente familiar' },
];

export function TrustBar() {
  return (
    <section aria-label={`Destaques da ${academia.name}`} className="border-b border-white/[0.06] bg-ink-950">
      <ul className="container-x grid grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }, i) => (
          <li
            key={title}
            className={`reveal flex flex-col gap-3 border-white/[0.07] px-4 py-8 sm:flex-row sm:items-center sm:gap-4 sm:px-6 lg:px-8 lg:py-10 ${
              i % 2 === 1 ? 'border-l' : ''
            } ${i === 2 ? 'lg:border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i % 2 === 0 ? 'pl-0 sm:pl-0' : ''} ${i === 2 ? 'lg:pl-8' : ''}`}
            style={{ ['--d' as string]: `${i * 70}ms` }}
          >
            <Icon className={`size-6 shrink-0 text-brand-500`} aria-hidden />
            <div>
              <p className="font-bold leading-tight [font-stretch:108%]">{title}</p>
              <p className="mt-1 text-sm leading-snug text-mist-400">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
