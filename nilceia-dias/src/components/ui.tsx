import type { ReactNode } from 'react';
import { brand, type Intent } from '../config/site';
import { track, trackWhatsApp, type CtaSource } from '../lib/analytics';
import { whatsappUrl } from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandIcons';

interface WaProps {
  intent: Intent;
  source: CtaSource;
  /** Categoria registrada no evento. Padrão: a própria intenção. */
  category?: string;
  ctaId?: string;
  className?: string;
  children: ReactNode;
  icon?: boolean;
  ariaLabel?: string;
}

/** Link de WhatsApp com mensagem contextual + evento de conversão. */
export function WhatsAppLink({ intent, source, category, ctaId, className = 'btn-primary', children, icon = true, ariaLabel }: WaProps) {
  return (
    <a
      href={whatsappUrl(intent, false)}
      target="_blank"
      rel="noopener"
      className={className}
      data-cta={ctaId ?? source}
      aria-label={ariaLabel}
      onPointerDown={(e) => (e.currentTarget.href = whatsappUrl(intent))}
      onFocus={(e) => (e.currentTarget.href = whatsappUrl(intent))}
      onClick={(e) => {
        e.currentTarget.href = whatsappUrl(intent);
        trackWhatsApp(source, category ?? intent, ctaId);
      }}
    >
      {icon && <WhatsAppIcon className="size-[1.05rem] shrink-0" />}
      <span>{children}</span>
    </a>
  );
}

export function DirectionsLink({ source, className, children }: { source: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={brand.maps.directions}
      target="_blank"
      rel="noopener"
      className={className}
      data-cta={`rota-${source}`}
      onClick={() => track('click_directions', { cta_source: source })}
    >
      {children}
    </a>
  );
}

/** Assinatura tipográfica provisória. Troque pelo logo oficial em SVG quando houver. */
export function Wordmark({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={`font-display ${compact ? 'text-[1.2rem]' : 'text-[1.4rem]'} tracking-[-0.01em] ${dark ? 'text-champagne' : 'text-onyx'}`}>
        Nilcéia Dias
      </span>
      <span className={`mt-1 text-[0.56rem] font-semibold tracking-[0.42em] uppercase ${dark ? 'text-gold' : 'text-gold-ink'}`}>
        Hair &amp; Company
      </span>
    </span>
  );
}

/** Título com trecho em itálico dourado. */
export function Accent({ text, accent }: { text: string; accent?: string }) {
  if (!accent || !text.includes(accent)) return <>{text}</>;
  const [before, after] = text.split(accent);
  return (
    <>
      {before}
      <em className="accent">{accent}</em>
      {after}
    </>
  );
}

/** Ornamento fino: linha + losango. */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex items-center gap-3 text-gold ${className}`}>
      <span className="h-px w-10 bg-current opacity-60" />
      <svg viewBox="0 0 10 10" className="size-2"><path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" /></svg>
      <span className="h-px w-10 bg-current opacity-60" />
    </span>
  );
}
