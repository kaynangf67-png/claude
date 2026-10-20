import type { ReactNode } from 'react';
import { professional } from '../config/site';
import type { PhotoAsset } from '../lib/photos';
import { whatsappUrl } from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandIcons';

interface WhatsAppLinkProps {
  message: string;
  /** Identifica o ponto de contato (útil para medir conversões no Google Tag Manager). */
  cta: string;
  className?: string;
  children?: ReactNode;
  showIcon?: boolean;
  ariaLabel?: string;
}

export function WhatsAppLink({
  message,
  cta,
  className = 'btn btn-primary',
  children = 'Agendar pelo WhatsApp',
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
      {showIcon && <WhatsAppIcon className="size-[1.1em] shrink-0" />}
      {children}
    </a>
  );
}

/** Link externo que abre em nova aba, com aviso para leitores de tela. */
export function ExternalLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={ariaLabel}>
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** Marca tipográfica provisória. Trocar pelo logotipo oficial (SVG) do cartão de visita quando disponível. */
export function Wordmark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  return (
    <span className="inline-flex items-center gap-3 leading-none">
      <ToothMark className={`h-8 w-7 shrink-0 ${dark ? 'text-wine-800' : 'text-white'}`} />
      <span className="flex flex-col gap-1">
        <span
          className={`font-display text-[1.35rem] tracking-[-0.01em] ${dark ? 'text-wine-950' : 'text-white'}`}
          style={{ fontVariationSettings: "'opsz' 36" }}
        >
          {professional.brandName}
        </span>
        <span
          className={`text-[0.6rem] font-semibold tracking-[0.24em] uppercase ${dark ? 'text-muted' : 'text-white/65'}`}
        >
          <span className="hidden sm:inline">{professional.profession} · </span>
          {professional.cro}
        </span>
      </span>
    </span>
  );
}

/** Contorno de dente em traço fino: o motivo gráfico do site. */
export function ToothMark({ className = 'size-6', strokeWidth = 1.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 28 32" fill="none" aria-hidden="true" className={className}>
      <path
        d="M14 4.6C11.4 2.6 8.6 2 6.4 2.6 3.3 3.5 1.8 6.5 2 10.3c.2 3.6 1.6 6.4 2.6 9.5.9 2.8 1.2 6 2 8.4.5 1.4 1.4 1.9 2.2 1.6.9-.3 1.2-1.6 1.5-3 .5-2.4 1-5.6 3.7-5.6s3.2 3.2 3.7 5.6c.3 1.4.6 2.7 1.5 3 .8.3 1.7-.2 2.2-1.6.8-2.4 1.1-5.6 2-8.4 1-3.1 2.4-5.9 2.6-9.5.2-3.8-1.3-6.8-4.4-7.7-2.2-.6-5 0-7.6 2Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface PhotoProps {
  photo: PhotoAsset;
  className?: string;
  /** true apenas para imagens do primeiro viewport */
  priority?: boolean;
  sizes?: string;
}

export function Photo({ photo, className = '', priority = false, sizes }: PhotoProps) {
  return (
    <span className={`relative block ${className}`}>
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        className="h-full w-full object-cover"
      />
      {photo.stockCredit && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[0.65rem] text-white/90">
          Imagem ilustrativa
        </span>
      )}
    </span>
  );
}

/**
 * Painel ilustrado da marca, usado enquanto não há foto real.
 * Decorativo: não finge ser uma fotografia.
 */
export function BrandPanel({ className = '', variant = 'deep' }: { className?: string; variant?: 'deep' | 'soft' }) {
  const deep = variant === 'deep';
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden ${deep ? 'bg-wine-950' : 'bg-wine-100'} ${className}`}
    >
      {/* arcos concêntricos */}
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${32 + i * 24} 500V${190 + i * 14}a${168 - i * 24} ${168 - i * 24} 0 0 1 ${336 - i * 48} 0V500`}
            fill="none"
            stroke={deep ? 'white' : '#702338'}
            strokeOpacity={deep ? 0.09 + i * 0.03 : 0.12 + i * 0.05}
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
        <ToothMark className={`h-24 w-20 ${deep ? 'text-white/85' : 'text-wine-800'}`} strokeWidth={0.8} />
        <span
          className={`font-display text-[2.6rem] italic ${deep ? 'text-white/90' : 'text-wine-950'}`}
          style={{ fontVariationSettings: "'opsz' 72" }}
        >
          Sâmia Lima
        </span>
        <span className={`h-px w-10 ${deep ? 'bg-white/30' : 'bg-wine-800/30'}`} />
        <span
          className={`text-[0.65rem] font-semibold tracking-[0.3em] uppercase ${deep ? 'text-white/60' : 'text-wine-800/70'}`}
        >
          Odontologia
        </span>
      </div>
    </div>
  );
}

export function PendingBadge({ children = 'Aguardando confirmação' }: { children?: ReactNode }) {
  return (
    <span className="pending-badge" title="Visível apenas no modo prévia. Não aparece no site publicado.">
      {children}
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
    <div className={`reveal max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="heading-lg mt-5 text-balance">
        {title}
      </h2>
      {lead && <p className="lead mt-5 text-pretty">{lead}</p>}
    </div>
  );
}
