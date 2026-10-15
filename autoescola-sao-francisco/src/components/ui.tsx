import type { ReactNode } from 'react';
import { ImagePlus } from 'lucide-react';
import { site } from '../config/site';
import type { PhotoAsset } from '../lib/photos';
import { isWhatsAppConfigured, whatsappUrl } from '../lib/whatsapp';
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

/**
 * Botão de WhatsApp. Enquanto o número não estiver configurado,
 * leva para a seção de contato em vez de abrir uma conversa sem destino.
 */
export function WhatsAppLink({
  message,
  cta,
  className = 'btn btn-primary',
  children = 'Falar pelo WhatsApp',
  showIcon = true,
  ariaLabel,
}: WhatsAppLinkProps) {
  const external = isWhatsAppConfigured;
  return (
    <a
      href={external ? whatsappUrl(message) : '#contato'}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      data-cta={cta}
      className={className}
      aria-label={ariaLabel}
    >
      {showIcon && <WhatsAppIcon className="size-[1.15em] shrink-0" />}
      {children}
    </a>
  );
}

/** Marcador visível de informação a confirmar. */
export function Pending({ children = 'a confirmar' }: { children?: ReactNode }) {
  return <span className="pending">[{children}]</span>;
}

/** Monograma: o "H" do câmbio, com a primeira marcha acesa. */
export function Mark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="currentColor" />
      <path
        d="M13 10v20M27 10v20M13 20h14"
        fill="none"
        stroke="var(--mark-stroke, #f5f3ec)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="13" cy="10" r="4.2" fill="#c4ef4f" />
    </svg>
  );
}

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  return (
    <span className="inline-flex items-center gap-3">
      <Mark className={`size-9 shrink-0 ${dark ? 'text-forest-900' : 'text-forest-800'}`} />
      <span className="flex flex-col leading-none">
        <span className={`text-[0.6rem] font-semibold tracking-[0.3em] uppercase ${dark ? 'text-forest-600' : 'text-lime-300'}`}>
          Auto Escola
        </span>
        <span className={`display mt-1 text-[1.12rem] tracking-[-0.01em] ${dark ? 'text-forest-950' : 'text-paper'}`}>
          {site.shortName}
        </span>
      </span>
    </span>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({ eyebrow, title, lead, id, align = 'left', className = '' }: SectionHeaderProps) {
  const center = align === 'center';
  return (
    <div className={`reveal ${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}>
      <p className={`eyebrow ${center ? 'justify-center' : ''}`}>{eyebrow}</p>
      <h2 id={id} className="heading-lg mt-5 text-balance">
        {title}
      </h2>
      {lead && <p className="lead mt-5 text-pretty">{lead}</p>}
    </div>
  );
}

interface PhotoProps {
  photo: PhotoAsset;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

export function Photo({ photo, className = '', priority = false, sizes }: PhotoProps) {
  return (
    <img
      src={photo.src}
      alt={photo.alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/** Moldura de foto ainda vazia: mostra o que deve entrar ali, sem fingir conteúdo. */
export function EmptyPhoto({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`hatch flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center ${className}`}>
      <ImagePlus className="size-6 text-forest-600/60" strokeWidth={1.5} aria-hidden="true" />
      <span className="text-[0.8rem] leading-snug text-forest-700/80">
        <Pending>{label}</Pending>
      </span>
    </div>
  );
}

/**
 * Padrão de câmbio em H (1-2-3-4-5-R) com a primeira marcha acesa.
 * Motivo gráfico do site: "a primeira marcha" é o começo da jornada.
 */
export function GearPattern({ className = '' }: { className?: string }) {
  const cols = [70, 200, 330];
  const top = 60;
  const mid = 200;
  const bottom = 340;
  const labels: [string, number, number, boolean][] = [
    ['1', cols[0], top, true],
    ['2', cols[0], bottom, false],
    ['3', cols[1], top, false],
    ['4', cols[1], bottom, false],
    ['5', cols[2], top, false],
    ['R', cols[2], bottom, false],
  ];
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="gear-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4ef4f" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c4ef4f" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* trilhos do câmbio */}
      <g fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" opacity="0.14">
        {cols.map((x) => (
          <line key={x} x1={x} y1={top} x2={x} y2={bottom} />
        ))}
        <line x1={cols[0]} y1={mid} x2={cols[2]} y2={mid} />
      </g>
      {/* percurso até a primeira marcha */}
      <path
        d={`M${cols[1]} ${mid} H${cols[0]} V${top}`}
        fill="none"
        stroke="#c4ef4f"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cols[0]} cy={top} r="58" fill="url(#gear-glow)" />
      <circle className="gear-dot" cx={cols[0]} cy={top} r="34" fill="none" stroke="#c4ef4f" strokeWidth="2" />
      {labels.map(([label, x, y, active]) => (
        <g key={label}>
          <circle
            cx={x}
            cy={y}
            r="26"
            fill={active ? '#c4ef4f' : 'none'}
            stroke={active ? 'none' : 'currentColor'}
            strokeOpacity="0.28"
            strokeWidth="2"
          />
          <text
            x={x}
            y={y}
            dy="0.36em"
            textAnchor="middle"
            fontFamily="Archivo, sans-serif"
            fontWeight="700"
            fontSize="24"
            fill={active ? '#08170f' : 'currentColor'}
            fillOpacity={active ? 1 : 0.55}
          >
            {label}
          </text>
        </g>
      ))}
      {/* manopla no ponto morto, de onde parte o percurso */}
      <circle cx={cols[1]} cy={mid} r="11" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
