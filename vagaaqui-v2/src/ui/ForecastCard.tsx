import { useState } from 'react';
import { addFavorite, clearDestination, navigate, openArrival, setArriveAt } from '../app/controller';
import { isPro } from '../app/plan';
import { setState, useApp } from '../app/state';
import { distance } from '../lib/geo';
import type { SegmentForecast } from '../model/types';
import { LEVEL_COLOR, LEVEL_LABEL, pct, range } from './colors';

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function ForecastCard() {
  const dest = useApp((s) => s.dest);
  const f = useApp((s) => s.forecast);
  const eta = useApp((s) => s.eta);
  const loading = useApp((s) => s.loading);
  const error = useApp((s) => s.error);
  const lots = useApp((s) => s.lots);
  const streetSource = useApp((s) => s.streetSource);
  const selectedId = useApp((s) => s.selectedSegmentId);
  const plan = useApp((s) => s.plan);
  const target = useApp((s) => s.arriveAtTarget);
  const demo = useApp((s) => s.settings.demo);
  const [saving, setSaving] = useState(false);
  const [pickTime, setPickTime] = useState(false);
  if (!dest) return null;

  const pro = isPro(plan);
  const nearLots = lots
    .map((l) => ({ l, d: distance(l.pos, dest.pos) }))
    .filter((x) => x.d <= 600)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2);
  const selected: SegmentForecast | undefined = f?.all.find((x) => x.segment.id === selectedId);
  const simulated = f ? f.all.some((x) => x.simulatedShare > 0) : false;
  const isHere = dest.id.startsWith('here-');

  return (
    <section className="sheet" aria-live="polite">
      <header className="sheet-head">
        <div className="sheet-title">
          <small>{isHere ? 'PROCURANDO AQUI' : 'DESTINO'}</small>
          <h2>{dest.name}</h2>
        </div>
        <button className="icon-btn ghost" aria-label="Fechar previsão" onClick={clearDestination}>
          ✕
        </button>
      </header>

      {loading && !f && (
        <div className="skeleton">
          <div className="sk-line w60" />
          <div className="sk-big" />
          <div className="sk-line w80" />
          <p className="muted">Lendo as ruas e os relatos perto do destino…</p>
        </div>
      )}
      {error && !f && <p className="error">Não foi possível calcular agora: {error}</p>}

      {f && (
        <>
          <div className="verdict" style={{ borderColor: LEVEL_COLOR[f.level] }}>
            <div className="verdict-q">{isHere ? 'Chance de vaga agora, perto de você' : `Chance de vaga quando você chegar${f.etaMin ? ` (em ${f.etaMin} min)` : ''}`}</div>
            <div className="verdict-row">
              <span className="verdict-level" style={{ color: LEVEL_COLOR[f.level] }}>
                {LEVEL_LABEL[f.level]}
              </span>
              <span className="verdict-pct">{range(f.overallLow, f.overallHigh)}</span>
            </div>
            <div className="verdict-meta">
              {target && pro ? `Chegada às ${fmtTime(f.arriveAt)}` : eta && !isHere ? `Chegada ≈ ${fmtTime(f.arriveAt)} · ${eta.source === 'route' ? 'rota calculada' : 'tempo estimado pela distância'}` : null}
            </div>
            <div className="sources">
              <span>{f.sourcesText}</span>
              {f.dataIsEstimate && <span className="tag">estimativa</span>}
              {simulated && demo && <span className="tag tag-warn">inclui relatos simulados (demo)</span>}
              {streetSource === 'demo' && <span className="tag tag-warn">ruas simuladas — sem conexão com o OpenStreetMap</span>}
            </div>
          </div>

          {f.best.length > 0 ? (
            <ol className="best">
              {f.best.map((b, i) => (
                <li key={b.segment.id}>
                  <button className={`best-row ${selectedId === b.segment.id ? 'sel' : ''}`} onClick={() => setState({ selectedSegmentId: b.segment.id })}>
                    <span className={`rank lv-${b.level}`}>{i + 1}</span>
                    <span className="best-main">
                      <b>{b.segment.name}</b>
                      <span>
                        ≈ {Math.max(1, Math.round(b.walkMin))} min a pé · {Math.round(b.walkM)} m{b.segment.paid ? ' · Zona Azul/rotativo' : ''}
                        {b.newestReportAgeMin !== null ? ` · relato há ${b.newestReportAgeMin} min` : ''}
                      </span>
                    </span>
                    <span className="best-p" style={{ color: LEVEL_COLOR[b.level] }}>
                      {pct(b.p)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Não achamos trechos de rua com estacionamento permitido num raio de caminhada. Veja o plano B abaixo.</p>
          )}

          {selected && !f.best.some((b) => b.segment.id === selected.segment.id) && (
            <p className="selected-info">
              <b>{selected.segment.name}</b>: {pct(selected.p)} ({range(selected.low, selected.high)}) · {Math.round(selected.walkM)} m a pé
            </p>
          )}

          {nearLots.length > 0 && (
            <div className="planb">
              <small>PLANO B · ESTACIONAMENTOS</small>
              {nearLots.map(({ l, d }) => (
                <button key={l.id} className="lot-row" onClick={() => navigate('google', l.pos)}>
                  <span className="lot-p">P</span>
                  <span className="best-main">
                    <b>{l.name}</b>
                    <span>
                      {Math.round(d)} m do destino · {l.fee === 'yes' ? 'pago (preço não informado)' : l.fee === 'no' ? 'gratuito' : 'preço não informado'}
                      {l.capacity ? ` · ${l.capacity} vagas` : ''}
                    </span>
                  </span>
                  <span className="go">›</span>
                </button>
              ))}
            </div>
          )}

          <div className="actions">
            <button className="btn primary" onClick={() => navigate('waze', selected?.segment.mid ?? f.best[0]?.segment.mid ?? dest.pos)}>
              IR com Waze
            </button>
            <button className="btn" onClick={() => navigate('google', selected?.segment.mid ?? f.best[0]?.segment.mid ?? dest.pos)}>
              Google Maps
            </button>
          </div>

          <div className="secondary-actions">
            {!isHere && (
              <button className="link-btn" onClick={() => (pro ? setPickTime((v) => !v) : setArriveAt(Date.now() + 3600000))}>
                {pro ? '🕑' : '🔒'} Chegar em outro horário
              </button>
            )}
            {!isHere && (
              <button className="link-btn" onClick={() => setSaving((v) => !v)}>
                ☆ Salvar
              </button>
            )}
            <button className="link-btn" onClick={openArrival}>
              ✓ Cheguei
            </button>
          </div>

          {pickTime && pro && (
            <div className="inline-form">
              <label>
                Chegada às{' '}
                <input
                  type="time"
                  defaultValue={fmtTime(target ?? Date.now() + 3600000)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
                    setArriveAt(d.getTime());
                  }}
                />
              </label>
              {target && (
                <button className="link-btn" onClick={() => setArriveAt(null)}>
                  Sair agora
                </button>
              )}
              {target && eta && <p className="muted">Para chegar às {fmtTime(target)}, saia até {fmtTime(target - eta.minutes * 60000)}.</p>}
            </div>
          )}

          {saving && (
            <div className="inline-form">
              {['Casa', 'Trabalho', 'Outro'].map((label) => (
                <button
                  key={label}
                  className="chip"
                  onClick={() => {
                    const name = label === 'Outro' ? dest.name.slice(0, 18) : label;
                    if (addFavorite(name, dest)) setSaving(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
