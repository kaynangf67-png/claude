import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  HeartPulse,
  ScanFace,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from 'lucide-react';
import { treatments, whatsappMessages, type Treatment, type TreatmentIcon } from '../config/clinic';
import { MaybePending } from './Pending';
import { SectionHeader, WhatsAppLink } from './ui';

const icons: Record<TreatmentIcon, LucideIcon> = {
  sparkles: Sparkles,
  smile: Smile,
  shield: ShieldCheck,
  stethoscope: Stethoscope,
  heart: HeartPulse,
  scan: ScanFace,
};

export function Treatments() {
  const [active, setActive] = useState<Treatment | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && !dialog.open) dialog.showModal();
    if (!active && dialog.open) dialog.close();
  }, [active]);

  return (
    <section id="tratamentos" aria-labelledby="tratamentos-title" className="bg-mist-50 py-24 sm:py-32">
      <div className="container-site">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeader
            id="tratamentos-title"
            eyebrow="Tratamentos"
            title="Tratamentos odontológicos"
            lead="Encontre o cuidado que você procura."
          />
          <WhatsAppLink
            message={whatsappMessages.general}
            cta="tratamentos-topo"
            className="btn btn-ghost reveal self-start lg:self-auto"
          >
            Tirar uma dúvida
          </WhatsAppLink>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {treatments.map((t, i) => {
            const Icon = icons[t.icon];
            return (
              <li
                key={t.id}
                id={t.id}
                className="reveal"
                style={{ ['--reveal-delay' as string]: `${(i % 3) * 80}ms` }}
              >
                <article className="group flex h-full flex-col rounded-3xl border border-navy-900/8 bg-white p-7 shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-mist-100 text-petrol-600 transition-colors duration-300 group-hover:bg-navy-900 group-hover:text-white">
                    <Icon className="size-[1.35rem]" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <h3 className="mt-6 font-display text-[1.65rem] leading-tight text-navy-900">
                    <MaybePending text={t.name} />
                  </h3>
                  <p className="mt-2 flex-1 text-[0.95rem] leading-relaxed text-muted">
                    <MaybePending text={t.summary} />
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-navy-900/8 pt-5">
                    <button
                      type="button"
                      onClick={() => setActive(t)}
                      className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-semibold text-navy-900 hover:text-petrol-600"
                      aria-haspopup="dialog"
                    >
                      Saiba mais
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                    <WhatsAppLink
                      message={whatsappMessages.treatment(t.name)}
                      cta={`tratamento-card:${t.id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-semibold text-whatsapp hover:text-whatsapp-hover"
                      ariaLabel={`Perguntar pelo WhatsApp sobre ${t.name}`}
                    >
                      WhatsApp
                    </WhatsAppLink>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="tratamento-dialog-title"
        onClose={() => setActive(null)}
        onClick={(e) => e.target === e.currentTarget && setActive(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-0 text-ink shadow-lift backdrop:bg-transparent"
      >
        {active && (
          <div className="p-7 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <p className="eyebrow">Tratamento</p>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="-mt-2 -mr-2 inline-flex size-11 items-center justify-center rounded-full text-navy-900 hover:bg-navy-900/5"
                aria-label="Fechar"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <h3 id="tratamento-dialog-title" className="mt-3 font-display text-4xl leading-tight text-navy-900">
              <MaybePending text={active.name} />
            </h3>
            <div className="mt-5 space-y-3 text-[0.98rem] leading-relaxed text-muted">
              {active.details.map((p) => (
                <p key={p}>
                  <MaybePending text={p} />
                </p>
              ))}
            </div>
            <p className="mt-6 rounded-2xl bg-mist-50 p-4 text-sm leading-relaxed text-muted">
              A indicação de qualquer tratamento depende de uma avaliação com o dentista.
            </p>
            <WhatsAppLink
              message={whatsappMessages.treatment(active.name)}
              cta={`tratamento-modal:${active.id}`}
              className="btn btn-whatsapp mt-7 w-full min-h-14"
            >
              Quero saber mais pelo WhatsApp
            </WhatsAppLink>
          </div>
        )}
      </dialog>
    </section>
  );
}
