import { LocateFixed, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { STATUS_COLORS } from '../../config/constants';
import { useAssessment, useNavProgress } from '../../hooks/useSimulation';
import { formatDistance, formatEta } from '../../lib/format';
import { actions, useApp } from '../../store/appStore';
import { ManeuverIcon } from './ManeuverIcon';

/** HUD de navegação: próxima manobra, distância restante, tempo e chance da vaga. */
export function NavigationControls() {
  const navStatus = useApp((s) => s.navStatus);
  const targetSpotId = useApp((s) => s.targetSpotId);
  const cameraMode = useApp((s) => s.cameraMode);
  const simSpeed = useApp((s) => s.simSpeed);
  const progress = useNavProgress(navStatus === 'navigating');
  const a = useAssessment(targetSpotId);
  const spoken = useRef<string>('');

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
      <div className="maneuver" role="status">
        <div className="maneuver-icon">
          <ManeuverIcon type={progress.next?.type} size={34} />
        </div>
        <div>
          <strong className="maneuver-dist">{formatDistance(progress.distanceToNext)}</strong>
          <span className="maneuver-text">{progress.next?.text ?? 'Siga em frente'}</span>
        </div>
      </div>

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
            Simulação {simSpeed}× · {Math.round(progress.speedKmh)} km/h
          </span>
        </div>
      </div>
    </>
  );
}
