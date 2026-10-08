import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bell, BellRing, Check, Heart, Play, Plus, ShieldCheck, Film, Accessibility, Languages } from 'lucide-react';
import type { CatalogItem } from '@/types/content';
import { COUNTRY_LABEL, KIND_LABEL, LANGUAGE_LABEL, SIGN_LANGUAGES } from '@/types/content';
import { catalog, hasInterpretation, isPlayable } from '@/services/catalogService';
import { resolveSource } from '@/services/videoService';
import { useApp } from '@/context/AppContext';
import { Disclaimer, Maturity, StatusChip } from '@/components/ui';
import { MovieRow } from '@/components/MovieGrid';
import { Footer } from '@/components/Footer';

const LICENSE_LABEL: Record<string, string> = {
  LUMIA_ORIGINAL: 'Produção original LUMIA (direitos próprios)',
  PUBLIC_DOMAIN: 'Domínio público',
  LICENSED: 'Licenciado',
  AUTHORIZED_TRAILER: 'Trailer autorizado',
  PARTNER_UPLOAD: 'Enviado por parceiro',
  IN_NEGOTIATION: 'Em negociação de licenciamento',
  FICTIONAL_DEMO: 'Título fictício de demonstração',
};

export default function TitlePage() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const { myList, toggleList, favorites, toggleFavorite, notify, toggleNotify, toast, prefs } = useApp();
  const [item, setItem] = useState<CatalogItem | null | undefined>(undefined);
  const [similar, setSimilar] = useState<CatalogItem[]>([]);
  const [trailer, setTrailer] = useState(false);

  useEffect(() => {
    setTrailer(false);
    catalog.get(slug).then((i) => {
      setItem(i ?? null);
      if (i) catalog.list().then((all) => setSimilar(all.filter((x) => x.id !== i.id && x.genres.some((g) => i.genres.includes(g)))));
    });
    window.scrollTo(0, 0);
  }, [slug]);

  if (item === undefined) return <main className="page" />;
  if (item === null)
    return (
      <main className="page container">
        <div className="empty">
          Título não encontrado. <Link to="/">Voltar ao início</Link>
        </div>
      </main>
    );

  const playable = isPlayable(item);
  const libras = hasInterpretation(item);
  const inList = myList.includes(item.id);
  const fav = favorites.includes(item.id);
  const notified = notify.includes(item.id);

  return (
    <main id="conteudo">
      <section className="details-hero">
        <div className="bg">{trailer && item.trailer && item.video ? <video src={`${resolveSource(item.video.renditions[item.video.renditions.length - 1])}${item.trailer}`} autoPlay muted playsInline onPause={() => setTrailer(false)} /> : <img src={item.backdrop} alt="" />}</div>
        <div className="details-inner">
          <div className="details-poster">
            <img src={item.poster} alt={`Capa de ${item.title}`} />
          </div>
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="chip">{KIND_LABEL[item.kind]}</span>
              {item.tags.includes('original') && <span className="chip chip-amber">Original LUMIA</span>}
              {item.fictional && <span className="chip chip-mock">Título fictício (demo)</span>}
              {libras && <span className="chip chip-libras">🤟 Intérprete IA em Libras</span>}
            </div>
            <h1 className="details-title">{item.title}</h1>
            {item.originalTitle && <p className="muted" style={{ margin: '6px 0 0' }}>{item.originalTitle}</p>}
            <div className="details-meta">
              <span>{item.year}</span>
              <span className="sep" />
              <span>{item.kind === 'series' ? `${item.seasons?.[0]?.episodes.length ?? 0} episódios` : item.durationMin < 2 ? `${item.video?.durationSec ?? 60} s` : `${item.durationMin} min`}</span>
              <span className="sep" />
              <Maturity r={item.maturity} />
              <span className="sep" />
              <span>{item.genres.join(', ')}</span>
              <span className="sep" />
              <span>{COUNTRY_LABEL[item.country] ?? item.country}</span>
            </div>
            <p className="details-synopsis">{item.synopsis}</p>
            <div className="details-actions">
              {playable ? (
                <>
                  <button className="btn btn-primary" onClick={() => nav(`/assistir/${item.slug}`)}>
                    <Play size={18} fill="currentColor" /> Assistir
                  </button>
                  {libras && (
                    <button className="btn btn-libras" onClick={() => nav(`/assistir/${item.slug}?libras=1`)}>
                      <span aria-hidden>🤟</span> Assistir com intérprete IA
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button className="btn btn-primary" disabled title="Sem direitos de exibição nesta demonstração">
                    <Play size={18} /> Indisponível — {item.availability === 'LICENSING' ? 'em licenciamento' : 'em breve'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    aria-pressed={notified}
                    onClick={() => {
                      toggleNotify(item.id);
                      toast(notified ? 'Aviso removido.' : 'Avisaremos quando este título chegar (salvo neste navegador).', 'success');
                    }}
                  >
                    {notified ? <BellRing size={18} /> : <Bell size={18} />} {notified ? 'Aviso ativado' : 'Avise-me'}
                  </button>
                </>
              )}
              {item.trailer && (
                <button className="btn btn-ghost" onClick={() => setTrailer((v) => !v)}>
                  <Film size={18} /> {trailer ? 'Parar prévia' : 'Prévia'}
                </button>
              )}
              <button className="icon-btn" style={{ width: 48, height: 48 }} aria-pressed={inList} aria-label={inList ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'} onClick={() => toggleList(item.id)}>
                {inList ? <Check size={20} /> : <Plus size={20} />}
              </button>
              <button className="icon-btn" style={{ width: 48, height: 48 }} aria-pressed={fav} aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'} onClick={() => toggleFavorite(item.id)}>
                <Heart size={20} fill={fav ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="info-grid">
          <div className="panel">
            <h3>
              <Film size={16} /> Ficha
            </h3>
            <dl className="kv">
              <dt>Direção</dt>
              <dd>{item.director}</dd>
              <dt>Elenco</dt>
              <dd>{item.cast.join(', ') || '—'}</dd>
              <dt>Ano</dt>
              <dd>{item.year}</dd>
              <dt>Classificação</dt>
              <dd>
                <Maturity r={item.maturity} /> {item.maturity === 'L' ? 'Livre' : `${item.maturity} anos`}
              </dd>
            </dl>
            {item.fictional && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>* Nomes fictícios criados para demonstração.</p>}
          </div>
          <div className="panel">
            <h3>
              <Languages size={16} /> Idiomas
            </h3>
            <dl className="kv">
              <dt>Original</dt>
              <dd>{LANGUAGE_LABEL[item.originalLanguage] ?? item.originalLanguage}</dd>
              <dt>Áudio</dt>
              <dd>{item.audioLanguages.map((l) => LANGUAGE_LABEL[l] ?? l).join(', ')}</dd>
              <dt>Legendas</dt>
              <dd>{item.subtitleLanguages.map((l) => LANGUAGE_LABEL[l] ?? l).join(', ') || '—'}</dd>
            </dl>
          </div>
          <div className="panel">
            <h3>
              <Accessibility size={16} /> Recursos de acessibilidade
            </h3>
            <ul className="feature-list">
              {item.signLanguages.map((s) => (
                <li key={s.language}>
                  <span>🤟 {SIGN_LANGUAGES[s.language].short} <small className="muted">({SIGN_LANGUAGES[s.language].country})</small></span>
                  <StatusChip status={s.status} />
                </li>
              ))}
              <li>
                <span>💬 Legendas descritivas</span>
                <span className={`chip ${item.accessibility.captions ? 'chip-ok' : 'chip-mock'}`}>{item.accessibility.captions ? 'Sim' : 'Não'}</span>
              </li>
              <li>
                <span>🔊 Sons importantes</span>
                <span className={`chip ${item.accessibility.soundDescriptions ? 'chip-ok' : 'chip-mock'}`}>{item.accessibility.soundDescriptions ? 'Sim' : 'Não'}</span>
              </li>
              <li>
                <span>🎭 Contexto emocional</span>
                <span className={`chip ${item.accessibility.emotionalContext ? 'chip-ok' : 'chip-mock'}`}>{item.accessibility.emotionalContext ? 'Sim' : 'Não'}</span>
              </li>
              <li>
                <span>🎧 Audiodescrição</span>
                <span className="chip chip-mock">{item.accessibility.audioDescription === 'available' ? 'Sim' : item.accessibility.audioDescription === 'planned' ? 'Planejada' : 'Não'}</span>
              </li>
            </ul>
          </div>
          <div className="panel">
            <h3>
              <ShieldCheck size={16} /> Direitos
            </h3>
            <dl className="kv">
              <dt>Licença</dt>
              <dd>{LICENSE_LABEL[item.license.type]}</dd>
              <dt>Titular</dt>
              <dd>{item.license.holder}</dd>
              <dt>Territórios</dt>
              <dd>{item.license.territories.length ? item.license.territories.map((t) => COUNTRY_LABEL[t] ?? t).join(', ') : '—'}</dd>
              <dt>Intérprete sobre o vídeo</dt>
              <dd>{item.license.allowsSignLanguageOverlay ? 'Permitido' : 'Não permitido'}</dd>
            </dl>
          </div>
        </div>

        {item.seasons && (
          <div className="panel" style={{ marginBottom: 30 }}>
            <h3>Temporada 1</h3>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
              {item.seasons[0].episodes.map((e) => (
                <li key={e.number}>
                  <strong>{e.title}</strong> <span className="muted">· {e.durationMin} min · indisponível (fictício)</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {libras && prefs.signLanguage === 'pt-BR-LIBRAS' && <Disclaimer />}
      </div>
      <MovieRow title="Títulos parecidos" items={similar} />
      <Footer />
    </main>
  );
}
