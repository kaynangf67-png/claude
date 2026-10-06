import type { ReactNode } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { contactUrl, hasWhatsApp } from '../lib/contact';
import { type PhotoInfo, srcSet } from '../lib/photos';
import { WhatsAppIcon } from './BrandIcons';

interface ContactLinkProps {
  message: string;
  /** Identifica o ponto de contato (data-cta) para medir conversões no Google Tag Manager. */
  cta: string;
  className?: string;
  children: ReactNode;
  arrow?: boolean;
  ariaLabel?: string;
}

/** Botão de conversão: abre o WhatsApp com mensagem pronta (ou liga, se o WhatsApp não estiver configurado). */
export function ContactLink({ message, cta, className = 'btn btn-primary', children, arrow, ariaLabel }: ContactLinkProps) {
  return (
    <a
      href={contactUrl(message)}
      {...(hasWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      data-cta={cta}
      className={className}
      aria-label={ariaLabel}
    >
      {hasWhatsApp ? <WhatsAppIcon className="size-[1.2em] shrink-0" /> : <Phone className="size-[1.1em] shrink-0" />}
      <span>{children}</span>
      {arrow && <ArrowRight className="arrow size-[1.1em] shrink-0" aria-hidden />}
    </a>
  );
}

export function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="pending" title="Informação a ser confirmada pela academia">
      {children}
    </span>
  );
}

/** Textos entre colchetes no config ("[a confirmar]") viram marcador visual. */
export function MaybePending({ text }: { text: string }) {
  return /\[.*\]/.test(text) ? <Pending>{text.replace(/[[\]]/g, '')}</Pending> : <>{text}</>;
}

/** Logo tipográfico provisório — trocar pelo SVG oficial da academia quando disponível. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 leading-none ${className}`}>
      <span className="grid size-9 place-items-center rounded-lg bg-brand-500 text-[1.15rem] font-black text-ink-950 [font-stretch:125%]">
        T
      </span>
      <span className="flex flex-col">
        <span className="text-[0.95rem] font-black tracking-[0.01em] uppercase [font-stretch:112%] sm:text-[1.15rem] sm:[font-stretch:125%]">Transformers</span>
        <span className="mt-1 text-[0.58rem] font-semibold tracking-[0.42em] text-mist-400 uppercase">Fitness</span>
      </span>
    </span>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  id?: string;
}

export function SectionHeader({ eyebrow, title, lead, align = 'left', id }: SectionHeaderProps) {
  const center = align === 'center';
  return (
    <div className={`reveal max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="heading-lg mt-5 text-balance">
        {title}
      </h2>
      {lead && <p className={`lead mt-6 text-pretty ${center ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>{lead}</p>}
    </div>
  );
}

interface PhotoProps {
  photo: PhotoInfo;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}

/** Imagem responsiva AVIF/WebP gerada por `npm run fotos`. */
export function Photo({ photo, alt, sizes, className, imgClassName = '', priority = false }: PhotoProps) {
  const w = photo.widths[photo.widths.length - 1];
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcSet(photo, 'avif')} sizes={sizes} />
      <img
        src={`/fotos/${photo.name}-${w}.webp`}
        srcSet={srcSet(photo, 'webp')}
        sizes={sizes}
        alt={alt}
        width={w}
        height={Math.round(w * photo.ratio)}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </picture>
  );
}
