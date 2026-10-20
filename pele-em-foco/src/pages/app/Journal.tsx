import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HABITS, TAGS } from '../../lib/habits';
import { addDays, diffDays, formatLong, formatShort } from '../../lib/dates';
import { progress } from '../../lib/routine';
import { useStore } from '../../lib/store';
import type { SkinToday } from '../../lib/types';

const SKIN_TODAY: { value: SkinToday; label: string }[] = [
  { value: 'como-sempre', label: 'Como sempre' },
  { value: 'mais-oleosa', label: 'Mais oleosa' },
  { value: 'repuxando', label: 'Seca / repuxando' },
  { value: 'irritada', label: 'Irritada / ardendo' },
];

const SKIN_LABEL = Object.fromEntries(SKIN_TODAY.map((s) => [s.value, s.label])) as Record<SkinToday, string>;
const HABIT_LABEL = Object.fromEntries(HABITS.map((h) => [h.id, h.label])) as Record<string, string>;

export function Journal() {
  const { data, today, day, updateDay, toggleIn } = useStore();
  const [date, setDate] = useState(today);
  const entry = day(date);
  const isToday = date === today;
  const history = Object.entries(data.days)
    .filter(([d, e]) => d <= today && (e.note || e.skin || e.habits.length || e.tags.length || e.newSpots !== undefined || e.done.length))
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 30);

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Diário da pele</p>
        <h1>Como foi o dia?</h1>
        <p>Tudo aqui é opcional. São observações suas, não uma avaliação médica.</p>
      </header>

      <div className="row between card-flat" style={{ paddingBlock: 'var(--space-2)' }}>
        <button className="btn btn-ghost" aria-label="Dia anterior" onClick={() => setDate(addDays(date, -1))} disabled={diffDays(date, today) >= 60}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <strong aria-live="polite">{isToday ? 'Hoje' : formatLong(date)}</strong>
        <button className="btn btn-ghost" aria-label="Próximo dia" onClick={() => setDate(addDays(date, 1))} disabled={isToday}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <section className="card stack" aria-labelledby="habitos">
        <h2 id="habitos" style={{ fontSize: 'var(--text-md)' }}>Hábitos</h2>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          {HABITS.map((h) => (
            <button key={h.id} type="button" className="chip" aria-pressed={entry.habits.includes(h.id)} onClick={() => toggleIn(date, 'habits', h.id)}>
              {h.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="observacoes">
        <h2 id="observacoes" style={{ fontSize: 'var(--text-md)' }}>Observações</h2>
        <fieldset>
          <legend className="small">Minha pele hoje parece</legend>
          <div className="option-grid">
            {SKIN_TODAY.map((o) => (
              <label key={o.value} className="option">
                <input
                  type="radio"
                  name={`skin-${date}`}
                  checked={entry.skin === o.value}
                  onChange={() => updateDay(date, { skin: o.value })}
                  onClick={() => entry.skin === o.value && updateDay(date, { skin: undefined })}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="small">Notei espinhas novas?</legend>
          <div className="option-grid">
            {[{ v: false, l: 'Não' }, { v: true, l: 'Sim' }].map((o) => (
              <label key={o.l} className="option">
                <input
                  type="radio"
                  name={`spots-${date}`}
                  checked={entry.newSpots === o.v}
                  onChange={() => updateDay(date, { newSpots: o.v })}
                  onClick={() => entry.newSpots === o.v && updateDay(date, { newSpots: undefined })}
                />
                <span>{o.l}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="small">Algo diferente hoje?</legend>
          <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
            {TAGS.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={entry.tags.includes(t)} onClick={() => toggleIn(date, 'tags', t)}>{t}</button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="nota" className="small">Anotação livre</label>
          <textarea id="nota" className="input" maxLength={1000} placeholder="Ex.: pele mais oleosa na testa, dormi pouco." value={entry.note} onChange={(e) => updateDay(date, { note: e.target.value })} />
          <span className="xs muted">Salvo automaticamente neste aparelho.</span>
        </div>
        {entry.skin === 'irritada' && (
          <div className="notice alert">
            <p>Se a irritação veio depois de um produto novo, suspenda o uso. Ardor intenso, inchaço ou bolhas merecem avaliação médica.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="historico" className="stack">
        <h2 id="historico" style={{ fontSize: 'var(--text-lg)' }}>Histórico</h2>
        {history.length === 0 ? (
          <p className="muted">Seus registros aparecem aqui conforme você usa o app.</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.map(([d, e]) => {
              const p = progress(data.routine, e);
              return (
                <li key={d} className="history-item">
                  <button className="btn btn-ghost" style={{ padding: 0, minHeight: 0 }} onClick={() => { setDate(d); window.scrollTo({ top: 0 }); }}>
                    {formatShort(d)}
                  </button>
                  <p className="small" style={{ margin: '2px 0 0' }}>
                    Rotina: {p.done}/{p.total}
                    {e.skin && ` · Pele: ${SKIN_LABEL[e.skin].toLowerCase()}`}
                    {e.newSpots !== undefined && ` · Espinhas novas: ${e.newSpots ? 'sim' : 'não'}`}
                  </p>
                  {(e.habits.length > 0 || e.tags.length > 0) && (
                    <p className="xs muted" style={{ marginBottom: 0 }}>{[...e.habits.map((h) => HABIT_LABEL[h] ?? h), ...e.tags].join(' · ')}</p>
                  )}
                  {e.note && <p className="small muted" style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>“{e.note}”</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
