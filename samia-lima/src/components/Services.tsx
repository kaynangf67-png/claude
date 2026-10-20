import type { CSSProperties } from 'react';
import { Activity, Anchor, ArrowUpRight, Crown, HeartPulse, Layers, MessageCircleQuestion, Scissors, ShieldCheck, Smile, Sparkles, Stethoscope, type LucideIcon } from 'lucide-react';
import { services, whatsappMessages, type Service, type ServiceIcon } from '../config/site';
import { photos } from '../lib/photos';
import { isPreview } from '../lib/preview';
import { PendingBadge, Photo, SectionHeader, WhatsAppLink } from './ui';

const icons: Record<ServiceIcon, LucideIcon> = {
  stethoscope: Stethoscope,
  shield: ShieldCheck,
  layers: Layers,
  sparkles: Sparkles,
  heart: HeartPulse,
  activity: Activity,
  crown: Crown,
  scissors: Scissors,
  anchor: Anchor,
  align: Smile,
};

function ServiceCard({ service, index, wide }: { service: Service; index: number; wide: boolean }) {
  const Icon = icons[service.icon];
  const photo = service.photo ? photos[service.photo] : null;
  return (
    <li
      className={`reveal card group flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-lift ${service.published ? '' : 'pending-outline'}`}
      style={{ '--reveal-delay': `${(index % 3) * 70}ms` } as CSSProperties}
    >
      <div className={`relative overflow-hidden bg-wine-100 ${wide ? 'aspect-[16/7]' : 'aspect-[16/10]'}`}>
        {photo ? (
          <Photo photo={photo} className="h-full transition-transform duration-700 group-hover:scale-[1.03]" sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 90vw" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-end justify-center">
            <div className="arch flex h-[78%] w-[46%] items-center justify-center bg-white/70 transition-transform duration-500 group-hover:-translate-y-1">
              <Icon className="size-9 text-wine-800" strokeWidth={1.2} />
            </div>
          </div>
        )}
        <span className="absolute top-4 left-4 font-display text-[0.95rem] text-wine-800/70 italic">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        {!service.published && (
          <p className="mb-3">
            <PendingBadge />
          </p>
        )}
        <h3 className="heading-md">{service.name}</h3>
        <p className="mt-3 flex-1 text-[0.97rem] leading-relaxed text-muted">{service.summary}</p>
        <WhatsAppLink
          message={service.whatsappMessage ?? whatsappMessages.service(service.whatsappName)}
          cta={`tratamento:${service.id}`}
          className="link-arrow mt-6 self-start"
          showIcon={false}
        >
          Consultar atendimento
          <ArrowUpRight className="size-4" aria-hidden="true" />
          <span className="sr-only"> de {service.name} pelo WhatsApp (abre em nova aba)</span>
        </WhatsAppLink>
      </div>
    </li>
  );
}

export function Services() {
  const visible = services.filter((s) => s.published || isPreview);
  const few = visible.length < 3;

  return (
    <section id="tratamentos" aria-labelledby="tratamentos-titulo" className="bg-white py-20 sm:py-28">
      <div className="container-site">
        <SectionHeader
          id="tratamentos-titulo"
          eyebrow="Tratamentos"
          title="Cuidados odontológicos para você"
          lead="Conheça os tratamentos disponíveis e converse com a Dra. Sâmia para entender qual atendimento faz sentido para sua necessidade."
        />

        {isPreview && (
          <p className="mt-6 max-w-2xl text-[0.85rem] text-amber-800">
            Modo prévia: itens marcados como “aguardando confirmação” não aparecem no site publicado. Para publicar,
            mude <code>published</code> para <code>true</code> em <code>src/config/site.ts</code>.
          </p>
        )}

        <ul className={`mt-12 grid gap-5 sm:grid-cols-2 lg:gap-6 ${few ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          {visible.map((service, i) => (
            <ServiceCard key={service.id} service={service} index={i} wide={few} />
          ))}
          <li className="reveal flex flex-col justify-between gap-8 rounded-[var(--radius-card)] bg-wine-950 p-7 text-white sm:p-8">
            <div>
              <MessageCircleQuestion className="size-7 text-wine-200" strokeWidth={1.4} aria-hidden="true" />
              <h3 className="mt-6 font-display text-[1.6rem] leading-tight" style={{ fontVariationSettings: "'opsz' 40" }}>
                Procura outro tratamento?
              </h3>
              <p className="mt-3 leading-relaxed text-white/70">
                Envie uma mensagem contando o que você precisa. A resposta vem direto do consultório.
              </p>
            </div>
            <WhatsAppLink message={whatsappMessages.otherService} cta="tratamento:outro" className="btn btn-light self-start">
              Perguntar pelo WhatsApp
            </WhatsAppLink>
          </li>
        </ul>
      </div>
    </section>
  );
}
