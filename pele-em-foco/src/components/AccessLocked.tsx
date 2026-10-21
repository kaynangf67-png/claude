import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, RefreshCw, TimerOff } from 'lucide-react';
import { useBackend, useSession } from '../app/session';
import { formatDateTimeBR } from '../lib/dates';
import { Notice } from './ui';
import { DemoAccessControls } from './DemoAccessControls';

const CLAIM_HINT: Record<string, string> = {
  no_purchase: 'Ainda não encontramos uma compra aprovada para este e-mail.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos ao criar a conta. Depois disso, a ativação é automática.',
};

/** Explica por que o acesso não está ativo e o que fazer. */
export function AccessLocked({ compact = false }: { compact?: boolean }) {
  const { access, lastClaim, refreshAccess, user } = useSession();
  const { mode } = useBackend();
  const [checking, setChecking] = useState(false);
  const status = access?.status ?? 'none';

  const recheck = async () => {
    setChecking(true);
    await refreshAccess().finally(() => setChecking(false));
  };

  const ended = status === 'expired' || status === 'revoked';

  return (
    <section className={compact ? 'card-beige stack' : 'card stack-lg locked'} aria-labelledby="acesso-titulo">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {ended ? <TimerOff aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
        <div className="stack">
          {status === 'expired' && (
            <>
              <h2 id="acesso-titulo" className="h3">Seu acesso terminou</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                O acesso ao app terminou em <strong>{access?.expiresAt ? formatDateTimeBR(access.expiresAt) : '—'}</strong>.
                Seus registros continuam guardados: você pode ver o histórico do diário, exportar ou apagar seus dados em <Link to="/app/perfil">Perfil</Link>.
              </p>
            </>
          )}
          {status === 'revoked' && (
            <>
              <h2 id="acesso-titulo" className="h3">Seu acesso foi encerrado</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                O acesso ligado a esta compra foi encerrado, normalmente por reembolso ou contestação do pagamento. Seus dados continuam disponíveis para exportar ou apagar em <Link to="/app/perfil">Perfil</Link>. Se acha que é um engano, fale com o suporte.
              </p>
            </>
          )}
          {status === 'none' && (
            <>
              <h2 id="acesso-titulo" className="h3">Seu acesso ainda não está ativo</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                O app é liberado para quem comprou o Pele em Foco. A ativação acontece automaticamente quando a compra
                aprovada na Cakto é vinculada a esta conta — use <strong>o mesmo e-mail da compra</strong> ({user?.email}).
              </p>
              {mode === 'supabase' && lastClaim && CLAIM_HINT[lastClaim] && <Notice>{CLAIM_HINT[lastClaim]}</Notice>}
            </>
          )}
        </div>
      </div>
      {status === 'none' && mode === 'supabase' && (
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={recheck} disabled={checking} aria-busy={checking}>
          <RefreshCw size={16} className={checking ? 'spin' : undefined} aria-hidden="true" /> {checking ? 'Verificando…' : 'Verificar novamente'}
        </button>
      )}
      {mode === 'demo' && <DemoAccessControls />}
    </section>
  );
}
