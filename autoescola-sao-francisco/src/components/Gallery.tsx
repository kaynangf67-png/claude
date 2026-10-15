import { approvedPhotos } from '../lib/photos';
import { EmptyPhoto, SectionHeader } from './ui';

/** Proporções alternadas para um ritmo de revista, não uma grade de carimbos. */
const ratios = ['aspect-[4/5]', 'aspect-[1/1]', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-[1/1]', 'aspect-[4/5]'];

export function Gallery() {
  const hasPhotos = approvedPhotos.length > 0;

  return (
    <section id="aprovados" aria-labelledby="aprovados-title" className="bg-white py-20 sm:py-28">
      <div className="container-site">
        <SectionHeader
          id="aprovados-title"
          eyebrow="Aprovados"
          title="Cada conquista tem uma história."
          lead={
            hasPhotos
              ? 'Por trás de cada CNH tem alguém que chegou nervoso na primeira aula e saiu dirigindo com confiança. Estes são alguns dos nossos alunos aprovados.'
              : 'Por trás de cada CNH tem alguém que chegou nervoso na primeira aula e saiu dirigindo com confiança.'
          }
        />

        {hasPhotos ? (
          <ul className="mt-14 columns-2 gap-3 sm:gap-4 lg:columns-3 lg:gap-5">
            {approvedPhotos.map((photo, i) => (
              <li
                key={photo.src}
                className="reveal mb-3 break-inside-avoid sm:mb-4 lg:mb-5"
                style={{ ['--reveal-delay' as string]: `${(i % 3) * 80}ms` }}
              >
                <figure>
                  <div className={`overflow-hidden rounded-[18px] bg-paper-2 ${ratios[i % ratios.length]}`}>
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                    />
                  </div>
                  {photo.caption && (
                    <figcaption className="mt-2.5 flex items-center gap-2 text-[0.88rem] font-medium text-graphite">
                      <span className="size-1.5 rounded-full bg-lime-500" aria-hidden="true" />
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5" aria-label="Espaço reservado para fotos de alunos aprovados">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={`reveal ${i % 2 === 1 ? 'lg:mt-10' : ''}`} style={{ ['--reveal-delay' as string]: `${i * 70}ms` }}>
                <div className="aspect-[4/5] overflow-hidden rounded-[18px]">
                  <EmptyPhoto label="foto de aluno aprovado" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
