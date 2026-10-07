import { ChevronDown, ChevronUp, Clock, Navigation, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { STATUS_COLORS, STATUS_LABELS } from '../../config/constants';
import { RELIABILITY_LABEL } from '../../domain/confidence';
import { ZONE_LABELS } from '../../domain/historical';
import { useAssessment, useNow } from '../../hooks/useSimulation';
import { formatAgo, formatDistance, formatEta, formatMoney } from '../../lib/format';
import { getSimulation } from '../../simulation/WorldSimulation';
import type { Recommendation } from '../../types';

interface Props {
  spotId: string;
  heading?: string;
  recommendation?: Recommendation;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

const KIND_LABEL = { available: 'livre', left: 'liberada', occupied: 'ocupada', parked: 'ocupada' } as const;

/** Card do Índice de Confiança da Vaga: probabilidade, frescor, confirmações e fatores. */
export function ConfidenceCard({ spotId, heading = 'VAGA', recommendation, actionLabel, onAction, onClose }: Props) {
  const a = useAssessment(spotId);
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const sim = getSimulation();
  const spot = sim.spotsById.get(spotId);
  if (!a || !spot) return null;
  const lot = spot.lotId ? sim.lots.find((l) => l.id === spot.lotId) : undefined;
  const pct = Math.round(a.probability * 100);
  const color = STATUS_COLORS[a.status];
  const confirmed =
    a.lastConfirmedKind && a.lastConfirmedAt
      ? `Confirmada ${KIND_LABEL[a.lastConfirmedKind]} ${formatAgo(a.lastConfirmedAt, now)}`
      : lot?.reportedAt
        ? `Dados do estacionamento ${formatAgo(lot.reportedAt, now)}`
        : 'Sem confirmações recentes — baseado no histórico';

  return (
    <article className="confidence-card" style={{ ['--status' as string]: color }}>
      <header className="cc-head">
        <span className="cc-kicker">{heading}</span>
        {onClose && (
          <button className="icon-btn ghost" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        )}
      </header>
      <div className="cc-main">
        <div className="cc-ring" aria-label={`${pct}% de chance`}>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="cc-ring-bg" />
            <circle cx="50" cy="50" r="42" className="cc-ring-fg" strokeDasharray={`${(pct / 100) * 264} 264`} />
          </svg>
          <strong>{pct}%</strong>
        </div>
        <div className="cc-info">
          <h3>{lot ? lot.name : spot.streetName}</h3>
          <p className="cc-status">
            <span className="dot" /> {STATUS_LABELS[a.status]}
          </p>
          <p className="cc-chance">{pct}% de chance de encontrar vaga</p>
          {recommendation && (
            <p className="cc-metrics">
              {formatDistance(recommendation.driveDistance)} • {formatEta(recommendation.etaSeconds)}
              {recommendation.walkDistance > 0 && ` • ${formatDistance(recommendation.walkDistance)} a pé`}
            </p>
          )}
        </div>
      </div>
      <ul className="cc-facts">
        <li>
          <Clock size={15} /> {confirmed}
        </li>
        <li>
          <Users size={15} /> {a.recentConfirmations} {a.recentConfirmations === 1 ? 'confirmação' : 'confirmações'} · {a.nearbyUsers}{' '}
          {a.nearbyUsers === 1 ? 'usuário próximo' : 'usuários próximos'}
        </li>
        <li>
          <ShieldCheck size={15} /> {RELIABILITY_LABEL[a.reliabilityLevel]} · índice {Math.round(a.reliability * 100)}/100
        </li>
        {lot && (
          <li>
            <Navigation size={15} /> {lot.reportedFree != null ? `${lot.reportedFree}/${lot.capacity} vagas livres informadas` : 'Sem integração ao vivo'} ·{' '}
            {formatMoney(lot.pricePerHour)}/h
          </li>
        )}
      </ul>
      {recommendation && recommendation.reasons.length > 0 && (
        <ul className="cc-reasons">
          {recommendation.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <button className="cc-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Como calculamos {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="cc-factors">
          <p className="muted small">
            Índice de Confiança da Vaga — {ZONE_LABELS[spot.zone]} · base histórica {Math.round(a.prior * 100)}% de vaga livre
          </p>
          {a.factors.map((f) => (
            <div key={f.key} className="cc-factor">
              <span>{f.label}</span>
              <span className="muted">{f.detail}</span>
              <span className={`impact ${f.impact > 0.05 ? 'up' : f.impact < -0.05 ? 'down' : ''}`}>
                {f.impact > 0.05 ? '▲' : f.impact < -0.05 ? '▼' : '•'}
              </span>
            </div>
          ))}
          <p className="muted small">Nunca mostramos 100%: vagas mudam de estado a qualquer momento.</p>
        </div>
      )}
      {onAction && actionLabel && (
        <button className="btn btn-primary btn-lg btn-block" onClick={onAction}>
          <Navigation size={20} /> {actionLabel}
        </button>
      )}
    </article>
  );
}
