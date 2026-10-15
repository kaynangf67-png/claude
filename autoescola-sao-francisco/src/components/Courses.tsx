import { ArrowUpRight, GraduationCap } from 'lucide-react';
import { courses, messages } from '../config/site';
import { photos } from '../lib/photos';
import { Pending, Photo, WhatsAppLink } from './ui';

export function Courses() {
  return (
    <section id="cursos" aria-labelledby="cursos-title" className="py-20 sm:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <div className="reveal">
            <p className="eyebrow">Cursos profissionalizantes</p>
            <h2 id="cursos-title" className="heading-lg mt-5 text-balance text-forest-950">
              A CNH também abre portas no trabalho.
            </h2>
            <p className="lead mt-5 text-pretty">
              Para quem quer fazer da direção uma profissão, existem cursos especializados. Pergunte pelo WhatsApp
              quais cursos a autoescola oferece e quais turmas estão abertas.
            </p>
            <WhatsAppLink message={messages.courses} cta="cursos" className="btn btn-dark mt-8">
              Ver cursos disponíveis
            </WhatsAppLink>
          </div>
          {photos.courses && (
            <div className="reveal mt-10 aspect-[16/10] overflow-hidden rounded-[22px]">
              <Photo photo={photos.courses} sizes="(min-width: 1024px) 38vw, 100vw" />
            </div>
          )}
        </div>

        <div className="lg:col-span-7">
          {courses.length > 0 ? (
            <ul className="border-t border-forest-900/12">
              {courses.map((course, i) => {
                const name = course.name || `Curso ${String(i + 1).padStart(2, '0')}`;
                return (
                  <li key={i} className="reveal border-b border-forest-900/12" style={{ ['--reveal-delay' as string]: `${i * 60}ms` }}>
                    <WhatsAppLink
                      message={course.name ? messages.course(course.name) : messages.courses}
                      cta={`curso-${i + 1}`}
                      showIcon={false}
                      className="group grid grid-cols-[2.75rem_1fr_auto] items-start gap-x-4 py-7 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-x-6"
                      ariaLabel={course.name ? `Perguntar pelo WhatsApp sobre o curso ${course.name}` : undefined}
                    >
                      <span className="flex size-11 items-center justify-center rounded-full bg-forest-900/[0.06] text-forest-700 transition-colors group-hover:bg-lime-400 group-hover:text-forest-950">
                        <GraduationCap className="size-5" strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="heading-md block text-forest-950">
                          {course.name || <Pending>{`nome do ${name.toLowerCase()}`}</Pending>}
                        </span>
                        <span className="mt-2 block text-[0.98rem] leading-relaxed text-muted">
                          {course.description || <Pending>descrição curta: para quem é e o que ensina</Pending>}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="mt-1 size-5 text-forest-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </WhatsAppLink>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="reveal rounded-[22px] border border-forest-900/12 bg-white p-8">
              <p className="text-muted">Consulte a equipe sobre os cursos com turmas abertas.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
