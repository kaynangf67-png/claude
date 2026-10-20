import { Gift } from 'lucide-react';
import { launch } from '../config/launch';
import { bonusStatus } from '../lib/bonus';
import { formatLong } from '../lib/dates';
import { useStore } from '../lib/store';
import { ConfigPending } from './ui';

/** Período do bônus. Informativo: o app não bloqueia acesso (não há backend nesta versão). */
export function BonusNotice({ compact = false }: { compact?: boolean }) {
  const { today } = useStore();
  const status = bonusStatus(launch.bonusEndDate, today);

  if (status.kind === 'nao-configurado') {
    return compact ? null : <ConfigPending>data final do acesso gratuito ao app (VITE_BONUS_END_DATE).</ConfigPending>;
  }
  if (status.kind === 'ativo') {
    if (compact && status.daysLeft > 14) return null;
    return (
      <div className="notice">
        <Gift size={18} aria-hidden="true" />
        <p>
          Acesso gratuito para quem comprou o e-book até <strong>{formatLong(status.endDate)}</strong>
          {status.daysLeft <= 14 && ` (${status.daysLeft === 0 ? 'último dia' : `faltam ${status.daysLeft} dias`})`}.
          {!compact && ' Antes do fim do período, as condições de uso a partir dessa data serão comunicadas pelos canais oficiais. Seus registros continuam no seu aparelho e podem ser exportados em Perfil.'}
        </p>
      </div>
    );
  }
  return (
    <div className="notice alert">
      <Gift size={18} aria-hidden="true" />
      <p>
        O período de acesso gratuito terminou em <strong>{formatLong(status.endDate)}</strong>. Seus registros continuam salvos neste aparelho e podem ser exportados em Perfil.
      </p>
    </div>
  );
}
