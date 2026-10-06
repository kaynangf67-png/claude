import type { ReactNode } from 'react';
import { clinic } from '../config/clinic';
import type { PhotoAsset } from '../lib/photos';
import { whatsappUrl } from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandIcons';

interface WhatsAppLinkProps {
  message: string;
  /** Identifica o ponto de contato (útil para medir conversões depois). */
  cta: string;
  className?: string;
  children?: ReactNode;
  showIcon?: boolean;
  ariaLabel?: string;
}

export function WhatsAppLink({
  message,
  cta,
  className = 'btn btn-whatsapp',
  children = 'Falar pelo WhatsApp',
  showIcon = true,
  ariaLabel,
}: WhatsAppLinkProps) {
  return (
    <a
      href={whatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      data-cta={cta}
      className={className}
      aria-label={ariaLabel}
    >
      {showIcon && <WhatsAppIcon className="size-[1.15em] shrink-0" />}
      {children}
    </a>
  );
}

interface PhotoProps {
  photo: PhotoAsset;
  className?: string;
  imgClassName?: string;
  /** true apenas para imagens do primeiro viewport */
  priority?: boolean;
}

export function Photo({ photo, className, imgClassName = '', priority = false }: PhotoProps) {
  return (
    <picture className={className}>
      <source srcSet={photo.webp} type="image/webp" />
      <img
        src={photo.jpg}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </picture>
  );
}

/** Marca tipográfica provisória — substituir pelo arquivo oficial do logotipo quando disponível. */
export function Wordmark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const [first, ...rest] = clinic.name.split(' ');
  return (
    <span
      className={`inline-flex items-baseline gap-2 leading-none ${tone === 'dark' ? 'text-navy-900' : 'text-white'}`}
    >
      <span className="font-display text-[1.65rem] tracking-[0.02em]">{first}</span>
      <span
        className={`text-[0.68rem] font-semibold tracking-[0.32em] uppercase ${tone === 'dark' ? 'text-petrol-600' : 'text-wood-300'}`}
      >
        {rest.join(' ')}
      </span>
    </span>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'dark' | 'light';
  id?: string;
}

export function SectionHeader({ eyebrow, title, lead, align = 'left', tone = 'dark', id }: SectionHeaderProps) {
  const center = align === 'center';
  return (
    <div className={`reveal max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className={`eyebrow ${tone === 'light' ? 'text-wood-300' : ''}`}>{eyebrow}</p>
      <h2 id={id} className={`heading-lg mt-4 text-balance ${tone === 'light' ? 'text-white' : 'text-navy-900'}`}>
        {title}
      </h2>
      {lead && (
        <p className={`mt-5 text-pretty ${tone === 'light' ? 'text-lg leading-relaxed text-white/75' : 'lead'}`}>
          {lead}
        </p>
      )}
    </div>
  );
}
