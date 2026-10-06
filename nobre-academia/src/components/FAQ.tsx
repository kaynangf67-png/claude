import { useId, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { academia, activities, messages, openingHours } from '../config/academia';
import { hasWhatsApp, telUrl } from '../lib/contact';
import { ContactLink, SectionHeader } from './ui';

const a = academia.address;
const list = activities.map((x) => x.name);
const activityList = `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
const hoursConfirmed = !openingHours.some((d) => /\[.*\]/.test(d.hours));
const has = (name: string) => activities.some((x) => x.name === name);

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: 'Onde fica a Nobre Academia?',
    a: (
      <>
        Na {a.streetLong}, {a.neighborhood}, {a.city} – {a.state}, CEP {a.postalCode}.{' '}
        <a href={academia.mapsUrl} target="_blank" rel="noopener noreferrer" className="link">
          Abrir no Google Maps
        </a>
        .
      </>
    ),
  },
  {
    q: 'Quais atividades a academia oferece?',
    a: (
      <>
        {activityList}. Para saber dias e horários de cada aula, fale com a equipe da Nobre.
      </>
    ),
  },
  ...[
    { name: 'Musculação', q: 'A academia possui musculação?', subject: 'A musculação' },
    { name: 'Funcional', q: 'A academia possui treinamento funcional?', subject: 'O treinamento funcional' },
    { name: 'Jump', q: 'A academia oferece Jump?', subject: 'O Jump' },
    { name: 'GAP', q: 'A academia oferece GAP?', subject: 'O GAP (glúteos, abdômen e pernas)' },
    { name: 'Zumba', q: 'A academia oferece Zumba?', subject: 'A Zumba' },
  ]
    .filter((x) => has(x.name))
    .map((x) => ({
      q: x.q,
      a: `Sim. ${x.subject} está entre as atividades da Nobre Academia. Consulte a equipe para saber dias e horários.`,
    })),
  {
    q: 'Quais são os horários?',
    a: hoursConfirmed ? (
      <>
        Veja a tabela completa na seção{' '}
        <a href="#horarios" className="link">
          Horários de funcionamento
        </a>
        . Em feriados e datas especiais, os horários podem mudar.
      </>
    ) : (
      <>
        Os horários de funcionamento e das aulas são informados pela equipe da academia. Fale com a Nobre para
        confirmar o horário atualizado.
      </>
    ),
  },
  {
    q: 'Como faço para saber os valores dos planos?',
    a: `Os valores e as opções de plano são informados diretamente pela equipe. ${
      hasWhatsApp ? 'Chame a Nobre no WhatsApp' : `Ligue para ${academia.phone.display}`
    } e descubra a opção que combina melhor com você.`,
  },
  {
    q: 'Aceita Wellhub (Gympass) ou TotalPass?',
    a: 'A Nobre Academia aparece nas plataformas Wellhub e TotalPass. Como a cobertura depende do seu plano no aplicativo, confirme no app ou com a equipe da academia.',
  },
  {
    q: 'Preciso agendar uma visita?',
    a: 'Entre em contato com a equipe da Nobre Academia para verificar como funciona a visita e a matrícula.',
  },
  {
    q: 'Como falar com a academia?',
    a: (
      <>
        {hasWhatsApp ? 'Pelo WhatsApp, pelo botão abaixo, ou pelo telefone ' : 'Pelo telefone '}
        <a href={telUrl} className="link">
          {academia.phone.display}
        </a>
        . Se preferir, passe na academia: {a.street}, {a.neighborhood}.
      </>
    ),
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" aria-labelledby="faq-title" className="section">
      <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeader
            id="faq-title"
            eyebrow="FAQ"
            title={
              <>
                Ainda ficou com <span className="text-accent">alguma dúvida?</span>
              </>
            }
            lead="Reunimos as perguntas mais comuns de quem está pensando em treinar na Nobre."
          />
          <div className="reveal mt-9 hidden lg:block">
            <ContactLink message={messages.faq} cta="faq-lateral" arrow className="btn btn-ghost">
              Tirar minha dúvida
            </ContactLink>
          </div>
        </div>

        <div>
          <ul className="border-t border-white/[0.08]">
            {faqs.map((item, i) => {
              const isOpen = open === i;
              const panelId = `${baseId}-p${i}`;
              const buttonId = `${baseId}-b${i}`;
              return (
                <li key={item.q} className="reveal border-b border-white/[0.08]">
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="group flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-semibold transition-colors hover:text-ember-300 sm:text-xl"
                    >
                      {item.q}
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-full border transition duration-500 ${
                          isOpen ? 'rotate-45 border-ember-500 bg-ember-500 text-white' : 'border-white/15 text-mist-300'
                        }`}
                      >
                        <Plus className="size-4" aria-hidden />
                      </span>
                    </button>
                  </h3>
                  <div id={panelId} role="region" aria-labelledby={buttonId} className="faq-panel" data-open={isOpen} inert={!isOpen}>
                    <div>
                      <p className="max-w-2xl pr-12 pb-7 leading-relaxed text-mist-400">{item.a}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="reveal mt-10 flex flex-col gap-3 sm:flex-row">
            <ContactLink message={messages.faq} cta="faq" arrow className="btn btn-primary w-full sm:w-auto">
              Tirar minha dúvida
            </ContactLink>
            {hasWhatsApp && (
              <a href={telUrl} className="btn btn-ghost w-full sm:w-auto" data-cta="faq-telefone">
                {academia.phone.display}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
