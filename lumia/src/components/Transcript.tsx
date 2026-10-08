/**
 * Transcrição sincronizada (WebVTT): a fala atual fica destacada e a lista
 * rola sozinha dentro do próprio painel. Clicar numa linha leva o vídeo até ela.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import type { SceneAnalysis, SoundEvent, TimedCue } from '@/ai/types';
import { formatTime } from '@/services/videoService';
import { Segmented } from './ui';

interface Line {
  id: string;
  start: number;
  end: number;
  kind: 'dialogue' | 'sound' | 'visual';
  who?: string;
  color?: string;
  text: string;
}

export function Transcript({ cues, sounds, analysis, t, onSeek }: { cues: TimedCue[]; sounds: SoundEvent[]; analysis: SceneAnalysis | null; t: number; onSeek: (t: number) => void }) {
  const [filter, setFilter] = useState<'all' | 'dialogue'>('all');
  const list = useRef<HTMLDivElement>(null);
  const colors = Object.fromEntries((analysis?.characters ?? []).map((c) => [c.voiceTag, c.color]));
  const lines = useMemo<Line[]>(() => {
    const out: Line[] = cues.map((c) => ({ id: c.id, start: c.start, end: c.end, kind: 'dialogue', who: c.voice, color: c.voice ? colors[c.voice] : undefined, text: c.text }));
    if (filter === 'all') {
      sounds.filter((s) => s.importance !== 'low').forEach((s) => out.push({ id: `s-${s.id}`, start: s.start, end: s.end, kind: 'sound', text: `🔊 ${s.label}` }));
      (analysis?.visualEvents ?? []).filter((v) => v.importance === 'high').forEach((v) => out.push({ id: `v-${v.id}`, start: v.t, end: v.end, kind: 'visual', text: `🎬 ${v.label}` }));
    }
    return out.sort((a, b) => a.start - b.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cues, sounds, analysis, filter]);
  const activeIdx = lines.reduce((acc, l, i) => (t >= l.start ? i : acc), -1);
  const activeId = activeIdx >= 0 ? lines[activeIdx].id : null;

  useEffect(() => {
    const el = list.current;
    if (!el || !activeId) return;
    const node = el.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeId)}"]`);
    if (node) el.scrollTo({ top: node.offsetTop - el.clientHeight / 2 + node.clientHeight / 2, behavior: 'smooth' });
  }, [activeId]);

  return (
    <section className="wpanel" aria-label="Transcrição sincronizada">
      <div className="wpanel-head">
        <h3>
          <ScrollText size={17} /> Transcrição sincronizada
        </h3>
        <Segmented
          label="Filtro da transcrição"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tudo' },
            { value: 'dialogue', label: 'Falas' },
          ]}
        />
      </div>
      <div className="transcript" ref={list}>
        {lines.map((l, i) => {
          const isActive = t >= l.start && t < l.end + 0.4 && i === activeIdx;
          return (
            <button key={l.id} data-id={l.id} className={`tline ${l.kind} ${isActive ? 'active' : t > l.end ? 'past' : ''}`} onClick={() => onSeek(l.start)} aria-current={isActive ? 'true' : undefined}>
              <time>{formatTime(l.start)}</time>
              <span>
                {l.who && (
                  <span className="who" style={{ color: l.color }}>
                    {l.who}
                    <br />
                  </span>
                )}
                <span className="txt">{l.kind === 'dialogue' ? `“${l.text}”` : l.text}</span>
              </span>
            </button>
          );
        })}
        {!lines.length && <p className="muted">Sem transcrição para este título.</p>}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
        Fonte: WebVTT com identificação de falante (&lt;v&gt;). Toque numa linha para ir até ela.
      </p>
    </section>
  );
}
