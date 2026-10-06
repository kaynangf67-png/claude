import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { messages, openingHours } from '../config/academia';
import { ContactLink, MaybePending, SectionHeader } from './ui';

// openingHours começa na segunda; Date.getDay() começa no domingo.
const toIndex = (jsDay: number) => (jsDay + 6) % 7;

export function Hours() {
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(toIndex(new Date().getDay())), []);

  return (
    <section id="horarios" aria-labelledby="horarios-title" className="section bg-ink-900">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div>
          <SectionHeader
            id="horarios-title"
            eyebrow="Horários"
            title={
              <>
                Horários de <span className="text-accent">funcionamento</span>
              </>
            }
            lead="Encaixe o treino no seu dia. Na dúvida, confirme com a equipe antes de vir."
          />
          <div className="reveal mt-9" style={{ ['--d' as string]: '120ms' }}>
            <ContactLink message={messages.hours} cta="horarios" arrow className="btn btn-primary w-full sm:w-auto">
              Consultar horário
            </ContactLink>
          </div>
        </div>

        <div className="reveal card p-2 sm:p-3" style={{ ['--d' as string]: '80ms' }}>
          <ul>
            {openingHours.map((d, i) => {
              const isToday = today === i;
              return (
                <li
                  key={d.day}
                  className={`flex items-center justify-between gap-4 rounded-xl px-5 py-4 sm:px-6 ${
                    isToday ? 'bg-ember-500/10 ring-1 ring-ember-500/30' : ''
                  } ${i > 0 && !isToday && today !== i - 1 ? 'border-t border-white/[0.06]' : ''}`}
                >
                  <span className="flex items-center gap-3 font-semibold">
                    {d.day}
                    {isToday && (
                      <span className="rounded-full bg-ember-500 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider uppercase">
                        Hoje
                      </span>
                    )}
                  </span>
                  <span className="text-right text-mist-300 tabular-nums">
                    <MaybePending text={d.hours} />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-3 border-t border-white/[0.06] px-5 pt-5 pb-3 text-sm text-mist-400 sm:px-6">
            <Clock className="mt-0.5 size-4 shrink-0 text-ember-500" aria-hidden />
            Horários podem sofrer alterações em feriados e datas especiais. Consulte a academia.
          </p>
        </div>
      </div>
    </section>
  );
}
