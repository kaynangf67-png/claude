import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { EmptyState, Spinner } from '../../components/ui';
import { RequireAccess } from '../../components/guards';
import { useBackend } from '../../app/session';
import { useAsync } from '../../app/useAsync';
import { CATEGORIES, FAQS, categoryLabel, type Article, type ArticleCategory } from '../../content/articles';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function searchable(a: Article) {
  return normalize([a.title, a.summary, ...a.sections.flatMap((s) => [s.heading ?? '', ...(s.paragraphs ?? []), ...(s.bullets ?? []), s.note ?? ''])].join(' '));
}

function LearnInner() {
  const { data } = useBackend();
  const state = useAsync(() => data.listArticles(), [data]);
  const [category, setCategory] = useState<ArticleCategory | 'todas'>('todas');
  const [query, setQuery] = useState('');
  const articles = state.data ?? [];
  const index = useMemo(() => articles.map((a) => ({ a, text: searchable(a) })), [articles]);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const list = index.filter(({ a, text }) => (category === 'todas' || a.category === category) && terms.every((t) => text.includes(t))).map((x) => x.a);

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Aprender</p>
        <h1>Biblioteca</h1>
        <p>Textos curtos, em português claro, com as fontes de cada informação.</p>
      </header>

      <Link to="/app/aprender/questionario" className="card-forest card-link row between">
        <span><strong>Questionário de rotina</strong><br /><span className="small" style={{ color: 'var(--pf-sage-soft)' }}>6 perguntas, sem foto, para saber que tipo de produto procurar.</span></span>
        <ArrowRight aria-hidden="true" />
      </Link>

      <div className="field search-field">
        <label htmlFor="busca" className="sr-only">Buscar na biblioteca</label>
        <Search size={18} aria-hidden="true" className="search-icon" />
        <input id="busca" type="search" className="input" placeholder="Buscar: protetor, cravo, leite, rótulo…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="row wrap" style={{ gap: 'var(--space-2)' }} role="group" aria-label="Filtrar por categoria">
        <button className="chip" aria-pressed={category === 'todas'} onClick={() => setCategory('todas')}>Todas</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
        ))}
      </div>

      {state.loading && !state.data ? (
        <Spinner />
      ) : state.error ? (
        <p className="field-error" role="alert">{state.error}</p>
      ) : list.length === 0 ? (
        <EmptyState icon={<BookOpen />} title="Nada encontrado" action={<button className="btn btn-secondary" onClick={() => { setQuery(''); setCategory('todas'); }}>Limpar busca</button>}>
          Tente outra palavra ou outra categoria.
        </EmptyState>
      ) : (
        <>
          <p className="small muted" aria-live="polite" style={{ marginBottom: 0 }}>{list.length} {list.length === 1 ? 'artigo' : 'artigos'}</p>
          <div className="grid grid-2">
            {list.map((a) => (
              <Link key={a.slug} to={`/app/aprender/${a.slug}`} className="card card-link stack">
                <div className="row between"><span className="tag">{categoryLabel(a.category)}</span><span className="xs muted">{a.minutes} min</span></div>
                <h2 className="h3" style={{ fontSize: 'var(--text-md)' }}>{a.title}</h2>
                <p className="small muted" style={{ marginBottom: 0 }}>{a.summary}</p>
                <span className="small row link-cue">Ler <ArrowRight size={14} aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </>
      )}

      <section aria-labelledby="faq" className="stack">
        <h2 id="faq" className="h3">Perguntas frequentes</h2>
        <div>
          {FAQS.map((f) => (
            <details key={f.q} className="faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Link to="/app/aprender/guia-de-produtos" className="card-beige card-link row between">
        <span><strong>Guia de produtos</strong><br /><span className="small muted">O que observar em limpador, hidratante, protetor e tratamento.</span></span>
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

export function Learn() {
  return <RequireAccess><LearnInner /></RequireAccess>;
}
