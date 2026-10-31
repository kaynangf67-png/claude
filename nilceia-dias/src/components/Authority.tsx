import { ArrowUpRight } from 'lucide-react';
import { brand, facts } from '../config/site';

export function Authority() {
  const items = [
    facts.years.show && { value: facts.years.value, label: 'anos dedicados à beleza' },
    facts.brides.show && { value: facts.brides.value, label: 'noivas atendidas' },
    { value: brand.casamentos.rating, label: 'avaliação no Casamentos.com.br', href: brand.casamentos.url },
    { value: 'Serra', label: 'Parque Residencial Laranjeiras · ES', href: '#localizacao' },
  ].filter(Boolean) as { value: string; label: string; href?: string }[];

  return (
    <section aria-label="Credenciais" className="on-dark bg-onyx text-champagne">
      <div className="wrap">
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => {
            const body = (
              <>
                <span className="display block text-[2.1rem] leading-none text-paper sm:text-[2.8rem]">{it.value}</span>
                <span className="mt-2 flex items-start gap-1 text-[0.66rem] leading-snug font-semibold tracking-[0.18em] text-muted-dark uppercase">
                  {it.label}
                  {it.href?.startsWith('http') && <ArrowUpRight aria-hidden="true" strokeWidth={1.5} className="size-3 shrink-0 text-gold" />}
                </span>
              </>
            );
            const cls = `block h-full py-8 sm:py-10 ${i % 2 ? 'pl-5 sm:pl-8' : 'pr-5'} ${
              i % 2 ? 'border-l border-gold/20' : ''
            } ${i >= 2 ? 'border-t border-gold/20 lg:border-t-0' : ''} ${i > 0 ? 'lg:border-l lg:border-gold/20 lg:pl-8' : ''}`;
            return (
              <li key={it.label}>
                {it.href ? (
                  <a
                    href={it.href}
                    className={`${cls} transition-colors hover:bg-onyx-800`}
                    {...(it.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {body}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
