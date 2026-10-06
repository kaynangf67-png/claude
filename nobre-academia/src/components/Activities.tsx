import { ArrowUpRight } from 'lucide-react';
import { activities, messages } from '../config/academia';
import { contactUrl, hasWhatsApp } from '../lib/contact';
import { getPhoto } from '../lib/photos';
import { activityIcons } from './icons';
import { ContactLink, Photo, SectionHeader } from './ui';

export function Activities() {
  return (
    <section id="atividades" aria-labelledby="atividades-title" className="section relative bg-ink-900">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeader
            id="atividades-title"
            eyebrow="Modalidades"
            title={
              <>
                Encontre o treino <span className="text-accent">que combina com você</span>
              </>
            }
            lead="Da musculação às aulas coletivas: escolha por objetivo, por energia ou simplesmente pelo que você gosta de fazer."
          />
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {activities.map((a, i) => {
            const Icon = activityIcons[a.icon];
            const photo = getPhoto(a.image);
            return (
              <li
                key={a.slug}
                id={a.slug}
                className="reveal scroll-mt-28"
                style={{ ['--d' as string]: `${(i % 3) * 90}ms` }}
              >
                <a
                  href={contactUrl(messages.activity(a.name))}
                  {...(hasWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  data-cta={`modalidade:${a.slug}`}
                  className="card card-hover group flex h-full flex-col"
                >
                  <div className="relative aspect-[16/7] overflow-hidden sm:aspect-[16/10] bg-ink-800">
                    {photo ? (
                      <Photo
                        photo={photo}
                        alt={`Aula de ${a.name} na Nobre Academia`}
                        sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
                        imgClassName="zoom-img"
                        className="absolute inset-0"
                      />
                    ) : (
                      // Arte gráfica enquanto não há foto real da modalidade
                      <div className="absolute inset-0 overflow-hidden" aria-hidden>
                        <div className="grid-lines absolute inset-0 opacity-60" />
                        <div className="absolute -right-10 -bottom-16 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_90_31/0.35),transparent_65%)] transition-transform duration-1000 group-hover:scale-125" />
                        <Icon
                          className="zoom-img absolute -right-4 -bottom-6 size-44 text-white/[0.07]"
                          strokeWidth={1}
                        />
                        <span className="absolute top-5 left-6 text-[4.5rem] leading-none font-black text-white/[0.06] [font-stretch:125%]">
                          0{i + 1}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-850 via-ink-850/10 to-transparent" />
                    <span className="icon-tile absolute bottom-5 left-6 border-white/10 bg-ink-950/70 backdrop-blur">
                      <Icon className="size-6" aria-hidden />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6 pt-5 sm:p-7 sm:pt-5">
                    <h3 className="text-2xl font-black tracking-tight uppercase [font-stretch:115%]">{a.name}</h3>
                    <p className="mt-2.5 leading-relaxed text-mist-400">{a.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ember-500 transition-colors group-hover:text-ember-300">
                      Saber mais sobre {a.name}
                      <ArrowUpRight
                        className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden
                      />
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="reveal mt-14 flex flex-col items-center gap-4 text-center">
          <p className="text-mist-400">Quer ajuda para escolher? A equipe da Nobre te orienta.</p>
          <ContactLink message={messages.plans} cta="modalidades" arrow className="btn btn-primary w-full sm:w-auto">
            Quero saber mais
          </ContactLink>
        </div>
      </div>
    </section>
  );
}
