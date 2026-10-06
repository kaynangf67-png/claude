import { whatsappMessages } from '../config/clinic';
import { photos, type PhotoAsset } from '../lib/photos';
import { Photo, SectionHeader, WhatsAppLink } from './ui';

const tiles: { photo: PhotoAsset; label: string; caption: string; position?: string }[] = [
  {
    photo: photos.consultorio,
    label: 'Consultório',
    caption: 'Iluminação indireta e acabamento em madeira para um atendimento mais tranquilo.',
    position: 'object-[50%_62%]',
  },
  {
    photo: photos.salaDeEspera,
    label: 'Sala de espera',
    caption: 'Ambiente amplo, claro e confortável enquanto você aguarda.',
    position: 'object-[50%_60%]',
  },
  {
    photo: photos.balcao,
    label: 'Recepção',
    caption: 'O primeiro contato: um espaço organizado para receber você bem.',
    position: 'object-[50%_55%]',
  },
  {
    photo: photos.entrada,
    label: 'Entrada',
    caption: 'Acesso discreto e acolhedor desde a chegada.',
    position: 'object-[50%_50%]',
  },
];

export function ClinicGallery() {
  return (
    <section
      id="estrutura"
      aria-labelledby="estrutura-title"
      className="on-dark relative overflow-hidden bg-navy-900 py-24 text-white sm:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(closest-side,rgb(45_111_145/0.35),transparent)]"
      />
      <div className="container-site relative grid gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <SectionHeader
              id="estrutura-title"
              tone="light"
              eyebrow="Estrutura"
              title="Um espaço preparado para cuidar de você."
              lead="Fotos reais da clínica. Cada ambiente foi planejado para unir conforto, organização e cuidado."
            />
            <ul className="reveal mt-8 space-y-3 text-[0.95rem] text-white/80">
              {tiles.map((t) => (
                <li key={t.label} className="flex items-center gap-3">
                  <span aria-hidden="true" className="h-px w-6 bg-wood-300" />
                  {t.label}
                </li>
              ))}
            </ul>
            <WhatsAppLink
              message={whatsappMessages.schedule}
              cta="estrutura"
              className="btn btn-light reveal mt-10"
            >
              Agendar um atendimento
            </WhatsAppLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:col-span-8">
          {tiles.map((t, i) => (
            <figure
              key={t.label}
              className={`reveal group ${i === 0 || i === 3 ? 'col-span-2 sm:col-span-1' : ''} ${i % 2 === 1 ? 'sm:mt-16' : ''}`}
              style={{ ['--reveal-delay' as string]: `${(i % 2) * 100}ms` }}
            >
              <div
                className={`relative overflow-hidden rounded-[1.5rem] bg-navy-800 ${
                  i === 0 ? 'aspect-[4/5] sm:aspect-[3/4]' : i === 3 ? 'aspect-[4/3] sm:aspect-[3/4]' : 'aspect-[3/4]'
                }`}
              >
                <Photo
                  photo={t.photo}
                  imgClassName={`${t.position ?? ''} transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]`}
                />
                <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-navy-950/70 to-transparent" />
                <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-[0.72rem] font-semibold tracking-[0.12em] text-navy-900 uppercase sm:bottom-5 sm:left-5">
                  {t.label}
                </span>
              </div>
              <figcaption className="mt-3 hidden text-[0.88rem] leading-relaxed text-white/70 sm:block">
                {t.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
