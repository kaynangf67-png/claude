import gsap from 'gsap';
import { Sparkles, Trophy } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { levelFor } from '../../domain/rewards';
import { formatPoints } from '../../lib/format';
import { actions, useApp, type Toast } from '../../store/appStore';

function RewardToast({ toast }: { toast: Toast }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(ref.current, { y: -30, scale: 0.8, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
    tl.fromTo(ref.current!.querySelector('.reward-points'), { scale: 1.6 }, { scale: 1, duration: 0.4, ease: 'power2.out' }, '<0.1');
  }, []);
  return (
    <div ref={ref} className={`reward-toast ${toast.levelUp ? 'level-up' : ''}`} onClick={() => actions.dismissToast(toast.id)}>
      {toast.levelUp ? <Trophy size={22} /> : <Sparkles size={22} />}
      <div>
        <span className="reward-points">+{toast.points} pontos</span>
        <span className="reward-label">{toast.levelUp ? `Novo nível: ${toast.levelUp}!` : toast.label}</span>
      </div>
    </div>
  );
}

/** Notificações de pontos (canto superior) — o reforço imediato que incentiva a colaborar. */
export function RewardSystem() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="reward-stack" aria-live="polite">
      {toasts.map((t) => (
        <RewardToast key={t.id} toast={t} />
      ))}
    </div>
  );
}

/** Chip compacto de pontos/nível na barra superior. */
export function PointsChip() {
  const points = useApp((s) => s.profile.points);
  const { current } = levelFor(points);
  return (
    <button className="points-chip" onClick={() => actions.setPanel('profile')} aria-label="Abrir perfil">
      <span className="level-dot" style={{ background: current.color }} />
      <strong>{formatPoints(points)}</strong>
      <span className="muted small">pts</span>
    </button>
  );
}
