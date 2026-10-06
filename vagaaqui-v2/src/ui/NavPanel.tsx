import { setVoice, stopNavigation } from '../app/controller';
import { useApp } from '../app/state';
import { formatDistance, type NavStep } from '../model/nav';
import { LEVEL_LABEL } from './colors';

const ARROW: Record<NavStep['icon'], string> = {
  left: '⬅',
  right: '➡',
  'slight-left': '↖',
  'slight-right': '↗',
  'sharp-left': '↙',
  'sharp-right': '↘',
  straight: '⬆',
  uturn: '↩',
  roundabout: '⟳',
  arrive: '🅿',
  depart: '⬆',
};

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Navegação dentro do app: manobra no topo, tempo/distância e chance de vaga embaixo. */
export function NavPanel() {
  const nav = useApp((s) => s.nav);
  const forecast = useApp((s) => s.forecast);
  const voice = useApp((s) => s.settings.voice);
  if (!nav) return null;
  const p = nav.progress;
  const step = p.next ?? nav.route.steps[nav.route.steps.length - 1];
  const target = forecast?.all.find((f) => f.segment.mid === nav.target);
  const level = target?.level ?? forecast?.level ?? 'unknown';
  return (
    <>
      <div className="nav-banner" role="status" aria-live="polite">
        <span className="nav-arrow" aria-hidden>
          {nav.rerouting ? '⟳' : ARROW[step?.icon ?? 'straight']}
        </span>
        <div className="nav-text">
          <b>{nav.rerouting ? 'Recalculando…' : formatDistance(p.toNextM)}</b>
          <span>{nav.rerouting ? 'Você saiu da rota' : step?.text}</span>
        </div>
      </div>
      <section className="nav-bottom">
        <div className="nav-stats">
          <div>
            <b>{Math.max(1, Math.round(p.remainingS / 60))} min</b>
            <span>{formatDistance(p.remainingM)}</span>
          </div>
          <div>
            <b>{fmtTime(Date.now() + p.remainingS * 1000)}</b>
            <span>chegada</span>
          </div>
          <div>
            <b className={`tx-${level}`}>{LEVEL_LABEL[level]}</b>
            <span>chance de vaga</span>
          </div>
        </div>
        <div className="nav-target">🅿 {nav.targetName}</div>
        <div className="nav-actions">
          <button className="btn red" onClick={stopNavigation}>
            Encerrar
          </button>
          <button className={`btn ${voice ? '' : 'muted-on'}`} aria-label={voice ? 'Silenciar voz' : 'Ligar voz'} aria-pressed={!voice} onClick={() => setVoice(!voice)}>
            {voice ? '🔊 Voz' : '🔇 Mudo'}
          </button>
          <button className="btn" onClick={() => window.dispatchEvent(new Event('vq:recenter'))}>
            ◎ Centralizar
          </button>
        </div>
      </section>
    </>
  );
}
