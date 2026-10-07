import { ArrowLeft, ArrowRight, ArrowUp, LocateFixed, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { STATUS_COLORS } from '../../config/constants';
import { useAssessment, useNavProgress } from '../../hooks/useSimulation';
import { formatDistance, formatEta } from '../../lib/format';
import { actions, useApp } from '../../store/appStore';
import { ManeuverIcon } from './ManeuverIcon';

/** Aviso de chegada (estilo painel de carro): de que lado está a vaga e a que distância. */
export function ArrivalBanner({
  remaining,
  side,
  percent,
  color,
  large = false,
}: {
  remaining: number;
  side: 'left' | 'right' | null;
  percent: number | null;
  color?: string;
  large?: boolean;
}) {
  const label = side === 'right' ? 'à direita' : side === 'left' ? 'à esquerda' : 'à frente';
  return (
    <div className={`arrival-banner ${large ? 'large' : ''}`} role="status" style={{ ['--status' as string]: color ?? '#2bea8a' }}>
      <div className={`arrival-arrow ${side ?? 'ahead'}`}>
        {side === 'left' ? <ArrowLeft size={large ? 64 : 38} /> : side === 'right' ? <ArrowRight size={large ? 64 : 38} /> : <ArrowUp size={large ? 64 : 38} />}
      </div>
      <div>
        <span className="arrival-kicker">CHEGANDO</span>
        <strong>Vaga provável {label}</strong>
        <span className="arrival-meta">
          {formatDistance(remaining)}
          {percent != null && ` · ${percent}% de chance`}
        </span>
      </div>
    </div>
  );
}

/** HUD de navegação: próxima manobra, distância restante, tempo e chance da vaga. */
export function NavigationControls() {
  const navStatus = useApp((s) => s.navStatus);
  const targetSpotId = useApp((s) => s.targetSpotId);
  const cameraMode = useApp((s) => s.cameraMode);
  const simSpeed = useApp((s) => s.simSpeed);
  const gpsOk = useApp((s) => s.gps.status === 'ok');
  const progress = useNavProgress(navStatus === 'navigating');
  const a = useAssessment(targetSpotId);
  const spoken = useRef<string>('');

  // aviso falado de chegada: lado da vaga, uma vez por rota
  const arrivalSpoken = useRef<string | null>(null);
  useEffect(() => {
    if (!progress?.arriving || !targetSpotId || arrivalSpoken.current === targetSpotId) return;
    arrivalSpoken.current = targetSpotId;
    const side = progress.side === 'right' ? 'à direita' : progress.side === 'left' ? 'à esquerda' : 'à frente';
    actions.say(`Vaga provável ${side} em ${Math.max(10, Math.round(progress.remaining / 10) * 10)} metros.`);
  }, [progress, targetSpotId]);

  // instruções por voz ~120 m antes da manobra
  useEffect(() => {
    if (!progress?.next) return;
    const key = `${progress.next.at}`;
    if (progress.next.type !== 'arrive' && progress.distanceToNext < 120 && spoken.current !== key) {
      spoken.current = key;
      actions.say(`Em ${Math.max(10, Math.round(progress.distanceToNext / 10) * 10)} metros, ${progress.next.text.toLowerCase()}`);
    }
  }, [progress]);

  if (navStatus !== 'navigating' || !progress) return null;
  const pct = a ? Math.round(a.probability * 100) : null;

  return (
    <>
      {progress.arriving ? (
        <ArrivalBanner remaining={progress.remaining} side={progress.side} percent={pct} color={a ? STATUS_COLORS[a.status] : undefined} />
      ) : (
        <div className="maneuver" role="status">
          <div className="maneuver-icon">
            <ManeuverIcon type={progress.next?.type} size={34} />
          </div>
          <div>
            <strong className="maneuver-dist">{formatDistance(progress.distanceToNext)}</strong>
            <span className="maneuver-text">{progress.next?.text ?? 'Siga em frente'}</span>
          </div>
        </div>
      )}

      <div className="nav-bar">
        <div className="nav-stats">
          <div>
            <strong>{formatDistance(progress.remaining)}</strong>
            <span>restantes</span>
          </div>
          <div>
            <strong>{formatEta(progress.etaSeconds)}</strong>
            <span>estimado</span>
          </div>
          {pct != null && a && (
            <div style={{ color: STATUS_COLORS[a.status] }}>
              <strong>{pct}%</strong>
              <span>de chance de encontrar vaga</span>
            </div>
          )}
        </div>
        <div className="nav-progress">
          <span style={{ width: `${progress.progress * 100}%` }} />
        </div>
        <div className="nav-actions">
          {cameraMode !== 'follow' && (
            <button className="btn btn-secondary" onClick={() => actions.setCameraMode('follow')}>
              <LocateFixed size={18} /> Recentralizar
            </button>
          )}
          <button className="btn btn-ghost" onClick={actions.cancelNavigation}>
            <X size={18} /> Encerrar
          </button>
          <span className="sim-tag" title="O carro é simulado nesta demonstração">
            {gpsOk ? 'GPS real' : `Simulação ${simSpeed}×`} · {Math.round(progress.speedKmh)} km/h
          </span>
        </div>
      </div>
    </>
  );
}
