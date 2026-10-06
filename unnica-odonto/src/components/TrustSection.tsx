import { Armchair, Building2, HeartHandshake, Sparkles } from 'lucide-react';

const items = [
  { icon: Building2, title: 'Ambiente moderno', text: 'Espaços planejados e acolhedores' },
  { icon: HeartHandshake, title: 'Atendimento personalizado', text: 'Cuidado de acordo com sua necessidade' },
  { icon: Armchair, title: 'Estrutura completa', text: 'Recepção confortável e consultórios equipados' },
  { icon: Sparkles, title: 'Tecnologia e conforto', text: 'Recursos para uma experiência tranquila' },
];

export function TrustSection() {
  return (
    <section aria-label="Por que confiar" className="relative z-10 bg-white">
      <div className="container-site">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-navy-900/8 bg-navy-900/8 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className="reveal flex flex-col gap-3 bg-white p-5 sm:p-7"
              style={{ ['--reveal-delay' as string]: `${i * 70}ms` }}
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-mist-100 text-petrol-600">
                <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.95rem] leading-snug font-semibold text-navy-900">{title}</p>
                <p className="mt-1 text-[0.82rem] leading-snug text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
