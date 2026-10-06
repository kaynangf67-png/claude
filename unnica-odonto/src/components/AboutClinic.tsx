import { BadgeCheck } from 'lucide-react';
import { clinic } from '../config/clinic';
import { photos } from '../lib/photos';
import { Pending } from './Pending';
import { Photo, SectionHeader } from './ui';

export function AboutClinic() {
  const lead = clinic.technicalLead;
  return (
    <section id="clinica" aria-labelledby="sobre-title" className="bg-white py-24 sm:py-32">
      <div className="container-site grid items-center gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="reveal relative order-2 lg:order-1 lg:col-span-5">
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[2rem] shadow-lift">
            <Photo photo={photos.atendimento} imgClassName="object-[60%_55%]" />
          </div>
          <div
            aria-hidden="true"
            className="absolute -top-5 -right-3 -z-10 hidden h-40 w-40 rounded-[2rem] bg-sand-100 sm:block lg:-right-8"
          />
        </div>

        <div className="order-1 lg:order-2 lg:col-span-7">
          <SectionHeader
            id="sobre-title"
            eyebrow="A clínica"
            title={`Conheça a ${clinic.name}`}
            lead={`A ${clinic.name} foi pensada para oferecer uma experiência odontológica que une cuidado, conforto e profissionalismo em um ambiente moderno.`}
          />

          <div className="reveal mt-6 space-y-4 text-[1rem] leading-relaxed text-muted">
            {clinic.history.length > 0 ? (
              clinic.history.map((p) => <p key={p}>{p}</p>)
            ) : (
              <p>
                <Pending>[Inserir aqui a história oficial da clínica: como surgiu, proposta e valores.]</Pending>
              </p>
            )}
          </div>

          <dl className="reveal mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-navy-900/8 bg-sand-50 p-6">
              <dt className="flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.14em] text-petrol-600 uppercase">
                <BadgeCheck className="size-4" aria-hidden="true" />
                Responsável técnico(a)
              </dt>
              <dd className="mt-3 font-display text-2xl leading-tight text-navy-900">
                {lead.name || <Pending>[Nome]</Pending>}
              </dd>
              <dd className="mt-1 text-sm text-muted">{lead.cro || <Pending>[CRO-UF 0000]</Pending>}</dd>
            </div>
            <div className="rounded-3xl border border-navy-900/8 bg-sand-50 p-6">
              <dt className="text-[0.75rem] font-semibold tracking-[0.14em] text-petrol-600 uppercase">Equipe</dt>
              <dd className="mt-3 text-[0.95rem] leading-relaxed text-muted">
                <Pending>[Apresentação da equipe e especialidades confirmadas pela clínica]</Pending>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
