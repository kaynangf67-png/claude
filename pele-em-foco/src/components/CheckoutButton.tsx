import { ArrowRight } from 'lucide-react';
import { launch } from '../config/launch';

/**
 * Leva ao checkout da plataforma de pagamento.
 * Sem VITE_CHECKOUT_URL o botão fica desativado — nunca simulamos uma compra.
 */
export function CheckoutButton({ label = 'Quero o Pele em Foco', size = 'lg' }: { label?: string; size?: 'sm' | 'lg' }) {
  const cls = `btn btn-primary ${size === 'lg' ? 'btn-lg' : ''}`;
  if (!launch.checkoutUrl) {
    return (
      <button type="button" className={cls} aria-disabled="true" title="Checkout ainda não configurado (VITE_CHECKOUT_URL)" onClick={(e) => e.preventDefault()}>
        {size === 'lg' ? 'Checkout em configuração' : label}
      </button>
    );
  }
  return (
    <a className={cls} href={launch.checkoutUrl} rel="noopener">
      {label} {size === 'lg' && <ArrowRight size={18} aria-hidden="true" />}
    </a>
  );
}
