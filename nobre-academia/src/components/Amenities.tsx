import { amenities } from '../config/academia';
import { amenityIcons } from './icons';
import { SectionHeader } from './ui';

export function Amenities() {
  return (
    <section aria-labelledby="comodidades-title" className="section">
      <div className="container-x">
        <SectionHeader
          id="comodidades-title"
          eyebrow="Comodidades"
          align="center"
          title={
            <>
              Tudo para tornar seu treino <span className="text-accent">mais completo</span>
            </>
          }
        />
        <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {amenities.map((a, i) => {
            const Icon = amenityIcons[a.icon];
            return (
              <li
                key={a.name}
                className="reveal card card-hover group p-5 text-center sm:p-7"
                style={{ ['--d' as string]: `${i * 80}ms` }}
              >
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition duration-500 group-hover:bg-ember-500 group-hover:ring-ember-500">
                  <Icon className="size-7 text-ember-500 transition-colors duration-500 group-hover:text-white" aria-hidden />
                </span>
                <h3 className="heading-md mt-5 text-base sm:mt-6 sm:text-[1.3rem]">{a.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{a.description}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
