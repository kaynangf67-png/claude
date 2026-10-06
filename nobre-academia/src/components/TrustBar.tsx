import { Accessibility, BadgeCheck, MapPin, Star } from 'lucide-react';
import { academia } from '../config/academia';

const rating = academia.googleRating.toLocaleString('pt-BR', { minimumFractionDigits: 1 });

const items = [
  { icon: Star, title: `${rating}/5 no Google`, text: 'Avaliada por alunos e clientes' },
  { icon: MapPin, title: 'Av. Abido Saad', text: `${academia.address.neighborhood}, ${academia.address.city}/ES` },
  { icon: BadgeCheck, title: 'Wellhub e TotalPass', text: 'Presente nas plataformas de benefício' },
  { icon: Accessibility, title: 'Espaço acessível', text: 'Adaptado para cadeira de rodas' },
];

export function TrustBar() {
  return (
    <section aria-label="Destaques da Nobre Academia" className="border-b border-white/[0.06] bg-ink-950">
      <ul className="container-x grid grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }, i) => (
          <li
            key={title}
            className={`reveal flex flex-col gap-3 border-white/[0.07] px-4 py-8 sm:flex-row sm:items-center sm:gap-4 sm:px-6 lg:px-8 lg:py-10 ${
              i % 2 === 1 ? 'border-l' : ''
            } ${i === 2 ? 'lg:border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i % 2 === 0 ? 'pl-0 sm:pl-0' : ''} ${i === 2 ? 'lg:pl-8' : ''}`}
            style={{ ['--d' as string]: `${i * 70}ms` }}
          >
            <Icon className={`size-6 shrink-0 ${i === 0 ? 'fill-amber-400 text-amber-400' : 'text-ember-500'}`} aria-hidden />
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
