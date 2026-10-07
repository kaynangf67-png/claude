import { Award, Car, CircleCheck, Gem, History, Target, X } from 'lucide-react';
import { LEVELS, REWARD_POINTS } from '../../config/constants';
import { accuracy, levelFor } from '../../domain/rewards';
import { useNow } from '../../hooks/useSimulation';
import { formatAgo, formatPoints } from '../../lib/format';
import { actions, useApp } from '../../store/appStore';

export function UserProfile() {
  const profile = useApp((s) => s.profile);
  const sessionPoints = useApp((s) => s.sessionPoints);
  const now = useNow(5000);
  const { current, next, progress, toNext } = levelFor(profile.points);
  const acc = Math.round(accuracy(profile) * 100);

  return (
    <aside className="panel" role="dialog" aria-label="Seu perfil">
      <header className="panel-head">
        <h2>Seu perfil</h2>
        <button className="icon-btn ghost" onClick={() => actions.setPanel(null)} aria-label="Fechar">
          <X size={20} />
        </button>
      </header>

      <section className="profile-hero" style={{ ['--level' as string]: current.color }}>
        <div className="level-badge">
          <Gem size={30} />
        </div>
        <div>
          <p className="muted small">Nível</p>
          <h3>{current.name}</h3>
          <p className="profile-points">{formatPoints(profile.points)} pontos</p>
        </div>
      </section>

      <div className="level-progress">
        <div className="bar">
          <span style={{ width: `${progress * 100}%`, background: current.color }} />
        </div>
        <p className="muted small">{next ? `${formatPoints(toNext)} pontos para ${next.name}` : 'Nível máximo alcançado'}</p>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <CircleCheck size={18} />
          <strong>{formatPoints(profile.confirmations)}</strong>
          <span>confirmações</span>
        </div>
        <div className="stat">
          <Target size={18} />
          <strong>{acc}%</strong>
          <span>de precisão</span>
        </div>
        <div className="stat">
          <Car size={18} />
          <strong>{profile.parkedCount}</strong>
          <span>estacionamentos</span>
        </div>
      </div>
      {sessionPoints > 0 && <p className="session-points">+{sessionPoints} pontos nesta sessão</p>}

      <h4 className="section-title">
        <Award size={16} /> Como ganhar pontos
      </h4>
      <ul className="earn-list">
        <li>
          <span>Confirmou uma vaga livre</span>
          <strong>+{REWARD_POINTS.confirm_available}</strong>
        </li>
        <li>
          <span>Confirmou que uma vaga estava ocupada</span>
          <strong>+{REWARD_POINTS.confirm_occupied}</strong>
        </li>
        <li>
          <span>Confirmou que estacionou</span>
          <strong>+{REWARD_POINTS.parked}</strong>
        </li>
      </ul>
      <p className="muted small">
        Sua precisão define o peso das suas confirmações no Índice de Confiança. Confirmações conferidas por outras fontes aumentam a
        precisão.
      </p>

      <h4 className="section-title">Níveis</h4>
      <ol className="levels">
        {LEVELS.map((l) => (
          <li key={l.name} className={l.name === current.name ? 'current' : profile.points >= l.min ? 'done' : ''}>
            <span className="level-dot" style={{ background: l.color }} />
            <span>{l.name}</span>
            <span className="muted">{formatPoints(l.min)}+</span>
          </li>
        ))}
      </ol>

      <h4 className="section-title">
        <History size={16} /> Atividade recente
      </h4>
      {profile.history.length === 0 ? (
        <p className="muted small">Confirme vagas durante a navegação para ganhar pontos.</p>
      ) : (
        <ul className="history">
          {profile.history.slice(0, 8).map((h) => (
            <li key={h.id}>
              <span>{h.label}</span>
              <span className="muted small">{formatAgo(h.timestamp, now)}</span>
              <strong>+{h.points}</strong>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost btn-block" onClick={actions.resetProfile}>
        Restaurar perfil de demonstração
      </button>
    </aside>
  );
}
