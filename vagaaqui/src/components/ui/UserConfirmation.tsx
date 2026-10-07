import gsap from 'gsap';
import { Car, CircleCheck, CircleX, X } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { REWARD_POINTS } from '../../config/constants';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, useApp } from '../../store/appStore';

/**
 * Pergunta colaborativa. Ao passar por uma vaga: "Você viu uma vaga aqui?"
 * (some sozinha em 12 s e nunca aparece no Modo Motorista). Na chegada: livre/ocupada/estacionei.
 */
export function UserConfirmation() {
  const prompt = useApp((s) => s.prompt);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!prompt || !ref.current) return;
    gsap.fromTo(ref.current, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
    if (prompt.kind === 'passing') {
      const id = window.setTimeout(() => actions.answerPrompt('dismiss'), 12_000);
      return () => window.clearTimeout(id);
    }
  }, [prompt?.id, prompt?.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!prompt) return null;
  const spot = getSimulation().spotsById.get(prompt.spotId);
  const isArrival = prompt.kind === 'arrival';
  const title =
    prompt.stage === 'confirmed_free'
      ? 'Ótimo! Vai estacionar?'
      : isArrival
        ? prompt.blocked
          ? 'Parece ter um carro na vaga. Ela está livre?'
          : 'Você chegou. A vaga está livre?'
        : 'Você viu uma vaga aqui?';

  return (
    <div ref={ref} className={`confirm ${isArrival ? 'arrival' : 'passing'}`} role="dialog" aria-live="assertive">
      <div className="confirm-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            {spot?.streetName}
            {!isArrival && ' · responda só se for seguro, ou peça ao passageiro'}
          </p>
        </div>
        <button className="icon-btn ghost" onClick={() => actions.answerPrompt('dismiss')} aria-label="Agora não">
          <X size={20} />
        </button>
      </div>
      {prompt.stage === 'ask' && (
        <div className="confirm-actions">
          <button className="btn btn-free btn-xl" onClick={() => actions.answerPrompt('available')}>
            <CircleCheck size={26} /> SIM, ESTÁ LIVRE <span className="pts">+{REWARD_POINTS.confirm_available}</span>
          </button>
          <button className="btn btn-busy btn-xl" onClick={() => actions.answerPrompt('occupied')}>
            <CircleX size={26} /> NÃO, ESTÁ OCUPADA <span className="pts">+{REWARD_POINTS.confirm_occupied}</span>
          </button>
          {isArrival && (
            <button className="btn btn-park btn-xl" onClick={() => actions.answerPrompt('parked')}>
              <Car size={26} /> EU ESTACIONEI AQUI <span className="pts">+{REWARD_POINTS.parked}</span>
            </button>
          )}
        </div>
      )}
      {prompt.stage === 'confirmed_free' && (
        <div className="confirm-actions">
          <button className="btn btn-park btn-xl" onClick={() => actions.answerPrompt('parked')}>
            <Car size={26} /> EU ESTACIONEI AQUI <span className="pts">+{REWARD_POINTS.parked}</span>
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => actions.answerPrompt('dismiss')}>
            Não vou estacionar
          </button>
        </div>
      )}
      {!isArrival && <div className="confirm-timer" />}
    </div>
  );
}
