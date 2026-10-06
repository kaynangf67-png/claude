import { answerArrival, forgetParked, leaveSpot, navigate } from '../app/controller';
import { isPro } from '../app/plan';
import { setState, useApp } from '../app/state';

/** Pergunta de chegada — 1 toque, botões grandes (motorista com pressa). */
export function ArrivalPrompt() {
  const open = useApp((s) => s.arrivalOpen);
  if (!open) return null;
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Achou vaga?">
      <div className="modal">
        <h2>Achou vaga?</h2>
        <p className="muted">Sua resposta mostra se a previsão acertou e ajuda quem vem depois.</p>
        <button className="btn big green" onClick={() => void answerArrival('street')}>
          SIM, NA RUA
        </button>
        <button className="btn big red" onClick={() => void answerArrival('full')}>
          NÃO, LOTADO
        </button>
        <button className="btn big" onClick={() => void answerArrival('lot')}>
          FUI PARA ESTACIONAMENTO
        </button>
        <button className="link-btn" onClick={() => setState({ arrivalOpen: false })}>
          Ainda não cheguei
        </button>
      </div>
    </div>
  );
}

/** Carro estacionado: liberar a vaga (o dado mais valioso) e achar o carro. */
export function ParkedBar() {
  const parked = useApp((s) => s.parked);
  const dest = useApp((s) => s.dest);
  const plan = useApp((s) => s.plan);
  if (!parked || dest) return null;
  const min = Math.max(1, Math.round((Date.now() - parked.at) / 60000));
  const pro = isPro(plan);
  return (
    <section className="parked-bar">
      <div className="parked-info">
        <span className="parked-ico">🚗</span>
        <span>
          Carro estacionado há {min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`}
        </span>
        <button className="icon-btn ghost small" aria-label="Esquecer carro estacionado" onClick={forgetParked}>
          ✕
        </button>
      </div>
      <button className="btn primary big" onClick={() => void leaveSpot()}>
        ESTOU SAINDO DA VAGA
      </button>
      <button className="link-btn" onClick={() => (pro ? navigate('walk', parked.pos) : setState({ screen: 'account' }))}>
        {pro ? '🧭' : '🔒'} Onde deixei o carro?
      </button>
    </section>
  );
}
