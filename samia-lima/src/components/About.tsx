import type { CSSProperties } from 'react';
import { BadgeCheck, GraduationCap } from 'lucide-react';
import { about, professional, whatsappMessages } from '../config/site';
import { photos } from '../lib/photos';
import { isPreview } from '../lib/preview';
import { BrandPanel, PendingBadge, Photo, WhatsAppLink } from './ui';

export function About() {
  return (
    <section id="sobre" aria-labelledby="sobre-titulo" className="py-20 sm:py-28">
      <div className="container-site grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="reveal relative mx-auto w-full max-w-[24rem] lg:max-w-none">
          <div className="arch aspect-[4/5] overflow-hidden">
            {photos.about ? (
              <Photo photo={photos.about} className="h-full" sizes="(min-width: 1024px) 420px, 90vw" />
            ) : (
              <BrandPanel className="h-full" variant="soft" />
            )}
          </div>
          {!photos.about && isPreview && (
            <p className="mt-3 text-center">
              <PendingBadge>Espaço para o retrato da Dra. Sâmia</PendingBadge>
            </p>
          )}
        </div>

        <div className="reveal" style={{ '--reveal-delay': '80ms' } as CSSProperties}>
          <p className="eyebrow">A Dra. Sâmia</p>
          <h2 id="sobre-titulo" className="heading-lg mt-5 text-balance">
            Conheça a {professional.brandName}
          </h2>

          <blockquote className="mt-8 border-l-2 border-wine-800/40 pl-6">
            <p
              className="font-display text-[1.35rem] leading-[1.45] text-wine-950 italic sm:text-[1.5rem]"
              style={{ fontVariationSettings: "'opsz' 40" }}
            >
              {about.intro}
            </p>
          </blockquote>

          {about.bio.map((p) => (
            <p key={p} className="lead mt-6 text-pretty">
              {p}
            </p>
          ))}

          <dl className="mt-9 grid gap-4 sm:grid-cols-2">
            <div className="card flex gap-4 p-5">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-wine-800" strokeWidth={1.6} aria-hidden="true" />
              <div>
                <dt className="text-[0.7rem] font-semibold tracking-[0.18em] text-muted uppercase">Registro profissional</dt>
                <dd className="mt-1 text-wine-950">
                  {professional.profession}
                  <span className="block text-muted">{professional.cro}</span>
                </dd>
              </div>
            </div>
            {about.credentials.map((c) => (
              <div key={c.title} className="card flex gap-4 p-5">
                <GraduationCap className="mt-0.5 size-5 shrink-0 text-wine-800" strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <dt className="text-wine-950">{c.title}</dt>
                  {c.detail && <dd className="mt-1 text-[0.9rem] text-muted">{c.detail}</dd>}
                </div>
              </div>
            ))}
            {about.credentials.length === 0 && isPreview && (
              <div className="flex flex-col items-start justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-amber-600/40 p-5">
                <PendingBadge />
                <p className="text-[0.85rem] text-muted">
                  Formação, cursos e trajetória: preencher em <code>about.credentials</code>.
                </p>
              </div>
            )}
          </dl>

          <WhatsAppLink message={whatsappMessages.general} cta="sobre" className="btn btn-primary mt-10">
            Quero conversar com a {professional.shortName}
          </WhatsAppLink>
        </div>
      </div>
    </section>
  );
}
