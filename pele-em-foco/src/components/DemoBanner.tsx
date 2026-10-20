import { FlaskConical } from 'lucide-react';
import { useSession } from '../app/session';

/** Faixa permanente no modo demonstração: deixa claro que não há segurança real. */
export function DemoBanner() {
  const { backend } = useSession();
  if (!backend || backend === 'unconfigured' || backend.mode !== 'demo') return null;
  return (
    <div className="demo-bar" role="note">
      <FlaskConical size={16} aria-hidden="true" />
      <span>
        <strong>Modo demonstração.</strong> Contas e dados ficam só neste navegador, sem servidor e sem segurança real. Não use dados pessoais.
      </span>
    </div>
  );
}
