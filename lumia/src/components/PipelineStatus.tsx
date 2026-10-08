import { Sparkles } from 'lucide-react';
import { STAGES, STAGE_LABEL, type PipelineStage } from '@/ai/interpretationPipeline';

export interface PipelineState {
  stage: PipelineStage | null;
  details: Partial<Record<PipelineStage, string>>;
  done: boolean;
  error: string | null;
  elapsedMs?: number;
}

export function PipelineStatus({ state }: { state: PipelineState }) {
  const idx = state.stage ? STAGES.indexOf(state.stage) : -1;
  return (
    <div className="pipeline" role="status" aria-live="polite">
      <h4>
        <Sparkles size={15} color="var(--amber)" /> IA de interpretação
        <span className="chip chip-mock" style={{ marginLeft: 'auto', height: 20, fontSize: 10.5 }}>
          pré-processado
        </span>
      </h4>
      {state.error ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--warn)' }}>{state.error}</p>
      ) : (
        <ol>
          {STAGES.map((s, i) => (
            <li key={s} className={i < idx || state.done ? 'done' : i === idx ? 'current' : ''}>
              <span className="b" />
              {STAGE_LABEL[s]}
              {state.details[s] && (i <= idx || state.done) && <small>{state.details[s]}</small>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
