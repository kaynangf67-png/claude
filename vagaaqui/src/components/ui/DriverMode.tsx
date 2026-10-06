import { Car, LocateFixed, SquareParking, Volume2, VolumeX, X } from 'lucide-react';
import { STATUS_COLORS } from '../../config/constants';
import { useAssessment, useNavProgress } from '../../hooks/useSimulation';
import { formatDistance, formatEta } from '../../lib/format';
import { actions, useApp } from '../../store/appStore';
import { ManeuverIcon } from './ManeuverIcon';
import { ArrivalBanner } from './NavigationControls';

/**
 * Modo Motorista: alto contraste, texto grande, no máximo duas ações por tela,
 * voz ligada por padrão e nenhuma pergunta durante a rota (só na chegada).
 */
export function DriverMode() {
  const navStatus = useApp((s) => s.navStatus);
  const targetSpotId = useApp((s) => s.targetSpotId);
  const recs = useApp((s) => s.recommendations);
  const recOpen = useApp((s) => s.recommendationsOpen);
  const voice = useApp((s) => s.voice);
  const progress = useNavProgress(navStatus === 'navigating');
  const target = useAssessment(targetSpotId);
  const best = recOpen ? recs[0] : undefined;
  const bestA = useAssessment(best?.spotId ?? null);

  return (
    <div className="driver">
      <div className="driver-top">
        <span className="driver-badge">
          <Car size={18} /> MODO MOTORISTA
        </span>
        <div className="driver-top-actions">
          <button className="driver-icon" onClick={actions.toggleVoice} aria-label={voice ? 'Desligar voz' : 'Ligar voz'}>
            {voice ? <Volume2 size={26} /> : <VolumeX size={26} />}
          </button>
          <button className="driver-icon" onClick={actions.toggleDriverMode} aria-label="Sair do Modo Motorista">
            <X size={26} />
          </button>
        </div>
      </div>

      {navStatus === 'navigating' && progress?.arriving && (
        <div className="driver-arrival">
          <ArrivalBanner
            large
            remaining={progress.remaining}
            side={progress.side}
            percent={target ? Math.round(target.probability * 100) : null}
            color={target ? STATUS_COLORS[target.status] : undefined}
          />
        </div>
      )}

      {navStatus === 'navigating' && progress && !progress.arriving && (
        <div className="driver-maneuver">
          <ManeuverIcon type={progress.next?.type} size={64} />
          <div>
            <strong>{formatDistance(progress.distanceToNext)}</strong>
            <span>{progress.next?.text}</span>
          </div>
        </div>
      )}

      <div className="driver-bottom">
        {navStatus === 'navigating' && progress && (
          <>
            <div className="driver-stats">
              <div>
                <strong>{formatDistance(progress.remaining)}</strong>
                <span>restantes</span>
              </div>
              <div>
                <strong>{formatEta(progress.etaSeconds)}</strong>
                <span>tempo</span>
              </div>
              {target && (
                <div style={{ color: STATUS_COLORS[target.status] }}>
                  <strong>{Math.round(target.probability * 100)}%</strong>
                  <span>chance</span>
                </div>
              )}
            </div>
            <button className="driver-btn danger" onClick={actions.cancelNavigation}>
              ENCERRAR ROTA
            </button>
          </>
        )}

        {navStatus !== 'navigating' && best && bestA && (
          <>
            <div className="driver-offer" style={{ color: STATUS_COLORS[bestA.status] }}>
              <strong>{Math.round(bestA.probability * 100)}%</strong>
              <span>
                {formatDistance(best.driveDistance)} • {formatEta(best.etaSeconds)}
              </span>
            </div>
            <button className="driver-btn go" onClick={() => actions.navigateTo(best.spotId)}>
              IR ATÉ A VAGA
            </button>
          </>
        )}

        {navStatus === 'parked' && !best && (
          <button className="driver-btn" onClick={actions.leaveSpot}>
            <LocateFixed size={28} /> SAÍ DA VAGA
          </button>
        )}

        {navStatus !== 'navigating' && !best && navStatus !== 'arrived' && (
          <button className="driver-btn go" onClick={() => actions.findParking()}>
            <SquareParking size={30} /> ENCONTRAR VAGA
          </button>
        )}
      </div>
    </div>
  );
}
