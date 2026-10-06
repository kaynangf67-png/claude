import gsap from 'gsap';
import { Car, ChevronRight, LocateFixed, Navigation, SquareParking, Target } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { STATUS_COLORS, STATUS_LABELS } from '../../config/constants';
import { recommend } from '../../domain/recommendation';
import { useNow, useSimulationSnapshot } from '../../hooks/useSimulation';
import { formatAgo, formatDistance, formatEta } from '../../lib/format';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, useApp } from '../../store/appStore';
import { cameraBus } from '../../store/cameraBus';
import { ConfidenceCard } from './ConfidenceCard';

function useSlideIn(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
  }, [key]);
  return ref;
}

/** Resumo da tela inicial: a melhor vaga provável agora, com um único botão. */
function HomeCard() {
  const snapshot = useSimulationSnapshot();
  const best = useMemo(() => recommend(getSimulation().candidates())[0], [snapshot.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = best ? snapshot.assessments.get(best.spotId) : undefined;
  const ref = useSlideIn('home');
  return (
    <div ref={ref} className="sheet home-card">
      {best && a ? (
        <>
          <div className="home-row">
            <div className="home-pct" style={{ color: STATUS_COLORS[a.status] }}>
              <Target size={22} /> {Math.round(a.probability * 100)}%
            </div>
            <div className="home-info">
              <strong>Vaga provável</strong>
              <span className="muted">
                {formatDistance(best.driveDistance)} • {formatEta(best.etaSeconds)} · {getSimulation().spotsById.get(best.spotId)?.streetName}
              </span>
            </div>
            <button className="icon-btn" onClick={() => actions.findParking()} aria-label="Ver opções">
              <ChevronRight size={20} />
            </button>
          </div>
          <button className="btn btn-primary btn-xl btn-block" onClick={() => actions.navigateTo(best.spotId)}>
            <Navigation size={22} /> IR ATÉ A VAGA
          </button>
        </>
      ) : (
        <button className="btn btn-primary btn-xl btn-block" onClick={() => actions.findParking()}>
          <SquareParking size={22} /> ENCONTRAR ESTACIONAMENTO
        </button>
      )}
    </div>
  );
}

function RecommendationsSheet() {
  const recs = useApp((s) => s.recommendations);
  const destination = useApp((s) => s.destination);
  const snapshot = useSimulationSnapshot();
  const ref = useSlideIn(recs.map((r) => r.spotId).join());
  const best = recs[0];
  if (!best) return null;
  const sim = getSimulation();
  return (
    <div ref={ref} className="sheet">
      <ConfidenceCard
        spotId={best.spotId}
        heading={destination ? `MELHOR OPÇÃO PARA ${destination.label.toUpperCase()}` : 'MELHOR OPÇÃO'}
        recommendation={best}
        actionLabel="IR ATÉ A VAGA"
        onAction={() => actions.navigateTo(best.spotId)}
        onClose={actions.closeRecommendations}
      />
      {recs.length > 1 && (
        <div className="alternatives">
          <span className="muted small">Outras opções</span>
          <div className="alt-list">
            {recs.slice(1).map((r) => {
              const a = snapshot.assessments.get(r.spotId);
              const spot = sim.spotsById.get(r.spotId)!;
              return (
                <button
                  key={r.spotId}
                  className="alt"
                  style={{ ['--status' as string]: a ? STATUS_COLORS[a.status] : '#888' }}
                  onClick={() => {
                    actions.selectSpot(r.spotId);
                    cameraBus.emit({ type: 'focus', x: spot.position.x, z: spot.position.z, distance: 160 });
                  }}
                >
                  <strong>{a ? Math.round(a.probability * 100) : '–'}%</strong>
                  <span>{spot.type === 'lot' ? 'Estacionamento' : spot.streetName}</span>
                  <small>
                    {formatDistance(r.driveDistance)} • {formatEta(r.etaSeconds)}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SpotSheet({ spotId }: { spotId: string }) {
  const ref = useSlideIn(spotId);
  const navStatus = useApp((s) => s.navStatus);
  const target = useApp((s) => s.targetSpotId);
  const isTarget = target === spotId && navStatus !== 'idle';
  return (
    <div ref={ref} className="sheet">
      <ConfidenceCard
        spotId={spotId}
        heading={isTarget ? 'SEU DESTINO' : 'VAGA'}
        actionLabel={isTarget ? undefined : 'NAVEGAR ATÉ AQUI'}
        onAction={isTarget ? undefined : () => actions.navigateTo(spotId)}
        onClose={() => actions.selectSpot(null)}
      />
    </div>
  );
}

function ParkedCard() {
  const target = useApp((s) => s.targetSpotId);
  const parkedAt = useApp((s) => s.parkedAt);
  const sessionPoints = useApp((s) => s.sessionPoints);
  const now = useNow(5000);
  const ref = useSlideIn('parked');
  const spot = target ? getSimulation().spotsById.get(target) : undefined;
  return (
    <div ref={ref} className="sheet parked-card">
      <div className="parked-head">
        <div className="parked-icon">
          <Car size={26} />
        </div>
        <div>
          <span className="cc-kicker">ESTACIONADO</span>
          <h3>{spot?.streetName}</h3>
          <p className="muted small">Registrado {formatAgo(parkedAt, now)} · a vaga aparece como ocupada para os outros motoristas</p>
        </div>
      </div>
      {sessionPoints > 0 && (
        <p className="session-points">
          Você ganhou <strong>+{sessionPoints} pontos</strong> nesta sessão.
        </p>
      )}
      <div className="row-actions">
        <button className="btn btn-secondary btn-lg" onClick={actions.leaveSpot}>
          <LocateFixed size={18} /> SAÍ DA VAGA
        </button>
        <button className="btn btn-ghost btn-lg" onClick={() => actions.setPanel('profile')}>
          Ver perfil
        </button>
      </div>
    </div>
  );
}

/** Painel inferior: decide o que mostrar conforme o momento da jornada. */
export function BottomPanel() {
  const navStatus = useApp((s) => s.navStatus);
  const selected = useApp((s) => s.selectedSpotId);
  const recOpen = useApp((s) => s.recommendationsOpen);
  const prompt = useApp((s) => s.prompt);
  if (prompt) return null;
  if (selected) return <SpotSheet spotId={selected} />;
  if (navStatus === 'navigating' || navStatus === 'arrived') return null;
  if (recOpen) return <RecommendationsSheet />;
  if (navStatus === 'parked') return <ParkedCard />;
  return <HomeCard />;
}

export function Legend() {
  return (
    <div className="legend" aria-label="Legenda">
      {(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((k) => (
        <span key={k} title={STATUS_LABELS[k]}>
          <i style={{ background: STATUS_COLORS[k] }} />
          {k === 'likely_available' ? 'Alta' : k === 'uncertain' ? 'Média' : k === 'likely_occupied' ? 'Ocupada' : 'Antiga'}
        </span>
      ))}
    </div>
  );
}
