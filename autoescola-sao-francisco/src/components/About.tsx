import { MapPin } from 'lucide-react';
import { site } from '../config/site';
import { addressLine, addressRegion, mapsUrl } from '../lib/location';
import { photos } from '../lib/photos';
import { Photo } from './ui';

const differentials = [
  {
    title: 'Atendimento personalizado',
    text: 'Você conversa com a equipe, explica o seu momento e recebe orientação para o seu caso, sem roteiro pronto.',
  },
  {
    title: 'Orientação durante o processo',
    text: 'Exames, aulas e prova: você sabe o que vem a seguir e o que precisa providenciar em cada etapa.',
  },
  {
    title: 'Instrução profissional',
    text: 'Aulas com instrutor, para treinar manobras e circulação com segurança antes da prova.',
  },
  {
    title: 'Direção segura e responsável',
    text: 'O foco não é só passar no exame. É sair dirigindo com atenção, respeito às regras e cuidado com quem divide a rua.',
  },
  {
    title: 'Informação clara',
    text: 'Categorias, cursos e requisitos explicados de forma direta, para você decidir com segurança.',
  },
];

/** Sem foto: um "mapa de rota" do primeiro contato até a CNH, com o endereço real. */
function RouteCard() {
  return (
    <div className="on-dark relative flex h-full min-h-[420px] flex-col lg:min-h-[600px] justify-between overflow-hidden rounded-[22px] bg-forest-900 p-6 text-paper sm:p-9">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgb(245_243_236/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(245_243_236/0.06)_1px,transparent_1px)] bg-[size:32px_32px]"
      />
      <svg viewBox="0 0 320 360" className="absolute inset-x-0 top-0 h-52 w-full sm:h-[58%]" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path
          d="M40 330 C 60 260, 130 270, 150 210 S 240 170, 255 120 S 270 90, 280 70"
          fill="none"
          stroke="#c4ef4f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="2 10"
        />
        <circle cx="40" cy="330" r="7" fill="#f5f3ec" />
        <circle cx="280" cy="70" r="9" fill="#c4ef4f" />
        <circle cx="280" cy="70" r="18" fill="none" stroke="#c4ef4f" strokeOpacity="0.4" />
      </svg>
      <div className="relative flex items-center justify-between text-[0.72rem] font-semibold tracking-[0.2em] text-forest-200 uppercase">
        <span>Do primeiro contato</span>
        <span className="text-lime-300">à CNH</span>
      </div>
      <div className="relative pt-44 sm:pt-0">
        <p className="display max-w-[16ch] text-[1.9rem] leading-[1.05] sm:text-[2.2rem]">
          Seu ponto de partida fica em Serra.
        </p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-paper/15 bg-forest-950/40 p-4 transition-colors hover:border-lime-400/60"
        >
          <MapPin className="mt-0.5 size-5 shrink-0 text-lime-400" aria-hidden="true" />
          <span className="text-[0.95rem] leading-snug">
            <span className="block font-semibold">{addressLine}</span>
            <span className="text-forest-200">{addressRegion}</span>
          </span>
        </a>
      </div>
    </div>
  );
}

export function About() {
  return (
    <section id="autoescola" aria-labelledby="autoescola-title" className="py-20 sm:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="reveal lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          {photos.about ? (
            <div className="aspect-[4/5] overflow-hidden rounded-[22px]">
              <Photo photo={photos.about} sizes="(min-width: 1024px) 40vw, 100vw" />
            </div>
          ) : (
            <RouteCard />
          )}
        </div>

        <div className="lg:col-span-7">
          <div className="reveal">
            <p className="eyebrow">A Autoescola</p>
            <h2 id="autoescola-title" className="heading-lg mt-5 text-balance text-forest-950">
              Aprender a dirigir é aprender a cuidar.
            </h2>
            <div className="lead mt-6 space-y-4 text-pretty">
              <p>
                A CNH abre caminhos: trabalho, estudo, autonomia para ir e vir. Mas dirigir bem vai além da prova.
                É ter confiança ao volante, entender o trânsito e tomar decisões seguras, para você e para quem está
                ao redor.
              </p>
              <p>
                A {site.name} é um {site.kind.toLowerCase()} em {site.address.city}, {site.address.state}. A nossa
                proposta é simples: acompanhar cada aluno de perto, explicar o processo com clareza e preparar você
                para dirigir com responsabilidade.
              </p>
            </div>
          </div>

          <ol className="mt-12 border-t border-forest-900/12">
            {differentials.map((item, i) => (
              <li
                key={item.title}
                className="reveal grid grid-cols-[3rem_1fr] gap-x-4 border-b border-forest-900/12 py-6 sm:grid-cols-[4rem_1fr_1.3fr] sm:gap-x-8"
                style={{ ['--reveal-delay' as string]: `${i * 60}ms` }}
              >
                <span className="display pt-0.5 text-[0.95rem] text-forest-600 tabular-nums">0{i + 1}</span>
                <h3 className="text-[1.08rem] font-semibold text-forest-950">{item.title}</h3>
                <p className="col-start-2 mt-1.5 text-[0.98rem] leading-relaxed text-muted sm:col-start-3 sm:mt-0">
                  {item.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
