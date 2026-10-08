/**
 * ESTÚDIO — validação humana das interpretações + cadastro no Content Catalog API.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, Pencil, Send, Flag } from 'lucide-react';
import { runInterpretationPipeline, type PipelineResult } from '@/ai/interpretationPipeline';
import { formatGloss, parseGlossPlan } from '@/ai/librasEngine';
import type { ReviewRecord } from '@/ai/types';
import { EMOTION_LABEL } from '@/ai/types';
import { MOVIES } from '@/data/movies';
import { catalog, validateRights, type NewTitleInput } from '@/services/catalogService';
import { canTransition, loadAudit } from '@/services/validationService';
import { formatTime } from '@/services/videoService';
import { useApp } from '@/context/AppContext';
import type { ContentKind, InterpretationStatus, LicenseType, SignLanguageCode } from '@/types/content';
import { COUNTRY_LABEL, SIGN_LANGUAGES } from '@/types/content';
import { Disclaimer, StatusChip } from '@/components/ui';
import { Footer } from '@/components/Footer';

type Role = NonNullable<ReviewRecord['role']>;
const ROLES: Role[] = ['Intérprete de Libras', 'Pessoa surda', 'Especialista', 'Revisor linguístico'];

function Review() {
  const { reviews, setReview, user, toast } = useApp();
  const films = MOVIES.filter((m) => m.signLanguages.some((s) => s.source === 'pre-processed'));
  const [film, setFilm] = useState(films[0].id);
  const [res, setRes] = useState<PipelineResult | null>(null);
  const [reviewer, setReviewer] = useState(user?.name ?? '');
  const [role, setRole] = useState<Role>('Intérprete de Libras');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [audit, setAudit] = useState(loadAudit());

  useEffect(() => {
    const item = MOVIES.find((m) => m.id === film)!;
    runInterpretationPipeline(item, { reviews }).then(setRes);
  }, [film, reviews]);

  const act = (unitId: string, to: InterpretationStatus, current: InterpretationStatus, extra: Partial<ReviewRecord> = {}) => {
    if (!reviewer.trim()) {
      toast('Informe o nome de quem está revisando.', 'warn');
      return;
    }
    if (!canTransition(current, to)) {
      toast('Só é possível publicar depois da verificação humana.', 'warn');
      return;
    }
    const key = `${film}:${unitId}`;
    const prev = reviews[key];
    setReview(key, { ...prev, status: to, reviewer: reviewer.trim(), role, at: new Date().toISOString(), ...extra }, current);
    setAudit(loadAudit());
  };

  const stats = useMemo(() => {
    const s = { total: 0, verified: 0, published: 0 };
    res?.timeline.segments.forEach((x) => {
      s.total++;
      if (x.status === 'HUMAN_VERIFIED') s.verified++;
      if (x.status === 'PUBLISHED') s.published++;
    });
    return s;
  }, [res]);

  return (
    <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'end', marginBottom: 20 }}>
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label htmlFor="film">Título</label>
          <select id="film" className="input" value={film} onChange={(e) => setFilm(e.target.value)}>
            {films.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0, minWidth: 200 }}>
          <label htmlFor="rev">Revisor(a)</label>
          <input id="rev" className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Seu nome" />
        </div>
        <div className="field" style={{ margin: 0, minWidth: 220 }}>
          <label htmlFor="role">Papel</label>
          <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="chip">{stats.total} unidades</span>
          <span className="chip chip-ok">{stats.verified} verificadas</span>
          <span className="chip chip-ok">{stats.published} publicadas</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Tempo</th>
              <th>Origem</th>
              <th>Representação em Libras</th>
              <th className="hide-sm">Qualidade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {res?.timeline.segments.map((s) => {
              const key = `${film}:${s.unit.id}`;
              const isEditing = editing === key;
              const speaker = res.analysis.characters.find((c) => c.id === s.context.speaker.speakerId);
              return (
                <tr key={s.id}>
                  <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(s.unit.start)}
                    <br />
                    <Link className="muted" style={{ fontSize: 12 }} to={`/assistir/${film}?libras=1&t=${Math.max(0, s.unit.start - 1).toFixed(1)}`}>
                      <Eye size={12} /> prévia
                    </Link>
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    <span className="chip" style={{ marginBottom: 6 }}>
                      {s.unit.kind === 'dialogue' ? (speaker?.name ?? 'Fala') : s.unit.kind === 'sound' ? 'Som' : s.unit.kind === 'text' ? 'Texto' : 'Visual'}
                    </span>
                    <div>{s.unit.text}</div>
                    <small className="muted">
                      {EMOTION_LABEL[s.context.emotion.emotion]} · {s.context.context}
                    </small>
                  </td>
                  <td style={{ minWidth: 240 }}>
                    {isEditing ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Glosas" />
                        <small className="muted">Notação: GLOSA[top|wh|yn|neg|int] · #NOME (datilologia) · CL:X</small>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              if (!parseGlossPlan(draft).length) return;
                              act(s.unit.id, 'REVIEW_REQUIRED', s.status, { glossOverride: draft.trim(), note: 'glosas editadas' });
                              setEditing(null);
                            }}
                          >
                            Salvar
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <code style={{ fontSize: 13, color: '#e5deff' }}>{formatGloss(s.representation.tokens)}</code>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {s.representation.structure} · {s.representation.origin === 'human-edit' ? 'editado por humano' : 'plano pré-processado'}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="hide-sm" style={{ minWidth: 160 }}>
                    <strong>{Math.round(s.quality.confidence * 100)}%</strong>
                    <ul className="note-list" style={{ paddingLeft: 14 }}>
                      {s.quality.warnings.slice(0, 2).map((w) => (
                        <li key={w.code}>{w.message}</li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <StatusChip status={s.status} />
                    {s.review?.reviewer && (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                        {s.review.reviewer} · {s.review.role}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="icon-btn" title="Aprovar (verificado por humano)" aria-label="Aprovar" onClick={() => act(s.unit.id, 'HUMAN_VERIFIED', s.status)}>
                        <CheckCircle2 size={16} />
                      </button>
                      <button className="icon-btn" title="Publicar" aria-label="Publicar" disabled={s.status !== 'HUMAN_VERIFIED'} onClick={() => act(s.unit.id, 'PUBLISHED', s.status)}>
                        <Send size={16} />
                      </button>
                      <button className="icon-btn" title="Pedir revisão" aria-label="Pedir revisão" onClick={() => act(s.unit.id, 'REVIEW_REQUIRED', s.status)}>
                        <Flag size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Editar glosas"
                        aria-label="Editar glosas"
                        onClick={() => {
                          setEditing(key);
                          setDraft(formatGloss(s.representation.tokens));
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {audit.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          <h3>Trilha de auditoria</h3>
          <ul className="note-list" style={{ color: 'var(--text-2)' }}>
            {audit.slice(0, 12).map((a, i) => (
              <li key={i}>
                {new Date(a.at).toLocaleString('pt-BR')} — {a.reviewer} ({a.role}): {a.key} · {a.from} → {a.to}
                {a.note ? ` · ${a.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const EMPTY: NewTitleInput = {
  title: '',
  synopsis: '',
  kind: 'movie',
  year: 2026,
  durationMin: 90,
  maturity: 'L',
  genres: [],
  country: 'BR',
  originalLanguage: 'pt-BR',
  poster: '',
  videoUrl: '',
  licenseType: 'LICENSED',
  licenseHolder: '',
  territories: ['BR'],
  allowsSignLanguageOverlay: true,
  signLanguages: ['pt-BR-LIBRAS'],
};

function AddTitle() {
  const [f, setF] = useState<NewTitleInput>(EMPTY);
  const [genres, setGenres] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useApp();
  const up = (p: Partial<NewTitleInput>) => setF((x) => ({ ...x, ...p }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { ...f, genres: genres.split(',').map((g) => g.trim()).filter(Boolean) };
    const errs = validateRights(input);
    setErrors(errs);
    if (errs.length) return;
    try {
      const item = await catalog.create(input);
      toast(`“${item.title}” cadastrado no catálogo (salvo neste navegador).`, 'success');
      setF(EMPTY);
      setGenres('');
    } catch (err) {
      setErrors([(err as Error).message]);
    }
  };
  return (
    <form onSubmit={submit} className="split" noValidate>
      <div className="panel">
        <h3>Conteúdo</h3>
        <div className="field">
          <label htmlFor="t-title">Título</label>
          <input id="t-title" className="input" value={f.title} onChange={(e) => up({ title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="t-syn">Descrição</label>
          <textarea id="t-syn" className="input" value={f.synopsis} onChange={(e) => up({ synopsis: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="t-kind">Tipo</label>
            <select id="t-kind" className="input" value={f.kind} onChange={(e) => up({ kind: e.target.value as ContentKind })}>
              <option value="movie">Filme</option>
              <option value="series">Série</option>
              <option value="documentary">Documentário</option>
              <option value="short">Curta</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-mat">Classificação</label>
            <select id="t-mat" className="input" value={f.maturity} onChange={(e) => up({ maturity: e.target.value as NewTitleInput['maturity'] })}>
              {['L', '10', '12', '14', '16', '18'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-year">Ano</label>
            <input id="t-year" type="number" className="input" value={f.year} onChange={(e) => up({ year: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="t-dur">Duração (min)</label>
            <input id="t-dur" type="number" className="input" value={f.durationMin} onChange={(e) => up({ durationMin: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="t-country">País</label>
            <select id="t-country" className="input" value={f.country} onChange={(e) => up({ country: e.target.value })}>
              {Object.entries(COUNTRY_LABEL)
                .filter(([k]) => k !== 'WORLD')
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="t-lang">Idioma original</label>
            <input id="t-lang" className="input" value={f.originalLanguage} onChange={(e) => up({ originalLanguage: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="t-gen">Gêneros (separados por vírgula)</label>
          <input id="t-gen" className="input" value={genres} onChange={(e) => setGenres(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-poster">Capa (URL ou caminho)</label>
          <input id="t-poster" className="input" value={f.poster} onChange={(e) => up({ poster: e.target.value })} placeholder="https://…" />
        </div>
        <div className="field">
          <label htmlFor="t-video">Vídeo autorizado (URL https ou caminho)</label>
          <input id="t-video" className="input" value={f.videoUrl} onChange={(e) => up({ videoUrl: e.target.value })} placeholder="Opcional" />
        </div>
      </div>
      <div className="panel">
        <h3>Direitos e acessibilidade</h3>
        <div className="field">
          <label htmlFor="t-lic">Tipo de licença</label>
          <select id="t-lic" className="input" value={f.licenseType} onChange={(e) => up({ licenseType: e.target.value as LicenseType })}>
            <option value="LICENSED">Licenciado (contrato)</option>
            <option value="PUBLIC_DOMAIN">Domínio público</option>
            <option value="LUMIA_ORIGINAL">Produção própria</option>
            <option value="AUTHORIZED_TRAILER">Trailer autorizado</option>
            <option value="PARTNER_UPLOAD">Envio de parceiro</option>
            <option value="IN_NEGOTIATION">Em negociação (sem vídeo)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-holder">Titular dos direitos</label>
          <input id="t-holder" className="input" value={f.licenseHolder} onChange={(e) => up({ licenseHolder: e.target.value })} placeholder="Estúdio, distribuidora, produtora…" />
        </div>
        <div className="field">
          <label htmlFor="t-terr">Territórios (códigos, vírgula)</label>
          <input id="t-terr" className="input" value={f.territories.join(', ')} onChange={(e) => up({ territories: e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) })} />
        </div>
        <div className="setting">
          <div className="lbl">
            <div>
              <strong>Contrato permite sobrepor intérprete</strong>
              <small>Alguns contratos proíbem elementos sobre a imagem</small>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={f.allowsSignLanguageOverlay} className="switch" aria-label="Permite intérprete" onClick={() => up({ allowsSignLanguageOverlay: !f.allowsSignLanguageOverlay })} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Línguas de sinais a produzir</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(SIGN_LANGUAGES) as SignLanguageCode[]).map((c) => {
              const on = f.signLanguages.includes(c);
              return (
                <button type="button" key={c} className={`chip ${on ? 'chip-libras' : ''}`} style={{ cursor: 'pointer', height: 30 }} aria-pressed={on} onClick={() => up({ signLanguages: on ? f.signLanguages.filter((x) => x !== c) : [...f.signLanguages, c] })}>
                  {SIGN_LANGUAGES[c].short}
                </button>
              );
            })}
          </div>
        </div>
        {errors.length > 0 && (
          <ul className="form-error" role="alert" style={{ paddingLeft: 18 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button className="btn btn-primary" type="submit" style={{ marginTop: 10 }}>
          Cadastrar no catálogo
        </button>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Conteúdo novo entra com interpretação “planejada”. A geração em Libras exige o processamento futuro (análise multimodal + tradução + validação).
        </p>
      </div>
    </form>
  );
}

export default function StudioPage() {
  const [tab, setTab] = useState<'review' | 'catalog'>('review');
  return (
    <main className="page" id="conteudo">
      <div className="container">
        <p className="eyebrow">Estúdio LUMIA</p>
        <h1 className="serif" style={{ fontSize: 'clamp(40px,6vw,72px)', margin: '6px 0 8px' }}>
          {tab === 'review' ? 'Validação humana' : 'Content Catalog API'}
        </h1>
        <p className="muted" style={{ maxWidth: 780 }}>
          {tab === 'review'
            ? 'Intérpretes de Libras, pessoas surdas, especialistas e revisores linguísticos aprovam, corrigem e publicam cada trecho. Mudanças aqui atualizam o intérprete no player na hora.'
            : 'Cadastro de títulos com direitos, territórios e línguas de sinais. Nada entra no catálogo sem titular de direitos e licença compatível.'}
        </p>
        <div className="tabs" role="tablist" style={{ maxWidth: 520 }}>
          <button role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')}>
            Validação
          </button>
          <button role="tab" aria-selected={tab === 'catalog'} onClick={() => setTab('catalog')}>
            Cadastrar conteúdo
          </button>
        </div>
        {tab === 'review' ? <Review /> : <AddTitle />}
        <div style={{ marginTop: 24 }}>
          <Disclaimer />
          <p className="muted" style={{ fontSize: 12.5 }}>Protótipo: revisões e cadastros ficam salvos neste navegador. Em produção, a fila de revisão é compartilhada e auditada no servidor.</p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
