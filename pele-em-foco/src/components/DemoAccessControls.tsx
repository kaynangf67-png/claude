import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useBackend, useSession } from '../app/session';

/** Botões que só existem no modo demonstração. Nunca aparecem com Supabase configurado. */
export function DemoAccessControls() {
  // Constante de build: com Supabase configurado, o Vite elimina este componente do bundle.
  if (import.meta.env.VITE_SUPABASE_URL) return null;
  return <DemoAccessControlsInner />;
}

function DemoAccessControlsInner() {
  const { demo } = useBackend();
  const { refreshAccess } = useSession();
  const [busy, setBusy] = useState(false);
  if (!demo) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refreshAccess({ claim: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-controls stack">
      <p className="small" style={{ marginBottom: 0 }}>
        <FlaskConical size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> <strong>Somente demonstração.</strong> Em produção, o acesso só é concedido pelo servidor depois de uma compra verificada.
      </p>
      <div className="row wrap">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => demo.grantDemoAccess())}>Simular compra (30 dias)</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => demo.expireDemoAccess())}>Simular bônus expirado</button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => demo.removeDemoAccess())}>Remover acesso</button>
      </div>
    </div>
  );
}
